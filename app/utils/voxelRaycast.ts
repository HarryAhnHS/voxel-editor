/**
 * Utilities for voxel raycasting and coordinate math.
 * Handles robust coordinate rounding and face normal calculations.
 */

import * as THREE from "three";
import type { VoxelPosition } from "../store/voxelStore";
import { keyFromXYZ, isWithinBounds } from "../store/voxelStore";
import { BOUNDS_MIN, BOUNDS_MAX } from "../store/voxelConstraints";

/**
 * Rounds a world position to the nearest integer voxel coordinate.
 * Uses Math.round for symmetric rounding (0.5 → 1, -0.5 → -1).
 */
export function worldToVoxelCoord(worldPos: number): number {
  return Math.round(worldPos);
}

/**
 * Converts a THREE.Vector3 world position to voxel coordinates.
 */
export function worldToVoxelPosition(worldPos: THREE.Vector3): VoxelPosition {
  return [
    worldToVoxelCoord(worldPos.x),
    worldToVoxelCoord(worldPos.y),
    worldToVoxelCoord(worldPos.z),
  ];
}

/**
 * Normalizes a face normal to one of the 6 cardinal directions.
 * Returns [x, y, z] where each component is -1, 0, or 1.
 * 
 * The normal from THREE.js intersection is already normalized, but we need
 * to snap it to the nearest cardinal direction to avoid floating point issues.
 */
export function normalizeFaceNormal(normal: THREE.Vector3): VoxelPosition {
  const [nx, ny, nz] = [normal.x, normal.y, normal.z];
  
  // Find the axis with the largest absolute component
  const absX = Math.abs(nx);
  const absY = Math.abs(ny);
  const absZ = Math.abs(nz);
  
  if (absX >= absY && absX >= absZ) {
    return [Math.sign(nx), 0, 0];
  } else if (absY >= absZ) {
    return [0, Math.sign(ny), 0];
  } else {
    return [0, 0, Math.sign(nz)];
  }
}

/**
 * Computes the adjacent voxel position from a hit voxel and face normal.
 * The adjacent position is the cell next to the hit face.
 */
export function computeAdjacentPosition(
  hitPosition: VoxelPosition,
  faceNormal: VoxelPosition
): VoxelPosition {
  return [
    hitPosition[0] + faceNormal[0],
    hitPosition[1] + faceNormal[1],
    hitPosition[2] + faceNormal[2],
  ];
}

/**
 * Computes placement candidate from raycast intersection.
 * Returns the voxel that was hit (if any) and the placement position.
 */
export interface PlacementCandidate {
  hitVoxel: VoxelPosition | null;
  placementPosition: VoxelPosition | null;
  isValid: boolean;
}

/**
 * Computes placement position from a raycast intersection with a voxel.
 * Places adjacent to the clicked face.
 */
export function computePlacementCandidate(
  intersection: THREE.Intersection | null,
  voxelArray: Array<{ position: VoxelPosition }>,
  voxelMap: Map<string, unknown>
): PlacementCandidate {
  if (!intersection || intersection.instanceId === undefined) {
    return {
      hitVoxel: null,
      placementPosition: null,
      isValid: false,
    };
  }

  const instanceId = intersection.instanceId;
  if (instanceId < 0 || instanceId >= voxelArray.length) {
    return {
      hitVoxel: null,
      placementPosition: null,
      isValid: false,
    };
  }

  const hitVoxel = voxelArray[instanceId];
  const hitPosition = hitVoxel.position;

  // Get face normal from intersection
  // For instanced meshes, THREE.js provides the normal in local geometry space
  // Since our instances are only translated (not rotated), the normal direction is correct
  if (!intersection.face || !intersection.face.normal) {
    return {
      hitVoxel: hitPosition,
      placementPosition: null,
      isValid: false,
    };
  }

  // Use the face normal directly - it's already in the correct direction
  // for our use case (instances are only translated, not rotated)
  const normal = intersection.face.normal;

  // Normalize to cardinal direction (snap to nearest axis)
  // This handles any floating-point imprecision
  const faceNormal = normalizeFaceNormal(normal);

  // Compute adjacent position
  const placementPosition = computeAdjacentPosition(hitPosition, faceNormal);

  // Validate placement position
  if (!isWithinBounds(placementPosition)) {
    return {
      hitVoxel: hitPosition,
      placementPosition: null,
      isValid: false,
    };
  }

  // Check if placement position is already occupied
  const placementKey = keyFromXYZ(
    placementPosition[0],
    placementPosition[1],
    placementPosition[2]
  );
  const isOccupied = voxelMap.has(placementKey);

  return {
    hitVoxel: hitPosition,
    placementPosition: isOccupied ? null : placementPosition,
    isValid: !isOccupied && isWithinBounds(placementPosition),
  };
}

/**
 * Finds the nearest grid cell along a ray that's within bounds.
 * Uses the ray's intersection with the bounding box to find a valid placement point.
 */
export function findNearestGridCellAlongRay(
  ray: THREE.Ray,
  maxDistance: number = 1000
): VoxelPosition | null {
  const [minX, minY, minZ] = BOUNDS_MIN;
  const [maxX, maxY, maxZ] = BOUNDS_MAX;

  // Create bounding box from bounds
  // THREE.Box3 uses inclusive min and exclusive max
  // So we need max + 1 to include the max coordinate
  const box = new THREE.Box3(
    new THREE.Vector3(minX - 0.5, minY - 0.5, minZ - 0.5),
    new THREE.Vector3(maxX + 0.5, maxY + 0.5, maxZ + 0.5)
  );

  // Find intersection with bounding box
  const intersectionPoint = new THREE.Vector3();
  const hasIntersection = ray.intersectBox(box, intersectionPoint);

  if (!hasIntersection) {
    // Ray doesn't intersect bounds - try a point at a fixed distance
    const pointAtDistance = ray.origin.clone().add(
      ray.direction.clone().multiplyScalar(Math.min(50, maxDistance))
    );
    const testPos = worldToVoxelPosition(pointAtDistance);
    if (isWithinBounds(testPos)) {
      return testPos;
    }
    return null;
  }

  // Convert intersection point to grid cell
  const gridPos = worldToVoxelPosition(intersectionPoint);
  
  // Validate the position is within bounds
  if (isWithinBounds(gridPos)) {
    return gridPos;
  }

  // If the intersection point is outside bounds, try moving along the ray
  // to find the nearest valid grid cell
  const step = 0.5;
  for (let dist = 0; dist < maxDistance; dist += step) {
    const testPoint = ray.origin.clone().add(
      ray.direction.clone().multiplyScalar(dist)
    );
    const testPos = worldToVoxelPosition(testPoint);
    if (isWithinBounds(testPos)) {
      return testPos;
    }
  }

  return null;
}

/**
 * Computes placement position from a raycast intersection with empty space.
 * Uses the intersection point to determine the grid cell.
 * The intersection point is rounded to the nearest integer grid position.
 */
export function computePlacementFromEmptySpace(
  intersection: THREE.Intersection | null,
  voxelMap: Map<string, unknown>,
  ray?: THREE.Ray
): PlacementCandidate {
  let placementPosition: VoxelPosition | null = null;

  if (intersection && intersection.point) {
    // Convert intersection point to voxel coordinates
    // This rounds to the nearest integer, which gives us the grid cell
    placementPosition = worldToVoxelPosition(intersection.point);
  } else if (ray) {
    // If no intersection point but we have a ray, find nearest grid cell
    placementPosition = findNearestGridCellAlongRay(ray);
  } else {
    return {
      hitVoxel: null,
      placementPosition: null,
      isValid: false,
    };
  }

  if (!placementPosition) {
    return {
      hitVoxel: null,
      placementPosition: null,
      isValid: false,
    };
  }

  // Validate placement position - check all three axes (x, y, z)
  if (!isWithinBounds(placementPosition)) {
    return {
      hitVoxel: null,
      placementPosition: null,
      isValid: false,
    };
  }

  // Check if placement position is already occupied
  const placementKey = keyFromXYZ(
    placementPosition[0],
    placementPosition[1],
    placementPosition[2]
  );
  const isOccupied = voxelMap.has(placementKey);

  return {
    hitVoxel: null,
    placementPosition: isOccupied ? null : placementPosition,
    isValid: !isOccupied && isWithinBounds(placementPosition),
  };
}

