 "use client";

import dynamic from "next/dynamic";

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
      <main className="flex flex-1 flex-col">
        <div className="relative flex-1">
          <VoxelScene />
        </div>
      </main>
    </div>
  );
}

