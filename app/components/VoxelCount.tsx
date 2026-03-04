"use client";

import { useVoxelStore } from "../store/voxelStore";

/**
 * Shows voxel count in dev tools.
 */
export function Count() {
  const voxels = useVoxelStore((s) => s.voxels);
  const count = voxels.size;

  return (
    <span className="text-zinc-400 text-xs">
      Voxels: <strong className="text-zinc-200">{count}</strong>
    </span>
  );
}
