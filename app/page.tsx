 "use client";

import dynamic from "next/dynamic";
import { VoxelStoreExample } from "./components/VoxelStoreExample";

const VoxelScene = dynamic(
  () => import("./components/VoxelScene").then((m) => m.VoxelScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
        Loading scene…
      </div>
    ),
  }
);

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      <header className="flex h-12 items-center gap-3 border-b border-zinc-800 px-4 text-sm sm:h-14 sm:px-6">
        <div className="font-semibold tracking-tight">Cedar Voxel Editor</div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span>Scene</span>
          <span className="h-4 w-px bg-zinc-700" />
          <span>Foundation</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
          <VoxelStoreExample />
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <div className="relative flex-1">
          <VoxelScene />
        </div>
      </main>
    </div>
  );
}

