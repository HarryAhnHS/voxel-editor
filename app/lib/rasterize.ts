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
      const fromX = cmd.area ? cmd.area.from.x + bounds.origin.x : bounds.origin.x;
      const toX = cmd.area ? cmd.area.to.x + bounds.origin.x : bounds.origin.x + bounds.size.x - 1;
      const fromZ = cmd.area ? cmd.area.from.z + bounds.origin.z : bounds.origin.z;
      const toZ = cmd.area ? cmd.area.to.z + bounds.origin.z : bounds.origin.z + bounds.size.z - 1;

      const from = clampVec3({ x: fromX, y, z: fromZ }, min, max);
      const to = clampVec3({ x: toX, y, z: toZ }, min, max);
      if (from.x > to.x || from.z > to.z) return [];

      const voxels: RasterizedVoxel[] = [];
      for (let x = from.x; x <= to.x; x++) {
        for (let z = from.z; z <= to.z; z++) {
          voxels.push({ x, y: from.y, z, color });
        }
      }
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

  for (const cmd of spec.commands as VoxelCommand[]) {
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


