/**
 * Shared guardrails for voxel editor and generator (SPEC 2.4, ARCHITECTURE 4.1).
 * Used by: voxelStore (enforcement), rasterizer (validation/filtering when added).
 */

import type { VoxelPosition } from "./voxelStore";

/** Max extent per axis (e.g. 0..99 = 100 units). */
export const BOUNDS_SIZE = 100;

/** Inclusive min position [0, 0, 0]. */
export const BOUNDS_MIN: VoxelPosition = [0, 0, 0];

/** Inclusive max position [BOUNDS_SIZE-1, BOUNDS_SIZE-1, BOUNDS_SIZE-1]. */
export const BOUNDS_MAX: VoxelPosition = [
  BOUNDS_SIZE - 1,
  BOUNDS_SIZE - 1,
  BOUNDS_SIZE - 1,
];

/** Hard cap on total voxel count (SPEC: "Maximum voxel count"). */
export const MAX_VOXEL_COUNT = 2000;

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
