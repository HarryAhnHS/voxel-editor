"use client";

import { useEffect } from "react";
import { useVoxelStore, BOUNDS_MIN, BOUNDS_MAX, type EditMode } from "../store/voxelStore";

const COLOR_PRESETS = [
  0x88ccff, // Default blue
  0xff6b6b, // Red
  0x4ecdc4, // Teal
  0x45b7d1, // Blue
  0xffa07a, // Light salmon
  0x98d8c8, // Mint
  0xf7dc6f, // Yellow
  0xbb8fce, // Purple
  0x85c1e2, // Sky blue
  0xf8c471, // Orange
  0x82e0aa, // Green
  0xf1948a, // Pink
  0xffffff, // White
  0x34495e, // Dark gray
  0x000000, // Black
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
  const setTool = useVoxelStore((state) => state.setTool);
  const setColor = useVoxelStore((state) => state.setColor);
  const setEditMode = useVoxelStore((state) => state.setEditMode);
  const setActiveLayerY = useVoxelStore((state) => state.setActiveLayerY);
  const incrementLayer = useVoxelStore((state) => state.incrementLayer);
  const decrementLayer = useVoxelStore((state) => state.decrementLayer);
  const toggleLayerAxis = useVoxelStore((state) => state.toggleLayerAxis);

  // Keyboard shortcuts for layer navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === "[") {
        event.preventDefault();
        decrementLayer();
      } else if (event.key === "]") {
        event.preventDefault();
        incrementLayer();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [incrementLayer, decrementLayer]);

  const [minY] = BOUNDS_MIN;
  const [maxY] = BOUNDS_MAX;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
      <div className="flex items-center gap-2 bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 rounded-lg px-3 py-2 shadow-lg">
        {/* Edit / Move Tool */}
        <button
          onClick={() => setTool("pencil")}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            tool === "pencil"
              ? "bg-blue-600 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
          title="Edit tool - Use Add/Delete modes to control behavior"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 inline-block mr-1.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
          Pencil
        </button>

        {/* Move Tool */}
        <button
          onClick={() => setTool("move")}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            tool === "move"
              ? "bg-blue-600 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
          title="Move tool - Only camera movement, no editing"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 inline-block mr-1.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
            />
          </svg>
          Move
        </button>

        {/* Reset view */}
        <button
          onClick={() => onResetView?.()}
          className="px-2.5 py-1.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
          title="Reset camera to center (R)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 inline-block mr-1.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 3v4m0 10v4m9-9h-4M7 12H3m13.657-6.657L15 8m-6 8-1.657 2.657M8.343 5.343 10 8m6 8 1.657 2.657"
            />
          </svg>
          Reset View
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-zinc-700 mx-1" />

        {/* Add / Delete Mode */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditMode("add")}
            className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
              editMode === "add"
                ? "bg-emerald-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
            title="Add mode - Click plane to create voxels on the active layer"
          >
            Add
          </button>
          <button
            onClick={() => setEditMode("remove")}
            className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
              editMode === "remove"
                ? "bg-rose-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
            title="Delete mode - Click voxels to remove them"
          >
            Delete
          </button>
        </div>

        {/* Layer Slider */}
        <div className="flex items-center gap-3">
          {/* Layer Slider */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-400 whitespace-nowrap">
              Layer Y:
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={decrementLayer}
                className="px-2 py-1 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 rounded text-sm"
                title="Decrement layer ([ key)"
              >
                −
              </button>
              <input
                type="range"
                min={minY}
                max={maxY}
                value={activeLayerY}
                onChange={(e) => setActiveLayerY(Number(e.target.value))}
                className="w-24 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer slider"
                title={`Layer Y: ${activeLayerY}`}
              />
              <button
                onClick={incrementLayer}
                className="px-2 py-1 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 rounded text-sm"
                title="Increment layer (] key)"
              >
                +
              </button>
              <span className="text-xs text-zinc-300 w-8 text-center">
                {activeLayerY}
              </span>
            </div>
          </div>

          {/* Layer Axis Toggle */}
          <button
            onClick={toggleLayerAxis}
            className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
              showLayerAxis
                ? "bg-zinc-200 text-zinc-900"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
            title="Toggle active layer grid visibility"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
            </svg>
            <span>Grid</span>
          </button>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-zinc-700 mx-1" />

        {/* Color Picker */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-400">Color:</label>
          <div className="flex gap-1.5">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                onClick={() => setColor(color)}
                className={`w-6 h-6 rounded border-2 transition-all ${
                  selectedColor === color
                    ? "border-white scale-110"
                    : "border-zinc-600 hover:border-zinc-400"
                }`}
                style={{ backgroundColor: `#${color.toString(16).padStart(6, "0")}` }}
                title={`Color: #${color.toString(16).padStart(6, "0")}`}
              />
            ))}
          </div>
          {/* Current color display */}
          <div
            className="w-8 h-8 rounded border border-zinc-600"
            style={{ backgroundColor: `#${selectedColor.toString(16).padStart(6, "0")}` }}
            title={`Selected: #${selectedColor.toString(16).padStart(6, "0")}`}
          />
        </div>
      </div>
    </div>
  );
}

