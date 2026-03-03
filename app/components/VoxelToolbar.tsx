"use client";

import { useEffect, useState } from "react";
import { Pencil, Move3D, Layers, RefreshCw, Trash2, Wrench } from "lucide-react";
import { useVoxelStore, BOUNDS_MIN, BOUNDS_MAX } from "../store/voxelStore";
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
  TooltipProvider,
} from "./ui/tooltip";
import { Separator } from "./ui/separator";
import { GeneratorPanel } from "./GeneratorPanel";

const COLOR_PRESETS = [
  0x88ccff,
  0xff6b6b,
  0x4ecdc4,
  0x45b7d1,
  0xffa07a,
  0x98d8c8,
  0xf7dc6f,
  0xbb8fce,
  0x85c1e2,
  0xf8c471,
  0x82e0aa,
  0xf1948a,
  0xffffff,
  0x34495e,
  0x000000,
];

interface VoxelToolbarProps {
  onResetView?: () => void;
}

export function VoxelToolbar({ onResetView }: VoxelToolbarProps) {
  const tool = useVoxelStore((state) => state.tool);
  const selectedColor = useVoxelStore((state) => state.selectedColor);
  const editMode = useVoxelStore((state) => state.editMode);
  const activeLayerY = useVoxelStore((state) => state.activeLayerY);
  const showLayerAxis = useVoxelStore((state) => state.showLayerAxis);
  const showDevTools = useVoxelStore((state) => state.showDevTools);
  const setTool = useVoxelStore((state) => state.setTool);
  const setColor = useVoxelStore((state) => state.setColor);
  const setEditMode = useVoxelStore((state) => state.setEditMode);
  const setActiveLayerY = useVoxelStore((state) => state.setActiveLayerY);
  const incrementLayer = useVoxelStore((state) => state.incrementLayer);
  const decrementLayer = useVoxelStore((state) => state.decrementLayer);
  const toggleLayerAxis = useVoxelStore((state) => state.toggleLayerAxis);
  const toggleDevTools = useVoxelStore((state) => state.toggleDevTools);
  const clear = useVoxelStore((state) => state.clear);

  const [colorOpen, setColorOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key) {
        case "a":
        case "A": {
          event.preventDefault();
          setTool("pencil");
          setEditMode("add");
          break;
        }
        case "d":
        case "D": {
          event.preventDefault();
          setTool("pencil");
          setEditMode("remove");
          break;
        }
        case "m":
        case "M": {
          event.preventDefault();
          setTool("move");
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          incrementLayer();
          break;
        }
        case "ArrowDown": {
          event.preventDefault();
          decrementLayer();
          break;
        }
        case "h":
        case "H": {
          event.preventDefault();
          toggleLayerAxis();
          break;
        }
        case "c":
        case "C": {
          event.preventDefault();
          setColorOpen((open) => !open);
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setTool, setEditMode, incrementLayer, decrementLayer, toggleLayerAxis]);

  const [minY] = BOUNDS_MIN;
  const [maxY] = BOUNDS_MAX;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/90 px-2.5 py-1.5 shadow-lg backdrop-blur-sm">
          {/* Add / Remove / Move */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={
                  tool === "pencil" && editMode === "add" ? "primary" : "ghost"
                }
                size="icon"
                onClick={() => {
                  setTool("pencil");
                  setEditMode("add");
                }}
                aria-label="Add voxels"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add (A)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={
                  tool === "pencil" && editMode === "remove" ? "primary" : "ghost"
                }
                size="icon"
                onClick={() => {
                  setTool("pencil");
                  setEditMode("remove");
                }}
                aria-label="Remove voxels"
              >
                <Pencil className="h-4 w-4 rotate-180" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove (D)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={tool === "move" ? "primary" : "ghost"}
                size="icon"
                onClick={() => setTool("move")}
                aria-label="Move camera"
              >
                <Move3D className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move camera (M)</TooltipContent>
          </Tooltip>

          <Separator />

          {/* Reference plane */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={showLayerAxis ? "primary" : "ghost"}
                    size="icon"
                    aria-label="Reference plane"
                  >
                    <Layers className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="start">
                  <div className="mb-2 text-xs font-medium text-zinc-300">
                    Reference plane
                  </div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-zinc-400">
                      Layer Y:{" "}
                      <span className="font-semibold text-zinc-200">
                        {activeLayerY}
                      </span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="subtle"
                        onClick={decrementLayer}
                      >
                        −
                      </Button>
                      <Button
                        size="sm"
                        variant="subtle"
                        onClick={incrementLayer}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={minY}
                    max={maxY}
                    value={activeLayerY}
                    onChange={(e) => setActiveLayerY(Number(e.target.value))}
                    className="mt-1 w-full cursor-pointer accent-zinc-200"
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">
                      Show grid on layer
                    </span>
                    <Button
                      size="sm"
                      variant={showLayerAxis ? "primary" : "subtle"}
                      onClick={toggleLayerAxis}
                    >
                      {showLayerAxis ? "Visible" : "Hidden"}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </TooltipTrigger>
            <TooltipContent>Reference plane (↑ / ↓, H)</TooltipContent>
          </Tooltip>

          {/* Color */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Popover open={colorOpen} onOpenChange={setColorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Color"
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-zinc-500"
                      style={{
                        backgroundColor: `#${selectedColor
                          .toString(16)
                          .padStart(6, "0")}`,
                      }}
                    />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="start">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-300">
                      Color
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      #{selectedColor.toString(16).padStart(6, "0")}
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {COLOR_PRESETS.map((color) => {
                      const hex = `#${color.toString(16).padStart(6, "0")}`;
                      const isActive = selectedColor === color;
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setColor(color)}
                          className={`h-6 w-6 rounded-full border transition-all ${
                            isActive
                              ? "border-zinc-50 ring-2 ring-zinc-50/70"
                              : "border-zinc-700 hover:border-zinc-400"
                          }`}
                          style={{ backgroundColor: hex }}
                          aria-label={`Color ${hex}`}
                        />
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </TooltipTrigger>
            <TooltipContent>Color (C)</TooltipContent>
          </Tooltip>

          <Separator />

          {/* Generator */}
          <GeneratorPanel />

          <Separator />

          {/* Dev tools toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showDevTools ? "primary" : "ghost"}
                size="icon"
                onClick={toggleDevTools}
                aria-label="Developer tools"
              >
                <Wrench className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Developer tools</TooltipContent>
          </Tooltip>

          <Separator />

          {/* Reset view + clear scene */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onResetView?.()}
                aria-label="Reset view"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset view (R)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={clear}
                aria-label="Clear scene"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear scene</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
