"use client";

import { useRef } from "react";
import * as THREE from "three";
import type { VoxelPosition } from "../store/voxelStore";

interface GhostCubeProps {
  position: VoxelPosition | null;
  visible: boolean;
  color: number;
}

/**
 * Ghost cube preview for placement target.
 * Rendered as a separate mesh (not instanced) so it doesn't trigger
 * instance buffer rebuilds. Uses a semi-transparent material with outline.
 */
export function GhostCube({ position, visible, color }: GhostCubeProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  if (!visible || !position) {
    return null;
  }

  const [x, y, z] = position;

  return (
    <mesh ref={meshRef} position={[x, y, z]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.3}
        emissive={color}
        emissiveIntensity={0.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

