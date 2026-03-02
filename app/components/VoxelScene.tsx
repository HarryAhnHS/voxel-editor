 "use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo } from "react";
import { VoxelInstances } from "./VoxelInstances";

function SceneContents() {
  const gridConfig = useMemo(
    () => ({
      size: 40,
      divisions: 40,
      colorCenterLine: 0x555555,
      colorGrid: 0x333333,
    }),
    []
  );

  return (
    <>
      {/* Basic lighting that feels good for blocks */}
      <ambientLight intensity={0.4} />
      <directionalLight
        intensity={1}
        position={[6, 8, 4]}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <hemisphereLight
        skyColor={0xb1e1ff}
        groundColor={0x111111}
        intensity={0.4}
      />

      {/* Ground grid to anchor the scene */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <gridHelper
        args={[
          gridConfig.size,
          gridConfig.divisions,
          gridConfig.colorCenterLine,
          gridConfig.colorGrid,
        ]}
      />

      {/* Instanced voxel renderer - only rebuilds when voxelMap changes */}
      <VoxelInstances />
    </>
  );
}

export function VoxelScene() {
  return (
    <div className="absolute inset-0 bg-neutral-950">
      <Canvas
        camera={{ position: [10, 10, 10], fov: 45, near: 0.1, far: 1000 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
        style={{ width: "100%", height: "100%" }}
      >
        <color attach="background" args={["#020617"]} />
        <SceneContents />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={4}
          maxDistance={60}
          maxPolarAngle={Math.PI * 0.495}
          screenSpacePanning={false}
        />
      </Canvas>
    </div>
  );
}


