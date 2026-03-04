"use client";

import { useState, useEffect } from "react";
import { useVoxelStore, type Voxel } from "../store/voxelStore";
import { BOUNDS_MIN, BOUNDS_MAX } from "../store/voxelConstraints";
import { rasterize, type RasterizedVoxel } from "../lib/rasterize";
import type { VoxelSpec } from "@/types/voxelSpec";
import { Button } from "./ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "./ui/popover";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "./ui/tooltip";
import { LuBot } from "react-icons/lu";

interface ApiResponse {
  spec?: VoxelSpec;
  error?: string;
  code?: string;
}

/**
 * Recenters the structure (tree, building, etc.) as much as possible within
 * the global editor bounds. Uses an integer shift so no per-voxel rounding.
 * If the structure fits, it is centered at the origin; if it is too large, the
 * shift is clamped so it stays in bounds and is still centered as much as possible.
 */
function centerVoxels(voxels: RasterizedVoxel[]): RasterizedVoxel[] {
  if (voxels.length === 0) return voxels;

  const [worldMinX, worldMinY, worldMinZ] = BOUNDS_MIN;
  const [worldMaxX, worldMaxY, worldMaxZ] = BOUNDS_MAX;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const v of voxels) {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    minZ = Math.min(minZ, v.z);
    maxX = Math.max(maxX, v.x);
    maxY = Math.max(maxY, v.y);
    maxZ = Math.max(maxZ, v.z);
  }

  const sizeX = maxX - minX + 1;
  const sizeY = maxY - minY + 1;
  const sizeZ = maxZ - minZ + 1;

  // Ideal target: bbox centered at origin (or -0.5 for even size).
  const targetMinX = -Math.floor(sizeX / 2);
  const targetMinY = -Math.floor(sizeY / 2);
  const targetMinZ = -Math.floor(sizeZ / 2);

  const idealShiftX = minX - targetMinX;
  const idealShiftY = minY - targetMinY;
  const idealShiftZ = minZ - targetMinZ;

  // Clamp shift so the translated bbox stays inside world bounds; prefer ideal (centered) when it fits.
  const shiftX = Math.max(maxX - worldMaxX, Math.min(minX - worldMinX, idealShiftX));
  const shiftY = Math.max(maxY - worldMaxY, Math.min(minY - worldMinY, idealShiftY));
  const shiftZ = Math.max(maxZ - worldMaxZ, Math.min(minZ - worldMinZ, idealShiftZ));

  return voxels.map((v) => ({
    ...v,
    x: v.x - shiftX,
    y: v.y - shiftY,
    z: v.z - shiftZ,
  }));
}

/**
 * Converts RasterizedVoxel[] (from rasterizer) to Voxel[] (for store).
 */
function convertRasterizedToVoxels(
  rasterized: RasterizedVoxel[]
): Voxel[] {
  return rasterized.map((v) => {
    // Convert hex string "#RRGGBB" to number 0xRRGGBB
    const hex = v.color.replace("#", "");
    const color = parseInt(hex, 16);
    return {
      position: [v.x, v.y, v.z],
      color,
    };
  });
}

export function GeneratorPanel() {
  const applyVoxels = useVoxelStore((state) => state.applyVoxels);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [open, setOpen] = useState(false);

  const canGenerate = input.trim().length > 0 && !loading && !cooldown;

  // Keyboard shortcut: G to open generator
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === "g" || event.key === "G") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setLoading(true);
    setError(null);
    setOpen(false); // Close popover during generation

    try {
      // Step 1: Call /api/generate with natural language input only
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });

      const data: ApiResponse = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (!data.spec) {
        throw new Error("No spec returned from API");
      }

      // Step 2: Run rasterize(spec) client-side
      let rasterized = rasterize(data.spec);

      // Step 2.5: Center voxels around origin and fix Y-axis orientation
      rasterized = centerVoxels(rasterized);

      // Step 3: Convert to store format and apply
      const voxels = convertRasterizedToVoxels(rasterized);
      const applied = applyVoxels(voxels);

      if (applied === 0) {
        setError("Generated voxels were all out of bounds or exceeded cap");
      } else {
        // Success: clear input and show cooldown
        setInput("");
        setCooldown(true);
        setTimeout(() => setCooldown(false), 1000);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(message);
    } finally {
      setLoading(false);
      setOpen(true); // Reopen to show result/error
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Generate voxels"
              disabled={loading}
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin border border-zinc-500 rounded-full border-t-transparent" />
              ) : (
                <LuBot className="h-4 w-4" />
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Generate from text (G)</TooltipContent>
      </Tooltip>

      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-zinc-300">
              Generate Voxels
            </h3>
            {cooldown && (
              <span className="text-[10px] text-zinc-500">Cooldown...</span>
            )}
          </div>

          {/* Input textarea */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canGenerate) {
                e.preventDefault();
                handleGenerate();
              }
            }}
            placeholder='e.g., "tree with spherical leaves and a cylindrical trunk on a grass of green"'
            disabled={loading}
            className="h-24 w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 disabled:opacity-50"
          />

          {/* Error display */}
          {error && (
            <div className="rounded-md bg-red-950/50 border border-red-800/50 px-2.5 py-2">
              <p className="text-[11px] text-red-300">{error}</p>
            </div>
          )}

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate}
            variant="primary"
            size="sm"
            className="w-full"
          >
            {loading ? (
              <>
                <span className="mr-1.5 h-3 w-3 inline-block animate-spin border border-zinc-500 rounded-full border-t-transparent" />
                Generating...
              </>
            ) : (
              <>
                <LuBot className="mr-1.5 h-3 w-3" />
                Generate
              </>
            )}
          </Button>

          <p className="text-[10px] text-zinc-500">
            Press Ctrl+Enter to generate
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

