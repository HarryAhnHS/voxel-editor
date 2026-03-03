"use client";

import { create } from "zustand";
import {
  clampPosition,
  isWithinBounds,
  MAX_VOXEL_COUNT,
  BOUNDS_MIN,
  BOUNDS_MAX,
} from "./voxelConstraints";

// --- Types (aligned with ARCHITECTURE.md) ---

export type VoxelPosition = [x: number, y: number, z: number];

export interface Voxel {
  position: VoxelPosition;
  color: number; // THREE.Color compatible (0xRRGGBB)
}

export type VoxelMap = Map<string, Voxel>;

export type Tool = "pencil" | "move";

export type EditMode = "add" | "remove";

export type PlaneAxis = "x" | "y" | "z";

// --- Key utilities ---

export function keyFromXYZ(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export function xyzFromKey(key: string): VoxelPosition {
  const [x, y, z] = key.split(",").map(Number);
  return [x, y, z];
}

// --- Store state ---

interface VoxelState {
  voxels: VoxelMap;
  selectedColor: number;
  tool: Tool;
  editMode: EditMode;
  activeLayerY: number;
  showLayerAxis: boolean;
  showDevTools: boolean;
  planeAxis: PlaneAxis;
}

interface VoxelActions {
  /** Returns true if voxel was added; false if out of bounds or at cap. */
  addVoxel: (x: number, y: number, z: number, color?: number) => boolean;
  removeVoxel: (x: number, y: number, z: number) => void;
  setColor: (color: number) => void;
  setTool: (tool: Tool) => void;
  setEditMode: (mode: EditMode) => void;
  setPlaneAxis: (axis: PlaneAxis) => void;
  setActiveLayerY: (y: number) => void;
  incrementLayer: () => void;
  decrementLayer: () => void;
  toggleLayerAxis: () => void;
  toggleDevTools: () => void;
  clear: () => void;
  /** Applies batch (e.g. from generator); enforces bounds + cap. Returns count applied. */
  applyVoxels: (voxels: Voxel[]) => number;
}

const DEFAULT_COLOR = 0x88ccff;

function createFreshMap(): VoxelMap {
  return new Map();
}

export const useVoxelStore = create<VoxelState & VoxelActions>((set) => ({
  voxels: createFreshMap(),
  selectedColor: DEFAULT_COLOR,
  tool: "pencil",
  editMode: "add",
  activeLayerY: 0, // Default plane coordinate
  showLayerAxis: true,
  showDevTools: true,
  planeAxis: "y",

  addVoxel: (x, y, z, color) => {
    let added = false;
    set((state) => {
      if (state.voxels.size >= MAX_VOXEL_COUNT) return state;
      const pos = clampPosition([x, y, z]);
      if (!isWithinBounds(pos)) return state;
      const key = keyFromXYZ(pos[0], pos[1], pos[2]);
      const next = new Map(state.voxels);
      next.set(key, {
        position: pos,
        color: color ?? state.selectedColor,
      });
      added = true;
      return { voxels: next };
    });
    return added;
  },

  removeVoxel: (x, y, z) =>
    set((state) => {
      const key = keyFromXYZ(x, y, z);
      if (!state.voxels.has(key)) return state;
      const next = new Map(state.voxels);
      next.delete(key);
      return { voxels: next };
    }),

  setColor: (color) => set({ selectedColor: color }),

  setTool: (tool) => set({ tool }),

  setEditMode: (mode) => set({ editMode: mode }),

  setPlaneAxis: (axis) => set({ planeAxis: axis }),

  setActiveLayerY: (y) => {
    const [minY] = BOUNDS_MIN;
    const [maxY] = BOUNDS_MAX;
    const clampedY = Math.max(minY, Math.min(maxY, Math.round(y)));
    set({ activeLayerY: clampedY });
  },

  incrementLayer: () =>
    set((state) => {
      const [maxY] = BOUNDS_MAX;
      const newY = Math.min(maxY, state.activeLayerY + 1);
      return { activeLayerY: newY };
    }),

  decrementLayer: () =>
    set((state) => {
      const [minY] = BOUNDS_MIN;
      const newY = Math.max(minY, state.activeLayerY - 1);
      return { activeLayerY: newY };
    }),

  toggleLayerAxis: () =>
    set((state) => ({
      showLayerAxis: !state.showLayerAxis,
    })),

  toggleDevTools: () =>
    set((state) => ({
      showDevTools: !state.showDevTools,
    })),

  clear: () => set({ voxels: createFreshMap() }),

  applyVoxels: (voxels) => {
    let applied = 0;
    set(() => {
      const next = createFreshMap();
      for (const v of voxels) {
        if (next.size >= MAX_VOXEL_COUNT) break;
        const pos = clampPosition(v.position);
        if (!isWithinBounds(pos)) continue;
        const key = keyFromXYZ(pos[0], pos[1], pos[2]);
        next.set(key, { position: pos, color: v.color });
      }
      applied = next.size;
      return { voxels: next };
    });
    return applied;
  },
}));

// Re-export for rasterizer / UI (single source of truth for guardrails)
export {
  BOUNDS_MIN,
  BOUNDS_MAX,
  BOUNDS_SIZE,
  MAX_VOXEL_COUNT,
  isWithinBounds,
  clampPosition,
} from "./voxelConstraints";

// --- Example usage ---
//
// // In a component:
// const voxels = useVoxelStore((s) => s.voxels);
// const addVoxel = useVoxelStore.getState().addVoxel;
// const removeVoxel = useVoxelStore.getState().removeVoxel;
// const setColor = useVoxelStore.getState().setColor;
// const setTool = useVoxelStore.getState().setTool;
// const clear = useVoxelStore.getState().clear;
// const applyVoxels = useVoxelStore.getState().applyVoxels;
//
// addVoxel(0, 0, 0);                    // uses selectedColor
// addVoxel(1, 0, 0, 0xff0000);          // explicit color
// removeVoxel(0, 0, 0);
// setColor(0x00ff00);
// setTool("remove");
// clear();
//
// // Batch (e.g. from generator):
// applyVoxels([
//   { position: [0, 0, 0], color: 0xffffff },
//   { position: [1, 1, 0], color: 0x888888 },
// ]);
//
// // Key utilities:
// const key = keyFromXYZ(1, 2, 3);      // "1,2,3"
// const [x, y, z] = xyzFromKey(key);    // [1, 2, 3]
