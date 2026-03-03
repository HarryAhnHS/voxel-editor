 "use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useRef, useCallback, useEffect } from "react";
import * as THREE from "three";
import { VoxelInstances, MeshRefContext } from "./VoxelInstances";
import { VoxelInteraction } from "./VoxelInteraction";
import { VoxelToolbar } from "./VoxelToolbar";
import { useVoxelStore } from "../store/voxelStore";
import { FPSCounter } from "./FPSCounter";
import { VoxelStoreExample } from "./VoxelStoreExample";
import { StressTest } from "./StressTest";
import { Separator } from "./ui/separator";

function SceneContents() {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const activeLayerY = useVoxelStore((state) => state.activeLayerY);
  const showLayerAxis = useVoxelStore((state) => state.showLayerAxis);
  const planeAxis = useVoxelStore((state) => state.planeAxis);
  const gridConfig = useMemo(
    () => ({
      size: 40,
      divisions: 40,
      colorCenterLine: 0x555555,
      colorGrid: 0x333333,
    }),
    []
  );

  const gridPosition = useMemo<[number, number, number]>(
    () => {
      switch (planeAxis) {
        case "x":
          return [activeLayerY, 0, 0];
        case "z":
          return [0, 0, activeLayerY];
        case "y":
        default:
          return [0, activeLayerY, 0];
      }
    },
    [planeAxis, activeLayerY]
  );

  const gridRotation = useMemo<[number, number, number]>(
    () => {
      switch (planeAxis) {
        case "x":
          // YZ plane: rotate grid (initially XZ) 90° around Z
          return [0, 0, Math.PI / 2];
        case "z":
          // XY plane: rotate grid 90° around X
          return [Math.PI / 2, 0, 0];
        case "y":
        default:
          // XZ plane at constant Y
          return [0, 0, 0];
      }
    },
    [planeAxis]
  );

  return (
    <MeshRefContext.Provider value={meshRef}>
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
        groundColor={0x111111}
        intensity={0.4}
      />

      {/* Work plane grid at active layer Y */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      {showLayerAxis && (
        <gridHelper
          position={gridPosition}
          rotation={gridRotation}
          args={[
            gridConfig.size,
            gridConfig.divisions,
            gridConfig.colorCenterLine,
            gridConfig.colorGrid,
          ]}
        />
      )}

      {/* Instanced voxel renderer - only rebuilds when voxelMap changes */}
      <VoxelInstances />

      {/* Interaction handler for raycasting and hover preview */}
      <VoxelInteraction />
    </MeshRefContext.Provider>
  );
}

export function VoxelScene() {
  const controlsRef = useRef<any>(null);
  const showDevTools = useVoxelStore((state) => state.showDevTools);

  const handleResetView = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Reset camera position and target to the initial centered view
    controls.target.set(0, 0, 0);
    controls.object.position.set(10, 10, 10);
    controls.update();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore when typing in inputs/textareas
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        handleResetView();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleResetView]);

  return (
    <div className="absolute inset-0 bg-neutral-950">
      {/* Toolbar */}
      <VoxelToolbar onResetView={handleResetView} />

      {/* Developer tools overlay */}
      {showDevTools && (
        <div className="pointer-events-none absolute top-4 right-4 z-10">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-1.5 text-xs text-zinc-300 shadow-lg backdrop-blur-sm">
            <FPSCounter />
            <Separator />
            <VoxelStoreExample />
            <Separator />
            <StressTest />
          </div>
        </div>
      )}

      <Canvas
        camera={{ position: [10, 10, 10], fov: 45, near: 0.1, far: 1000 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
        style={{ width: "100%", height: "100%" }}
      >
        <color attach="background" args={["#020617"]} />
        <SceneContents />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={4}
          maxDistance={60}
          maxPolarAngle={360}
          screenSpacePanning={true}
        />
      </Canvas>
    </div>
  );
}


