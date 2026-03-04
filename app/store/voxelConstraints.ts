/**
 * Shared guardrails for voxel editor and generator (SPEC 2.4, ARCHITECTURE 4.1).
 * Used by: voxelStore (enforcement), rasterizer (validation/filtering when added).
 */

import type { VoxelPosition } from "./voxelStore";

/** Max extent per axis (100 units total, centered around origin). */
export const BOUNDS_SIZE = 50;

/** Half-size for centering bounds around origin. */
const BOUNDS_HALF = Math.floor(BOUNDS_SIZE / 2);

/** Inclusive min position [-50, -50, -50] (centered around origin). */
export const BOUNDS_MIN: VoxelPosition = [
  -BOUNDS_HALF + 1,
  -BOUNDS_HALF + 1,
  -BOUNDS_HALF + 1,
];

/** Inclusive max position [19, 19, 19] (centered around origin). */
export const BOUNDS_MAX: VoxelPosition = [
  BOUNDS_HALF -1,
  BOUNDS_HALF -1,
  BOUNDS_HALF -1,
];

/** Hard cap on total voxel count (SPEC: "Maximum voxel count"). 40³=64k cells; 8k allows ~12% fill. */
export const MAX_VOXEL_COUNT = 8000;

export function isWithinBounds([x, y, z]: VoxelPosition): boolean {
  const [minX, minY, minZ] = BOUNDS_MIN;
  const [maxX, maxY, maxZ] = BOUNDS_MAX;
  return (
    x >= minX &&
    x <= maxX &&
    y >= minY &&
    y <= maxY &&
    z >= minZ &&
    z <= maxZ
  );
}

/** Clamp position to bounds; returns new tuple. */
export function clampPosition([x, y, z]: VoxelPosition): VoxelPosition {
  const [minX, minY, minZ] = BOUNDS_MIN;
  const [maxX, maxY, maxZ] = BOUNDS_MAX;
  return [
    Math.min(maxX, Math.max(minX, x)),
    Math.min(maxY, Math.max(minY, y)),
    Math.min(maxZ, Math.max(minZ, z)),
  ];
}
