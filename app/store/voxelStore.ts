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

export type EditMode = "add" | "remove" | "recolor";

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
  backgroundColor: number;
  tool: Tool;
  editMode: EditMode;
  activeLayerY: number;
  showLayerAxis: boolean;
  showDevTools: boolean;
  planeAxis: PlaneAxis;
  /** Live pointer position (voxel coords) for UI overlays */
  pointerPosition: VoxelPosition | null;
  /** History of voxel maps for undo (older → newer); last entry is most recent snapshot */
  past: VoxelMap[];
  /** Future voxel maps for redo (most recent at index 0) */
  future: VoxelMap[];
  /** Maximum number of snapshots to keep in history */
  maxHistory: number;
}

interface VoxelActions {
  /** Returns true if voxel was added; false if out of bounds or at cap. */
  addVoxel: (x: number, y: number, z: number, color?: number) => boolean;
  removeVoxel: (x: number, y: number, z: number) => void;
  recolorVoxel: (x: number, y: number, z: number, color?: number) => void;
  /** Batch recolor helper used by tools that operate on many voxels at once */
  recolorVoxels: (
    updates: { x: number; y: number; z: number; color?: number }[]
  ) => number;
  setColor: (color: number) => void;
  setBackgroundColor: (color: number) => void;
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
  /** Fill plane at activeLayerY with selected color */
  fillPlane: () => number;
  /** Delete all voxels on plane at activeLayerY */
  deletePlane: () => number;
  /** Update live pointer position for coordinate overlay */
  setPointerPosition: (pos: VoxelPosition | null) => void;
  /** Undo last voxel mutation, if any */
  undo: () => void;
  /** Redo last undone voxel mutation, if any */
  redo: () => void;
  /** Convenience selectors for UI enable/disable */
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const DEFAULT_COLOR = 0x88ccff;

function createFreshMap(): VoxelMap {
  return new Map();
}

/** Shallowly clones a voxel map.
 *  This is safe for history snapshots because voxel objects are treated as immutable:
 *  every mutation creates a new Voxel object instead of mutating in place. */
function cloneVoxelMap(map: VoxelMap): VoxelMap {
  return new Map(map);
}

function pushHistory(state: VoxelState): { past: VoxelMap[]; future: VoxelMap[] } {
  const snapshot = cloneVoxelMap(state.voxels);
  const max = state.maxHistory;
  const nextPast =
    state.past.length >= max
      ? [...state.past.slice(1), snapshot]
      : [...state.past, snapshot];

  // We always clear redo history on any new mutation.
  return { past: nextPast, future: [] };
}

export const useVoxelStore = create<VoxelState & VoxelActions>((set, get) => ({
  voxels: createFreshMap(),
  selectedColor: DEFAULT_COLOR,
  backgroundColor: 0x000000, // Default black background
  tool: "pencil",
  editMode: "add",
  activeLayerY: 0, // Default plane coordinate
  showLayerAxis: true,
  showDevTools: true,
  planeAxis: "y",
  pointerPosition: null,
  past: [],
  future: [],
  maxHistory: 50,

  addVoxel: (x, y, z, color) => {
    let added = false;
    set((state) => {
      if (state.voxels.size >= MAX_VOXEL_COUNT) return state;
      const pos = clampPosition([x, y, z]);
      if (!isWithinBounds(pos)) return state;
      const key = keyFromXYZ(pos[0], pos[1], pos[2]);
      const targetColor = color ?? state.selectedColor;
      const existing = state.voxels.get(key);

      // No-op: voxel already exists with same color, so don't record history or change state.
      if (existing && existing.color === targetColor) {
        return state;
      }

      const history = pushHistory(state);
      const next = new Map(state.voxels);
      next.set(key, {
        position: pos,
        color: targetColor,
      });
      added = true;
      return { voxels: next, ...history };
    });
    return added;
  },

  removeVoxel: (x, y, z) =>
    set((state) => {
      const key = keyFromXYZ(x, y, z);
      if (!state.voxels.has(key)) return state;
      const history = pushHistory(state);
      const next = new Map(state.voxels);
      next.delete(key);
      return { voxels: next, ...history };
    }),

  recolorVoxel: (x, y, z, color) =>
    set((state) => {
      const key = keyFromXYZ(x, y, z);
      const voxel = state.voxels.get(key);
      if (!voxel) return state;
      const targetColor = color ?? state.selectedColor;

      // Skip history for no-op recolor.
      if (voxel.color === targetColor) {
        return state;
      }

      const history = pushHistory(state);
      const next = new Map(state.voxels);
      next.set(key, {
        ...voxel,
        color: targetColor,
      });
      return { voxels: next, ...history };
    }),

  recolorVoxels: (updates) => {
    let changed = 0;
    set((state) => {
      if (updates.length === 0) return state;

      const next = new Map(state.voxels);

      for (const { x, y, z, color } of updates) {
        const key = keyFromXYZ(x, y, z);
        const voxel = next.get(key);
        if (!voxel) continue;
        const targetColor = color ?? state.selectedColor;
        if (voxel.color === targetColor) continue;

        next.set(key, { ...voxel, color: targetColor });
        changed++;
      }

      if (changed === 0) {
        // Nothing actually changed; don't touch history.
        return state;
      }

      const history = pushHistory(state);
      return { voxels: next, ...history };
    });
    return changed;
  },

  setColor: (color) => set({ selectedColor: color }),
  setBackgroundColor: (color) => set({ backgroundColor: color }),

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

  clear: () =>
    set((state) => {
      // Avoid pushing history if already empty.
      if (state.voxels.size === 0) return state;
      const history = pushHistory(state);
      return { voxels: createFreshMap(), ...history };
    }),

  setPointerPosition: (pos) => set({ pointerPosition: pos }),

  applyVoxels: (voxels) => {
    let applied = 0;
    set((state) => {
      const next = createFreshMap();
      for (const v of voxels) {
        if (next.size >= MAX_VOXEL_COUNT) break;
        const pos = clampPosition(v.position);
        if (!isWithinBounds(pos)) continue;
        const key = keyFromXYZ(pos[0], pos[1], pos[2]);
        next.set(key, { position: pos, color: v.color });
      }
      applied = next.size;

      // Don't record history if resulting map is identical to current (no-op).
      if (state.voxels.size === next.size) {
        let same = true;
        for (const [key, voxel] of next) {
          const existing = state.voxels.get(key);
          if (!existing || existing.color !== voxel.color) {
            same = false;
            break;
          }
        }
        if (same) {
          return state;
        }
      }

      const history = pushHistory(state);
      return { voxels: next, ...history };
    });
    return applied;
  },

  fillPlane: () => {
    let filled = 0;
    set((state) => {
      const next = new Map(state.voxels);
      const [minX, minY, minZ] = BOUNDS_MIN;
      const [maxX, maxY, maxZ] = BOUNDS_MAX;
      let changed = false;

      // Fill all positions on the active plane (including replacing existing voxels with new color)
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (let z = minZ; z <= maxZ; z++) {
            let matchesPlane = false;
            switch (state.planeAxis) {
              case "x":
                matchesPlane = x === state.activeLayerY;
                break;
              case "y":
                matchesPlane = y === state.activeLayerY;
                break;
              case "z":
                matchesPlane = z === state.activeLayerY;
                break;
            }

            if (matchesPlane && next.size < MAX_VOXEL_COUNT) {
              const key = keyFromXYZ(x, y, z);
              const existing = next.get(key);
              const targetColor = state.selectedColor;
              // Only treat as a change if we're adding a new voxel or changing color.
              if (!existing || existing.color !== targetColor) {
                next.set(key, {
                  position: [x, y, z],
                  color: targetColor,
                });
                filled++;
                changed = true;
              }
            }
          }
        }
      }

      if (!changed) {
        // No voxels changed; avoid recording a useless history entry.
        return state;
      }

      const history = pushHistory(state);
      return { voxels: next, ...history };
    });
    return filled;
  },

  deletePlane: () => {
    let deleted = 0;
    set((state) => {
      const next = new Map(state.voxels);
      let changed = false;
      for (const [key, voxel] of state.voxels.entries()) {
        const [x, y, z] = voxel.position;
        let matchesPlane = false;
        switch (state.planeAxis) {
          case "x":
            matchesPlane = x === state.activeLayerY;
            break;
          case "y":
            matchesPlane = y === state.activeLayerY;
            break;
          case "z":
            matchesPlane = z === state.activeLayerY;
            break;
        }
        
        if (matchesPlane) {
          next.delete(key);
          deleted++;
          changed = true;
        }
      }

      if (!changed) {
        return state;
      }

      const history = pushHistory(state);
      return { voxels: next, ...history };
    });
    return deleted;
  },

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return state;

      // Last entry in past is the most recent snapshot to restore.
      const previous = state.past[state.past.length - 1];
      const remainingPast = state.past.slice(0, -1);
      const futureSnapshot = cloneVoxelMap(state.voxels);

      return {
        voxels: cloneVoxelMap(previous),
        past: remainingPast,
        // We unshift the current state so the newest redo is always at index 0.
        future: [futureSnapshot, ...state.future],
      };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return state;

      const [nextSnapshot, ...restFuture] = state.future;
      const pastSnapshot = cloneVoxelMap(state.voxels);

      const max = state.maxHistory;
      const nextPast =
        state.past.length >= max
          ? [...state.past.slice(1), pastSnapshot]
          : [...state.past, pastSnapshot];

      return {
        voxels: cloneVoxelMap(nextSnapshot),
        past: nextPast,
        future: restFuture,
      };
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

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

