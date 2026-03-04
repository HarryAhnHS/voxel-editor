import {
  BOUNDS_MIN,
  BOUNDS_MAX,
  MAX_VOXEL_COUNT,
} from "@/app/store/voxelConstraints";
import type { Vec3, VoxelSpec, VoxelCommand, VoxelBounds } from "@/types/voxelSpec";
import {
  estimateCommandVoxels,
  VOXEL_SPEC_MAX_VOXELS,
} from "@/types/voxelSpec";

export interface RasterizeLimits {
  /** Optional hard override for max voxels; defaults to MAX_VOXEL_COUNT / VOXEL_SPEC_MAX_VOXELS. */
  maxVoxels?: number;
}

export interface RasterizedVoxel {
  x: number;
  y: number;
  z: number;
  /** Hex string like #RRGGBB. */
  color: string;
}

export interface ClampedBoundsResult {
  bounds: VoxelBounds;
  maxVoxels: number;
}

export class RasterizeError extends Error {}

// --- Helpers -----------------------------------------------------------------

function clampCoord(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function clampVec3(vec: Vec3, min: Vec3, max: Vec3): Vec3 {
  return {
    x: clampCoord(vec.x, min.x, max.x),
    y: clampCoord(vec.y, min.y, max.y),
    z: clampCoord(vec.z, min.z, max.z),
  };
}

function boundsWorldMinMax(bounds: VoxelBounds): { min: Vec3; max: Vec3 } {
  return {
    min: bounds.origin,
    max: {
      x: bounds.origin.x + bounds.size.x - 1,
      y: bounds.origin.y + bounds.size.y - 1,
      z: bounds.origin.z + bounds.size.z - 1,
    },
  };
}

function makeBoundsFromMinMax(min: Vec3, max: Vec3): VoxelBounds {
  return {
    origin: min,
    size: {
      x: max.x - min.x + 1,
      y: max.y - min.y + 1,
      z: max.z - min.z + 1,
    },
  };
}

function paletteColorToHex(spec: VoxelSpec, ref: VoxelCommand["color"]): string {
  if (ref.kind === "hex") return ref.hex;
  const palette = spec.palette;
  if (!palette) {
    throw new RasterizeError(`Palette reference "${ref.id}" but spec has no palette`);
  }
  const found = palette.colors.find((c) => c.id === ref.id);
  if (!found) {
    throw new RasterizeError(`Palette color id "${ref.id}" not found`);
  }
  return found.hex;
}

// --- Public API --------------------------------------------------------------

/**
 * Clamp spec bounds into global editor bounds and enforce an early voxel cap
 * using the same estimator as the schema. Throws on impossible specs.
 */
export function clampBounds(
  spec: VoxelSpec,
  limits: RasterizeLimits = {}
): ClampedBoundsResult {
  const [minX, minY, minZ] = BOUNDS_MIN;
  const [maxX, maxY, maxZ] = BOUNDS_MAX;

  const worldMin = { x: minX, y: minY, z: minZ };
  const worldMax = { x: maxX, y: maxY, z: maxZ };

  const { min: specMin, max: specMax } = boundsWorldMinMax(spec.bounds);

  const clampedMin = clampVec3(specMin, worldMin, worldMax);
  const clampedMax = clampVec3(specMax, worldMin, worldMax);

  // If clamping inverted the box, nothing is inside global bounds.
  if (
    clampedMin.x > clampedMax.x ||
    clampedMin.y > clampedMax.y ||
    clampedMin.z > clampedMax.z
  ) {
    throw new RasterizeError("Spec bounds lie completely outside global bounds");
  }

  const clampedBounds = makeBoundsFromMinMax(clampedMin, clampedMax);

  const est = spec.commands.reduce(
    (sum, cmd) => sum + estimateCommandVoxels(cmd as VoxelCommand, clampedBounds),
    0
  );

  const hardCap =
    limits.maxVoxels ??
    Math.min(MAX_VOXEL_COUNT, VOXEL_SPEC_MAX_VOXELS);

  if (est > hardCap) {
    throw new RasterizeError(
      `Estimated voxel count ${est} exceeds cap of ${hardCap}`
    );
  }

  console.log("[clampBounds]", {
    specBounds: spec.bounds,
    clampedBounds,
    maxVoxels: hardCap,
  });
  return { bounds: clampedBounds, maxVoxels: hardCap };
}

/**
 * Inclusive integer box rasterization with no deduping.
 */
export function rasterizeBox(
  from: Vec3,
  to: Vec3,
  color: string
): RasterizedVoxel[] {
  const voxels: RasterizedVoxel[] = [];
  for (let x = from.x; x <= to.x; x++) {
    for (let y = from.y; y <= to.y; y++) {
      for (let z = from.z; z <= to.z; z++) {
        voxels.push({ x, y, z, color });
      }
    }
  }
  return voxels;
}

function rasterizeCommand(
  spec: VoxelSpec,
  cmd: VoxelCommand,
  bounds: VoxelBounds
): RasterizedVoxel[] {
  const color = paletteColorToHex(spec, cmd.color);
  const { min, max } = boundsWorldMinMax(bounds);

  switch (cmd.op) {
    case "box": {
      const from = clampVec3(cmd.from, min, max);
      const to = clampVec3(cmd.to, min, max);
      if (from.x > to.x || from.y > to.y || from.z > to.z) return [];
      return rasterizeBox(from, to, color);
    }
    case "hollowBox": {
      const from = clampVec3(cmd.from, min, max);
      const to = clampVec3(cmd.to, min, max);
      if (from.x > to.x || from.y > to.y || from.z > to.z) return [];

      const voxels: RasterizedVoxel[] = [];
      for (let x = from.x; x <= to.x; x++) {
        for (let y = from.y; y <= to.y; y++) {
          for (let z = from.z; z <= to.z; z++) {
            const isOnBorder =
              x === from.x ||
              x === to.x ||
              y === from.y ||
              y === to.y ||
              z === from.z ||
              z === to.z;
            if (isOnBorder) {
              voxels.push({ x, y, z, color });
            }
          }
        }
      }
      return voxels;
    }
    case "floor": {
      const y = clampCoord(cmd.y, min.y, max.y);
      let fromX: number;
      let toX: number;
      let fromZ: number;
      let toZ: number;
      if (cmd.area) {
        // area is bounds-local (0..size.x-1, 0..size.z-1). Clamp to valid range
        // so that "full floor" intent works even when spec bounds were clamped.
        const localMaxX = bounds.size.x - 1;
        const localMaxZ = bounds.size.z - 1;
        const localFromX = clampCoord(cmd.area.from.x, 0, localMaxX);
        const localToX = clampCoord(cmd.area.to.x, 0, localMaxX);
        const localFromZ = clampCoord(cmd.area.from.z, 0, localMaxZ);
        const localToZ = clampCoord(cmd.area.to.z, 0, localMaxZ);
        fromX = bounds.origin.x + Math.min(localFromX, localToX);
        toX = bounds.origin.x + Math.max(localFromX, localToX);
        fromZ = bounds.origin.z + Math.min(localFromZ, localToZ);
        toZ = bounds.origin.z + Math.max(localFromZ, localToZ);
        console.log("[rasterize] floor", {
          boundsOrigin: bounds.origin,
          boundsSize: bounds.size,
          area: cmd.area,
          localClamped: { from: { x: Math.min(localFromX, localToX), z: Math.min(localFromZ, localToZ) }, to: { x: Math.max(localFromX, localToX), z: Math.max(localFromZ, localToZ) } },
          worldFromTo: { fromX, toX, fromZ, toZ },
        });
      } else {
        fromX = bounds.origin.x;
        toX = bounds.origin.x + bounds.size.x - 1;
        fromZ = bounds.origin.z;
        toZ = bounds.origin.z + bounds.size.z - 1;
        console.log("[rasterize] floor (no area)", { boundsOrigin: bounds.origin, boundsSize: bounds.size, worldFromTo: { fromX, toX, fromZ, toZ } });
      }

      const from = clampVec3({ x: fromX, y, z: fromZ }, min, max);
      const to = clampVec3({ x: toX, y, z: toZ }, min, max);
      if (from.x > to.x || from.z > to.z) {
        console.log("[rasterize] floor empty after clamp", { from, to, boundsMin: min, boundsMax: max });
        return [];
      }

      const voxels: RasterizedVoxel[] = [];
      for (let x = from.x; x <= to.x; x++) {
        for (let z = from.z; z <= to.z; z++) {
          voxels.push({ x, y: from.y, z, color });
        }
      }
      console.log("[rasterize] floor voxelCount", voxels.length, "worldRange", { x: [from.x, to.x], z: [from.z, to.z] });
      return voxels;
    }
    case "line": {
      const from = clampVec3(cmd.from, min, max);
      const to = clampVec3(cmd.to, min, max);

      const voxels: RasterizedVoxel[] = [];
      const dx = Math.abs(to.x - from.x);
      const dy = Math.abs(to.y - from.y);
      const dz = Math.abs(to.z - from.z);

      const steps = Math.max(dx, dy, dz);
      if (steps === 0) {
        return [{ x: from.x, y: from.y, z: from.z, color }];
      }

      const sx = (to.x - from.x) / steps;
      const sy = (to.y - from.y) / steps;
      const sz = (to.z - from.z) / steps;

      for (let i = 0; i <= steps; i++) {
        const x = Math.round(from.x + sx * i);
        const y = Math.round(from.y + sy * i);
        const z = Math.round(from.z + sz * i);
        voxels.push({ x, y, z, color });
      }
      return voxels;
    }
    case "sphere": {
      const center = clampVec3(cmd.center, min, max);
      const r = cmd.radius;
      const r2 = r * r;
      const hollow = cmd.hollow === true;

      const from: Vec3 = {
        x: Math.max(center.x - r, min.x),
        y: Math.max(center.y - r, min.y),
        z: Math.max(center.z - r, min.z),
      };
      const to: Vec3 = {
        x: Math.min(center.x + r, max.x),
        y: Math.min(center.y + r, max.y),
        z: Math.min(center.z + r, max.z),
      };

      const voxels: RasterizedVoxel[] = [];
      for (let x = from.x; x <= to.x; x++) {
        const dx2 = (x - center.x) * (x - center.x);
        for (let y = from.y; y <= to.y; y++) {
          const dy2 = (y - center.y) * (y - center.y);
          for (let z = from.z; z <= to.z; z++) {
            const dz2 = (z - center.z) * (z - center.z);
            const dist2 = dx2 + dy2 + dz2;
            if (dist2 > r2) continue;
            if (hollow) {
              // For hollow spheres, require distance close to radius.
              // Use a simple threshold band of 1 voxel.
              if (dist2 < (r - 1) * (r - 1)) continue;
            }
            voxels.push({ x, y, z, color });
          }
        }
      }
      console.log("[rasterize] sphere", { center: cmd.center, radius: r, hollow, boundsMin: min, boundsMax: max, voxelCount: voxels.length });
      return voxels;
    }
    case "cylinder": {
      const centerX = clampCoord(cmd.center.x, min.x, max.x);
      const centerZ = clampCoord(cmd.center.z, min.z, max.z);
      const yFrom = clampCoord(cmd.yFrom, min.y, max.y);
      const yTo = clampCoord(cmd.yTo, min.y, max.y);
      if (yFrom > yTo) return [];

      const r = cmd.radius;
      const r2 = r * r;
      const hollow = cmd.hollow === true;

      const fromX = Math.max(centerX - r, min.x);
      const toX = Math.min(centerX + r, max.x);
      const fromZ = Math.max(centerZ - r, min.z);
      const toZ = Math.min(centerZ + r, max.z);

      const voxels: RasterizedVoxel[] = [];
      for (let y = yFrom; y <= yTo; y++) {
        for (let x = fromX; x <= toX; x++) {
          const dx2 = (x - centerX) * (x - centerX);
          for (let z = fromZ; z <= toZ; z++) {
            const dz2 = (z - centerZ) * (z - centerZ);
            const dist2 = dx2 + dz2;
            if (dist2 > r2) continue;
            if (hollow) {
              if (dist2 < (r - 1) * (r - 1)) continue;
            }
            voxels.push({ x, y, z, color });
          }
        }
      }
      return voxels;
    }
    default: {
      const _never: never = cmd;
      return _never;
    }
  }
}

/**
 * High-level rasterizer:
 * - validates command count
 * - clamps bounds
 * - rasterizes commands
 * - dedupes voxels by key "x,y,z"
 * - enforces voxel cap during fill
 */
export function rasterize(
  spec: VoxelSpec,
  limits: RasterizeLimits = {}
): RasterizedVoxel[] {
  if (!spec.commands || spec.commands.length === 0) {
    throw new RasterizeError("Spec has no commands");
  }
  if (spec.commands.length > 1024) {
    throw new RasterizeError("Spec has too many commands");
  }

  const { bounds, maxVoxels } = clampBounds(spec, limits);

  const voxelMap = new Map<string, RasterizedVoxel>();

  const boundsMinMax = boundsWorldMinMax(bounds);
  for (let i = 0; i < spec.commands.length; i++) {
    const cmd = spec.commands[i] as VoxelCommand;
    console.log("[rasterize] command", i, cmd.op, "bounds", boundsMinMax);
    const voxels = rasterizeCommand(spec, cmd, bounds);
    for (const v of voxels) {
      const key = `${v.x},${v.y},${v.z}`;
      if (!voxelMap.has(key)) {
        if (voxelMap.size >= maxVoxels) {
          throw new RasterizeError(
            `Voxel cap reached (${maxVoxels}); rasterization stopped`
          );
        }
        voxelMap.set(key, v);
      } else {
        // overwrite color but don't change size (dedupe)
        voxelMap.set(key, v);
      }
    }
  }

  return Array.from(voxelMap.values());
}

// --- Tiny dev tests (manual) -------------------------------------------------

export function devTest_boxSizeCounts(): void {
  const spec: VoxelSpec = {
    version: 1,
    bounds: {
      origin: { x: 0, y: 0, z: 0 },
      size: { x: 4, y: 3, z: 2 },
    },
    palette: {
      colors: [{ id: "c", hex: "#ffffff" }],
    },
    commands: [
      {
        op: "box",
        from: { x: 0, y: 0, z: 0 },
        to: { x: 3, y: 2, z: 1 },
        color: { kind: "palette", id: "c" },
      },
    ],
  };

  const voxels = rasterize(spec);
  const expected = 4 * 3 * 2;
  // eslint-disable-next-line no-console
  console.log("devTest_boxSizeCounts", voxels.length, "expected", expected);
}

export function devTest_overlappingBoxesDedupe(): void {
  const spec: VoxelSpec = {
    version: 1,
    bounds: {
      origin: { x: 0, y: 0, z: 0 },
      size: { x: 4, y: 1, z: 2 },
    },
    palette: {
      colors: [
        { id: "a", hex: "#ff0000" },
        { id: "b", hex: "#00ff00" },
      ],
    },
    commands: [
      {
        op: "box",
        from: { x: 0, y: 0, z: 0 },
        to: { x: 3, y: 0, z: 1 },
        color: { kind: "palette", id: "a" },
      },
      {
        op: "box",
        from: { x: 2, y: 0, z: 0 },
        to: { x: 3, y: 0, z: 1 },
        color: { kind: "palette", id: "b" },
      },
    ],
  };

  const voxels = rasterize(spec);
  const expectedUnique = 4 * 2;
  // eslint-disable-next-line no-console
  console.log(
    "devTest_overlappingBoxesDedupe",
    voxels.length,
    "expected unique",
    expectedUnique
  );
}

export function devTest_capEnforcement(): void {
  const spec: VoxelSpec = {
    version: 1,
    bounds: {
      origin: { x: 0, y: 0, z: 0 },
      size: { x: 10, y: 10, z: 10 },
    },
    palette: {
      colors: [{ id: "c", hex: "#ffffff" }],
    },
    commands: [
      {
        op: "box",
        from: { x: 0, y: 0, z: 0 },
        to: { x: 9, y: 9, z: 9 },
        color: { kind: "palette", id: "c" },
      },
    ],
  };

  try {
    rasterize(spec, { maxVoxels: 50 });
    // eslint-disable-next-line no-console
    console.log("devTest_capEnforcement", "unexpected success");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(
      "devTest_capEnforcement",
      "caught",
      err instanceof Error ? err.message : err
    );
  }
}


