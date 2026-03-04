"use client";

import { useEffect, useState } from "react";
import {
  Pencil,
  Move3D,
  Layers,
  RefreshCw,
  Trash2,
  Wrench,
} from "lucide-react";
import { LuBrush, LuPaintBucket, LuEye, LuEyeOff, LuPalette, LuUndo2, LuRedo2 } from "react-icons/lu";
import { useVoxelStore, BOUNDS_MIN, BOUNDS_MAX, type PlaneAxis } from "../store/voxelStore";
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
import { ColorPicker } from "./ui/color-picker";

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
  const planeAxis = useVoxelStore((state) => state.planeAxis);
  const setTool = useVoxelStore((state) => state.setTool);
  const setColor = useVoxelStore((state) => state.setColor);
  const setEditMode = useVoxelStore((state) => state.setEditMode);
  const setActiveLayerY = useVoxelStore((state) => state.setActiveLayerY);
  const incrementLayer = useVoxelStore((state) => state.incrementLayer);
  const decrementLayer = useVoxelStore((state) => state.decrementLayer);
  const toggleLayerAxis = useVoxelStore((state) => state.toggleLayerAxis);
  const toggleDevTools = useVoxelStore((state) => state.toggleDevTools);
  const clear = useVoxelStore((state) => state.clear);
  const setPlaneAxis = useVoxelStore((state) => state.setPlaneAxis);
  const fillPlane = useVoxelStore((state) => state.fillPlane);
  const deletePlane = useVoxelStore((state) => state.deletePlane);
  const backgroundColor = useVoxelStore((state) => state.backgroundColor);
  const setBackgroundColor = useVoxelStore((state) => state.setBackgroundColor);
  const undo = useVoxelStore((state) => state.undo);
  const redo = useVoxelStore((state) => state.redo);
  // Only subscribe to the pieces of history we care about so we re-render minimally.
  const canUndo = useVoxelStore((state) => state.past.length > 0);
  const canRedo = useVoxelStore((state) => state.future.length > 0);

  const [colorOpen, setColorOpen] = useState(false);
  const [bgColorOpen, setBgColorOpen] = useState(false);

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
        case "b":
        case "B": {
          event.preventDefault();
          setTool("pencil");
          setEditMode("recolor");
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
          if (planeAxis === "y") {
            incrementLayer();
          }
          break;
        }
        case "ArrowDown": {
          event.preventDefault();
          if (planeAxis === "y") {
            decrementLayer();
          }
          break;
        }
        case "ArrowLeft": {
          event.preventDefault();
          if (planeAxis === "x" || planeAxis === "z") {
            decrementLayer();
          }
          break;
        }
        case "ArrowRight": {
          event.preventDefault();
          if (planeAxis === "x" || planeAxis === "z") {
            incrementLayer();
          }
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
  }, [setTool, setEditMode, incrementLayer, decrementLayer, toggleLayerAxis, setColorOpen, planeAxis]);

  const [minY] = BOUNDS_MIN;
  const [maxY] = BOUNDS_MAX;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-zinc-800/50 bg-zinc-950/80 px-2 py-1.5 shadow-lg backdrop-blur-md">
          {/* Edit tools */}
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
                variant={
                  tool === "pencil" && editMode === "recolor" ? "primary" : "ghost"
                }
                size="icon"
                onClick={() => {
                  setTool("pencil");
                  setEditMode("recolor");
                }}
                aria-label="Recolor voxels"
              >
                <LuBrush className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Brush (B)</TooltipContent>
          </Tooltip>

          {/* Undo / Redo */}
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

          {/* Undo / Redo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => undo()}
                disabled={!canUndo}
                aria-label="Undo"
              >
                <LuUndo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl/Cmd+Z)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => redo()}
                disabled={!canRedo}
                aria-label="Redo"
              >
                <LuRedo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y)</TooltipContent>
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
                <PopoverContent className="w-64 border-zinc-800/50 bg-zinc-950/95 backdrop-blur-md" align="start">
                  <div className="mb-3 text-xs font-medium text-zinc-200">
                    Reference plane
                  </div>
                  
                  {/* Plane axis selector */}
                  <div className="mb-3 space-y-2">
                    <div className="text-[11px] text-zinc-400 mb-1.5">Plane axis</div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant={planeAxis === "x" ? "primary" : "subtle"}
                        onClick={() => setPlaneAxis("x")}
                        className="flex-1 font-mono"
                      >
                        X
                      </Button>
                      <Button
                        size="sm"
                        variant={planeAxis === "y" ? "primary" : "subtle"}
                        onClick={() => setPlaneAxis("y")}
                        className="flex-1 font-mono"
                      >
                        Y
                      </Button>
                      <Button
                        size="sm"
                        variant={planeAxis === "z" ? "primary" : "subtle"}
                        onClick={() => setPlaneAxis("z")}
                        className="flex-1 font-mono"
                      >
                        Z
                      </Button>
                    </div>
                  </div>

                  {/* Layer position */}
                  <div className="mb-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400">Layer position</span>
                      <span className="font-semibold text-zinc-200">{activeLayerY}</span>
                    </div>
                    <input
                      type="range"
                      min={minY}
                      max={maxY}
                      value={activeLayerY}
                      onChange={(e) => setActiveLayerY(Number(e.target.value))}
                      className="w-full h-1.5 cursor-pointer accent-zinc-400 bg-zinc-800 rounded-lg appearance-none"
                    />
                  </div>

                  {/* Show grid & axes toggle */}
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                      {showLayerAxis ? (
                        <LuEye className="h-3.5 w-3.5" />
                      ) : (
                        <LuEyeOff className="h-3.5 w-3.5" />
                      )}
                      <span>Grid & axes</span>
                    </div>
                    <Button
                      size="sm"
                      variant={showLayerAxis ? "primary" : "subtle"}
                      onClick={toggleLayerAxis}
                    >
                      {showLayerAxis ? "On" : "Off"}
                    </Button>
                  </div>
                  
                  {/* Plane operations */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-medium text-zinc-200 mb-2">Operations</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="subtle"
                        onClick={() => fillPlane()}
                        className="justify-start"
                      >
                        <LuPaintBucket className="h-3.5 w-3.5 mr-1.5" />
                        Fill
                      </Button>
                      <Button
                        size="sm"
                        variant="subtle"
                        onClick={() => deletePlane()}
                        className="justify-start"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </TooltipTrigger>
            <TooltipContent>Reference plane (↑ / ↓, H)</TooltipContent>
          </Tooltip>

          {/* Voxel color */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Popover open={colorOpen} onOpenChange={setColorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Voxel color"
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
                <PopoverContent className="w-80 border-zinc-800/50 bg-zinc-950/95 backdrop-blur-md" align="start">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-zinc-200">Voxel Color</span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        #{selectedColor.toString(16).padStart(6, "0").toUpperCase()}
                      </span>
                    </div>
                    <ColorPicker
                      color={`#${selectedColor.toString(16).padStart(6, "0")}`}
                      onChange={(hex) => {
                        const color = parseInt(hex.replace("#", ""), 16);
                        setColor(color);
                      }}
                      presets={COLOR_PRESETS.map((c) => `#${c.toString(16).padStart(6, "0")}`)}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </TooltipTrigger>
            <TooltipContent>Voxel color (C)</TooltipContent>
          </Tooltip>

          {/* Background color */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Popover open={bgColorOpen} onOpenChange={setBgColorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Background color"
                  >
                    <LuPalette className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 border-zinc-800/50 bg-zinc-950/95 backdrop-blur-md" align="start">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-zinc-200">Background</span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        #{backgroundColor.toString(16).padStart(6, "0").toUpperCase()}
                      </span>
                    </div>
                    <ColorPicker
                      color={`#${backgroundColor.toString(16).padStart(6, "0")}`}
                      onChange={(hex) => {
                        const color = parseInt(hex.replace("#", ""), 16);
                        setBackgroundColor(color);
                      }}
                      presets={COLOR_PRESETS.map((c) => `#${c.toString(16).padStart(6, "0")}`)}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </TooltipTrigger>
            <TooltipContent>Background color</TooltipContent>
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
