"use client";

import { useState, useCallback } from "react";
import { useVoxelStore, type Voxel } from "../store/voxelStore";

/**
 * Dev-only stress test: fills scene with ~1000 voxels for performance validation.
 * Generates a dense 10x10x10 cube pattern with varied colors.
 */
function fillTestScene(): Voxel[] {
  const voxels: Voxel[] = [];

  // Generate a 10x10x10 cube (1000 voxels) centered at origin for visibility
  const size = 10;
  const offsetX = 0;
  const offsetY = 0;
  const offsetZ = 0;

  const colors = [
    0x88ccff, 0xff8888, 0x88ff88, 0xffff88, 0xff88ff, 0x88ffff, 0xffffff,
    0xcc88ff, 0xffcc88, 0x88cc88,
  ];

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const posX = offsetX + x;
        const posY = offsetY + y;
        const posZ = offsetZ + z;

        // Vary color based on position for visual interest
        const colorIndex = (x + y + z) % colors.length;
        voxels.push({
          position: [posX, posY, posZ],
          color: colors[colorIndex],
        });
      }
    }
  }

  return voxels;
}

/**
 * Dev-only stress test component for performance validation.
 * Shows voxel count and provides button to fill scene with ~1000 voxels.
 */
export function StressTest() {
  const applyVoxels = useVoxelStore((s) => s.applyVoxels);
  const [isFilling, setIsFilling] = useState(false);
  const [fillTime, setFillTime] = useState<number | null>(null);

  const handleFillTest = useCallback(() => {
    setIsFilling(true);
    const startTime = performance.now();

    const testVoxels = fillTestScene();
    const applied = applyVoxels(testVoxels);

    const endTime = performance.now();
    setFillTime(endTime - startTime);
    setIsFilling(false);

    // Quick sanity check
    console.log(`[Stress Test] Applied ${applied} voxels in ${(endTime - startTime).toFixed(2)}ms`);
  }, [applyVoxels]);

  // Only show in dev mode
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {fillTime !== null && (
        <span className="text-zinc-500">
          Fill: <strong className="text-zinc-300">{fillTime.toFixed(0)}ms</strong>
        </span>
      )}
      <button
        type="button"
        onClick={handleFillTest}
        disabled={isFilling}
        className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 text-xs"
      >
        {isFilling ? "Filling..." : "Fill Test"}
      </button>
    </div>
  );
}

