"use client";

import { useEffect } from "react";
import { useVoxelStore } from "../store/voxelStore";

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

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-zinc-400">
        Voxels: <strong className="text-zinc-200">{count}</strong>
      </span>
      <button
        type="button"
        onClick={() => addVoxel(2, 0, 0)}
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
