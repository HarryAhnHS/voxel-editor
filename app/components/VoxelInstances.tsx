"use client";

import { useRef, useEffect, useMemo, createContext, useContext, useCallback } from "react";
import * as THREE from "three";
import { useVoxelStore, type Voxel } from "../store/voxelStore";

// Shared geometry for all voxel instances
const voxelGeometry = new THREE.BoxGeometry(1, 1, 1);

// Material for per-instance coloring via instanceColor attribute
const voxelMaterial = new THREE.MeshStandardMaterial();

// Context to share mesh ref for raycasting

const MeshRefContext = createContext<React.RefObject<THREE.InstancedMesh | null> | null>(null);

export function useMeshRef() {
  const ref = useContext(MeshRefContext);
  if (!ref) {
    throw new Error("useMeshRef must be used within VoxelInstances");
  }
  return ref;
}

export function VoxelInstances() {
  const contextRef = useContext(MeshRefContext);
  const internalRef = useRef<THREE.InstancedMesh>(null);
  const voxels = useVoxelStore((state) => state.voxels);

  // Convert voxelMap to ordered array for stable instanceId mapping
  // This ensures instanceId always maps to the same voxel position
  const voxelArray = useMemo(() => {
    return Array.from(voxels.values()).sort((a, b) => {
      const [ax, ay, az] = a.position;
      const [bx, by, bz] = b.position;
      if (ax !== bx) return ax - bx;
      if (ay !== by) return ay - by;
      return az - bz;
    });
  }, [voxels]);

  // Rebuild instance matrices and colors only when voxelArray changes
  useEffect(() => {
    const mesh = internalRef.current;
    if (!mesh) return;

    const count = voxelArray.length;

    // Update instance count if needed
    if (mesh.count !== count) {
      mesh.count = count;
    }

    // Early return if no voxels (avoid unnecessary work)
    if (count === 0) {
      mesh.instanceMatrix.needsUpdate = true;
      return;
    }

    // Reuse matrix and color objects to avoid allocations
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const voxel = voxelArray[i];
      const [x, y, z] = voxel.position;

      // Set position transform
      matrix.makeTranslation(x, y, z);
      mesh.setMatrixAt(i, matrix);

      // Set per-instance color (setColorAt creates instanceColor if needed)
      color.setHex(voxel.color);
      mesh.setColorAt(i, color);
    }

    // Mark attributes as needing update
    mesh.instanceMatrix.needsUpdate = true;
    // instanceColor is created by setColorAt, so it should exist after the loop
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [voxelArray]);

  // Callback ref to sync both refs
  const setMeshRef = useCallback(
    (mesh: THREE.InstancedMesh | null) => {
      internalRef.current = mesh;
      if (contextRef) {
        contextRef.current = mesh;
      }
    },
    [contextRef]
  );

  return (
    <instancedMesh
      ref={setMeshRef}
      args={[voxelGeometry, voxelMaterial, voxelArray.length]}
      frustumCulled={false}
    />
  );
}

// Export the context for use in parent components
export { MeshRefContext };

// Helper function to map instanceId to voxel position
// This is used for raycasting to identify which voxel was clicked
export function getVoxelFromInstanceId(
  instanceId: number,
  voxelArray: Voxel[]
): Voxel | null {
  if (instanceId < 0 || instanceId >= voxelArray.length) {
    return null;
  }
  return voxelArray[instanceId];
}

// Hook to get the current voxel array for raycasting
export function useVoxelArray(): Voxel[] {
  const voxels = useVoxelStore((state) => state.voxels);
  return useMemo(() => {
    return Array.from(voxels.values()).sort((a, b) => {
      const [ax, ay, az] = a.position;
      const [bx, by, bz] = b.position;
      if (ax !== bx) return ax - bx;
      if (ay !== by) return ay - by;
      return az - bz;
    });
  }, [voxels]);
}

