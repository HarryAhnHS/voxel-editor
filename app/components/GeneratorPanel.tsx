"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useVoxelStore, type Voxel } from "../store/voxelStore";
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

type GenerationMode = "text" | "code" | "function";

interface ApiResponse {
  spec?: VoxelSpec;
  error?: string;
  code?: string;
}

/**
 * Centers voxels around origin (0,0,0) by calculating bounding box center
 * and translating all voxels. Also flips Y-axis to fix upside-down structures.
 */
function centerVoxels(voxels: RasterizedVoxel[]): RasterizedVoxel[] {
  if (voxels.length === 0) return voxels;

  // Calculate bounding box
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

  // Calculate center
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  // Translate all voxels to center around origin
  // Flip Y-axis: LLM may generate with Y=0 at "top" (screen coords),
  // but Three.js uses Y-up where Y=0 is at bottom. Flip by mirroring across center.
  return voxels.map((v) => {
    // Then center
    return {
      ...v,
      x: Math.round(v.x - centerX),
      y: Math.round(v.y - centerY),
      z: Math.round(v.z - centerZ),
    };
  });
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
  const [mode, setMode] = useState<GenerationMode>("text");
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
      // Step 1: Call /api/generate
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim(), mode }),
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
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Generate from text/code (G)</TooltipContent>
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

          {/* Mode selector */}
          <div className="flex gap-1 rounded-md bg-zinc-900 p-1">
            {(["text", "code", "function"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                disabled={loading}
                className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                  mode === m
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                } disabled:opacity-50`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
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
            placeholder={
              mode === "text"
                ? 'e.g., "small modern house with flat roof"'
                : mode === "code"
                  ? 'e.g., "width: 16, height: 8"'
                  : 'e.g., "makeHouse({ stories: 2 })"'
            }
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
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3 w-3" />
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

