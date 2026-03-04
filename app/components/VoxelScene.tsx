"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useRef, useCallback, useEffect } from "react";
import * as THREE from "three";
import { VoxelInstances, MeshRefContext } from "./VoxelInstances";
import { VoxelInteraction } from "./VoxelInteraction";
import { VoxelToolbar } from "./VoxelToolbar";
import { useVoxelStore, BOUNDS_MIN, BOUNDS_MAX } from "../store/voxelStore";
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
    () => {
      return {
        // Slightly larger than the editable bounds so the grid feels continuous,
        // but keep colors subtle so it stays in the background.
        size: 44,
        divisions: 44,
        // Softer center line and very low-contrast grid lines.
        colorCenterLine: 0x6b7280, // zinc-500
        colorGrid: 0x27272a, // zinc-800
      };
    },
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

      {/* Work plane grid + bounds axes guides */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      {showLayerAxis && (
        <>
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
          <BoundsAxes />
        </>
      )}

      {/* Instanced voxel renderer - only rebuilds when voxelMap changes */}
      <VoxelInstances />

      {/* Interaction handler for raycasting and hover preview */}
      <VoxelInteraction />
    </MeshRefContext.Provider>
  );
}

function BoundsAxes() {
  const [minX, minY, minZ] = BOUNDS_MIN;
  const [maxX, maxY, maxZ] = BOUNDS_MAX;

  // Lines along X, Y, Z spanning full bounds in both directions
  const vertices = new Float32Array([
    // X axis
    minX, 0, 0,
    maxX, 0, 0,
    // Y axis
    0, minY, 0,
    0, maxY, 0,
    // Z axis
    0, 0, minZ,
    0, 0, maxZ,
  ]);

  const colors = new Float32Array([
    // X axis (reddish)
    1.0, 0.4, 0.4,
    1.0, 0.4, 0.4,
    // Y axis (greenish)
    0.4, 1.0, 0.6,
    0.4, 1.0, 0.6,
    // Z axis (bluish)
    0.4, 0.7, 1.0,
    0.4, 0.7, 1.0,
  ]);

  return (
    // eslint-disable-next-line react/no-unknown-property
    <lineSegments>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <bufferGeometry>
        {/* eslint-disable-next-line react/no-unknown-property */}
        <bufferAttribute
          attach="attributes-position"
          args={[vertices, 3]}
        />
        {/* eslint-disable-next-line react/no-unknown-property */}
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <lineBasicMaterial vertexColors transparent opacity={0.7} />
    </lineSegments>
  );
}

function CoordinateOverlay() {
  const pointer = useVoxelStore((state) => state.pointerPosition);
  const planeAxis = useVoxelStore((state) => state.planeAxis);
  const activeLayerY = useVoxelStore((state) => state.activeLayerY);

  if (!pointer) return null;

  const [x, y, z] = pointer;

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-10">
      <div className="pointer-events-auto inline-flex items-center gap-3 rounded-lg border border-zinc-800/60 bg-zinc-950/85 px-3 py-1.5 text-[11px] text-zinc-200 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2 font-mono">
          <span className="flex items-center gap-1">
            <span className="text-red-400">X</span>
            <span>{x}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-emerald-400">Y</span>
            <span>{y}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-sky-400">Z</span>
            <span>{z}</span>
          </span>
        </div>
        <Separator orientation="vertical" className="h-4 bg-zinc-700/70" />
        <div className="text-[10px] text-zinc-400">
          Plane <span className="font-semibold text-zinc-200">{planeAxis.toUpperCase()}</span>{" "}
          · Layer <span className="font-semibold text-zinc-200">{activeLayerY}</span>
        </div>
      </div>
    </div>
  );
}

export function VoxelScene() {
  const controlsRef = useRef<any>(null);
  const showDevTools = useVoxelStore((state) => state.showDevTools);
  const backgroundColor = useVoxelStore((state) => state.backgroundColor);

  const setActiveLayerY = useVoxelStore((state) => state.setActiveLayerY);
  const setPlaneAxis = useVoxelStore((state) => state.setPlaneAxis);

  const handleResetView = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Reset camera position and target to the initial centered view
    controls.target.set(0, 0, 0);
    controls.object.position.set(10, 10, 10);
    controls.update();
    
    // Reset grid to default position
    setActiveLayerY(0);
    setPlaneAxis("y");
  }, [setActiveLayerY, setPlaneAxis]);

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
    <div className="absolute inset-0" style={{ backgroundColor: `#${backgroundColor.toString(16).padStart(6, "0")}` }}>
      {/* Toolbar */}
      <VoxelToolbar onResetView={handleResetView} />

      {/* Developer tools overlay */}
      {showDevTools && (
        <div className="pointer-events-none absolute top-4 right-4 z-10 max-w-[calc(100vw-2rem)]">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800/50 bg-zinc-950/80 px-2 py-1.5 text-xs text-zinc-300 shadow-lg backdrop-blur-md sm:flex-nowrap sm:gap-2 sm:px-2">
            <FPSCounter />
            <Separator className="hidden sm:block" />
            <VoxelStoreExample />
            <Separator className="hidden sm:block" />
            <StressTest />
          </div>
        </div>
      )}

      <CoordinateOverlay />

      <Canvas
        camera={{ position: [10, 10, 10], fov: 45, near: 0.1, far: 1000 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
        style={{ width: "100%", height: "100%" }}
      >
        <color attach="background" args={[`#${backgroundColor.toString(16).padStart(6, "0")}`]} />
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


