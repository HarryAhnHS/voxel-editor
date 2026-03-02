"use client";

import { useEffect, useCallback } from "react";
import { useVoxelStore, keyFromXYZ } from "../store/voxelStore";

/**
 * Minimal example: subscribes to voxels, applies a batch on mount,
 * shows count and clear. Demonstrates store usage.
 */
export function VoxelStoreExample() {
  const voxels = useVoxelStore((s) => s.voxels);
  const clear = useVoxelStore((s) => s.clear);
  const addVoxel = useVoxelStore((s) => s.addVoxel);

  const count = voxels.size;

  // Batch apply on mount (e.g. from a generator)
  useEffect(() => {
    useVoxelStore.getState().applyVoxels([
      { position: [0, 0, 0], color: 0x88ccff },
      { position: [1, 0, 0], color: 0xff8888 },
      { position: [0, 1, 0], color: 0x88ff88 },
      { position: [0, 0, 1], color: 0xffffff },
    ]);
  }, []);

  // Find next available position and add a voxel there
  const handleAddOne = useCallback(() => {
    const currentVoxels = useVoxelStore.getState().voxels;
    // Start from a reasonable position and search for an empty spot
    let x = 2;
    let y = 0;
    let z = 0;
    let attempts = 0;
    const maxAttempts = 1000;

    while (attempts < maxAttempts) {
      const key = keyFromXYZ(x, y, z);
      if (!currentVoxels.has(key)) {
        addVoxel(x, y, z);
        return;
      }
      // Try next position in a simple pattern
      x++;
      if (x > 20) {
        x = 2;
        y++;
        if (y > 20) {
          y = 0;
          z++;
          if (z > 20) {
            z = 0;
          }
        }
      }
      attempts++;
    }
  }, [addVoxel]);

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-zinc-400">
        Voxels: <strong className="text-zinc-200">{count}</strong>
      </span>
      <button
        type="button"
        onClick={handleAddOne}
        className="rounded border border-zinc-700 px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      >
        +1
      </button>
      <button
        type="button"
        onClick={() => clear()}
        className="rounded border border-zinc-700 px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      >
        Clear
      </button>
    </div>
  );
}
