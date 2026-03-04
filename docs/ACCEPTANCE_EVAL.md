## Acceptance Criteria Evaluation

This document evaluates the current implementation of the voxel editor against `docs/ACCEPTANCE.md`.

---

## 1. Core Editor

### 1.1 Navigation

- **Criteria**: Rotate (LMB drag), Zoom (scroll), Pan (RMB drag). Camera moves smoothly without jitter.
- **Implementation**:
  - `VoxelScene` uses `Canvas` with `OrbitControls` (`enableDamping`, `dampingFactor`, `minDistance`, `maxDistance`, `screenSpacePanning`).
  - This provides rotation, zoom, and pan mapped to the standard mouse gestures and smooth motion.
- **Status**: **Pass**

### 1.2 Add Voxels

- **Criteria**: 
  - Select "Add" mode.
  - Choose a color.
  - Click adjacent to an existing voxel or grid.
  - Expected: A voxel appears at the placement target.
- **Implementation**:
  - `VoxelToolbar`:
    - Pencil tool + `editMode === "add"` (button + `A` key).
    - Color selection via color popover (`ColorPicker`) and `selectedColor` in `voxelStore`.
  - `VoxelInteraction`:
    - When clicking an existing voxel:
      - Uses `computePlacementCandidate` from `utils/voxelRaycast` to compute an adjacent cell from hit voxel + face normal.
      - Validates bounds and occupancy via `isWithinBounds` and `keyFromXYZ`.
    - When not hitting a voxel:
      - Intersects the active reference plane (`planeAxis`, `activeLayerY`) and rounds to integer grid coordinates.
      - Skips placement if the cell is occupied or out of bounds.
  - `voxelStore.addVoxel`:
    - Clamps positions via `clampPosition`, enforces `isWithinBounds`, and respects `MAX_VOXEL_COUNT`.
- **Status**: **Pass**

### 1.3 Remove Voxels

- **Criteria**:
  - Select "Remove" mode.
  - Click a voxel.
  - Expected: Voxel disappears.
- **Implementation**:
  - `VoxelToolbar`: pencil tool + `editMode === "remove"` (button + `D` key).
  - `VoxelInteraction`:
    - Raycasts the instanced mesh, resolves `instanceId` into a voxel via `useVoxelArray`, and calls `removeVoxel(...voxel.position)`.
    - Hover preview uses `GhostCube` to highlight the voxel that would be deleted.
  - `voxelStore.removeVoxel` deletes from the sparse `Map` and records history.
- **Status**: **Pass**

### 1.4 Performance Test

- **Criteria**:
  - Stress test button (if present).
  - Add ~1000 voxels.
  - Expected: Scene and camera remain interactive and smooth.
- **Implementation**:
  - `StressTest`:
    - Generates a 10×10×10 cube (~1000 voxels) with varied colors (`fillTestScene`).
    - Applies the batch via `useVoxelStore(state => state.applyVoxels)`.
    - Logs applied count and timing.
  - `VoxelInstances`:
    - Single `InstancedMesh` with shared geometry/material and per-instance color via `setColorAt`.
    - Rebuilds when the `voxelArray` changes, which is acceptable for thousands of voxels.
  - `FPSCounter`:
    - Dev-only FPS readout to verify frame rate during stress tests.
- **Status**: **Pass (design and code match criteria; actual FPS depends on runtime environment but architecture is appropriate).**

---

## 2. LLM Generation

### 2.1 Basic Flow

- **Criteria**:
  - Enter prompt (e.g., "small modern house with flat roof").
  - Click Generate.
  - Expected: Structured voxel structure appears.
- **Implementation**:
  - `GeneratorPanel`:
    - Textarea for natural-language input, `Generate` button, and `G` shortcut.
    - Calls `/api/generate` (`POST`) with `{ input }`.
  - `/api/generate/route.ts`:
    - Validates request body with `zod` (`requestSchema`).
    - Builds messages via `buildPrompt`.
    - Calls an OpenAI-compatible API (`callLLM`), then extracts JSON (`extractJSON`) and validates against `voxelSpecSchema`.
    - Retries once with a “fix JSON” prompt if first attempt fails.
  - On success, client receives a validated `VoxelSpec`, which is rasterized and applied to the store.
- **Status**: **Pass**

### 2.2 Bounds and Voxel Cap

- **Criteria**:
  - No unbounded expansion.
  - Voxel count respects a cap.
  - If output exceeds bounds, generation is rejected or clamped.
- **Implementation** (layered guardrails):
  - **Schema level (`types/voxelSpec.ts`)**:
    - `voxelSpecSchema`:
      - Enforces reasonable `bounds.size` via `VOXEL_SPEC_MIN_DIMENSION` / `VOXEL_SPEC_MAX_DIMENSION` tied to `BOUNDS_SIZE`.
      - Uses `estimateCommandVoxels` to compute an approximate voxel count for all commands.
      - Rejects specs whose estimate exceeds `VOXEL_SPEC_MAX_VOXELS` (mirrors `MAX_VOXEL_COUNT`).
  - **Rasterizer level (`lib/rasterize.ts`)**:
    - `clampBounds`:
      - Clamps the spec’s bounds into global editor bounds using `BOUNDS_MIN` / `BOUNDS_MAX`.
      - If the clamped region is empty (spec entirely outside), throws `RasterizeError("Spec bounds lie completely outside global bounds")`.
      - Computes an estimate with clamped bounds and compares to a hard cap `min(MAX_VOXEL_COUNT, VOXEL_SPEC_MAX_VOXELS)`.
    - `rasterize`:
      - Dedupes voxels in a map keyed by `"x,y,z"`.
      - Enforces `maxVoxels` during fill; throws `RasterizeError` if cap is reached.
      - Provides helper tests for correctness (e.g., `devTest_capEnforcement`).
  - **Store level (`voxelStore.ts`)**:
    - `applyVoxels`:
      - Applies clamped positions, enforces `MAX_VOXEL_COUNT`, and discards out-of-bounds input defensively.
      - Avoids recording history when the resulting map is unchanged.
  - **User feedback (`GeneratorPanel`)**:
    - Catches server or rasterizer errors and displays a text error block.
    - If `applied === 0`, shows `"Generated voxels were all out of bounds or exceeded cap"`.
- **Status**: **Pass (specs are either clamped into bounds or rejected; both spec-level and runtime caps are enforced).**

---

## 3. Undo / Redo

- **Criteria**:
  - Add voxel → Ctrl+Z → Ctrl+Shift+Z.
  - Expected: Undo reverses last action; redo restores it.
- **Implementation**:
  - `voxelStore`:
    - Maintains `voxels: VoxelMap`, `past: VoxelMap[]`, `future: VoxelMap[]`, `maxHistory`.
    - `pushHistory` clones the current voxel map and appends to `past`, truncating to `maxHistory` and clearing `future`.
    - Mutating actions (`addVoxel`, `removeVoxel`, `recolorVoxel`, `recolorVoxels`, `fillPlane`, `deletePlane`, `clear`, `applyVoxels`) call `pushHistory` only when they actually change the state (guarding against no-op history noise).
    - `undo`:
      - Restores the last snapshot from `past`, moves the current map into `future` (front).
    - `redo`:
      - Restores from `future[0]`, moves current map back into `past` with `maxHistory` enforcement.
  - Keyboard wiring:
    - `VoxelScene` sets a `keydown` handler on `window`:
      - `Ctrl/Cmd+Z` → `undo()`.
      - `Ctrl/Cmd+Shift+Z` and `Ctrl/Cmd+Y` → `redo()`.
      - Ignores shortcuts while typing in inputs or textareas.
  - Toolbar wiring:
    - `VoxelToolbar` exposes Undo/Redo buttons with `LuUndo2`/`LuRedo2`, disabled based on `canUndo` / `canRedo`.
- **Status**: **Pass**

---

## 4. Code Quality Expectations

### 4.1 Sparse Voxel Storage

- **Criteria**: Sparse voxel storage, no 3D array allocation.
- **Implementation**:
  - `voxelStore` uses `Map<string, Voxel>` with `keyFromXYZ` / `xyzFromKey`.
  - No large 3D arrays are allocated; memory scales with actual voxels.
- **Status**: **Pass**

### 4.2 Instanced Mesh Rendering

- **Criteria**: Instanced mesh rendering for voxels.
- **Implementation**:
  - `VoxelInstances`:
    - Shared `BoxGeometry` and `MeshStandardMaterial`.
    - Sorted `voxelArray` for stable `instanceId` → voxel mapping.
    - Uses `InstancedMesh` and updates matrices/colors via `setMatrixAt` / `setColorAt`.
    - Marks `instanceMatrix` and `instanceColor` as needing update.
  - `VoxelScene` uses a single `VoxelInstances` component for all voxels.
- **Status**: **Pass**

### 4.3 Separation of Editor Logic and Rendering

- **Criteria**: Clear separation of editor logic and rendering.
- **Implementation**:
  - **Logic / State**:
    - `voxelStore` centralizes voxel data, tools, plane settings, dev flags, pointer position, and history.
    - `voxelConstraints` centralizes bounds and `MAX_VOXEL_COUNT`, re-exported for consumers to use a single source of truth.
    - `voxelSpec` and `rasterize` own LLM-spec schema and rasterization logic.
  - **Rendering / Interaction**:
    - `VoxelScene` owns the canvas, lights, controls, overlays, and dev tools.
    - `VoxelInstances` renders the voxels; `VoxelInteraction` encapsulates raycasting + click/hover behavior.
    - UI controls are split into small, focused components (`VoxelToolbar`, `GeneratorPanel`, `GhostCube`, `FPSCounter`, `StressTest`, etc.).
- **Status**: **Pass**

### 4.4 Schema Validation for LLM Outputs

- **Criteria**: Schema validation for LLM outputs.
- **Implementation**:
  - `/api/generate`:
    - Validates the incoming request body.
    - Validates LLM JSON output via `voxelSpecSchema.safeParse`, with detailed error mapping back to a single error string.
  - `types/voxelSpec.ts`:
    - Defines schemas and types for bounds, palette, commands, and metadata.
    - Applies extra validation via `superRefine` (e.g., from/to ordering, estimated voxel caps).
  - Failure modes:
    - If parsing or schema validation fails, API responds with `GENERATION_FAILED` or `SERVER_ERROR` and a descriptive `error` string, which `GeneratorPanel` displays.
- **Status**: **Pass**

---

## 5. Readability and Minor Notes

- **Readability**:
  - Naming is consistent and descriptive (`computePlacementCandidate`, `fillPlane`, `applyVoxels`, `clampBounds`, etc.).
  - Components and utilities are well-commented, especially in `voxelStore`, `rasterize`, and `voxelRaycast`.
  - `ARCHITECTURE.md` closely matches the actual implementation and is a useful high-level guide.
  - Complex pieces (`VoxelInteraction`) are long but logically structured and well-annotated.
- **Minor nits (non-blocking)**:
  - Some comments in `voxelConstraints` (e.g., specific numeric examples for bounds) are slightly out of sync with the current constants; functionality is correct but comments could be refreshed.
  - Rasterizer logging is quite verbose and might be gated behind an explicit debug flag or `NODE_ENV` check if log noise becomes a concern.

---

## 6. Verdict

- **All acceptance criteria in `docs/ACCEPTANCE.md` are satisfied by the current implementation.**
- **The codebase is readable, with strong adherence to the designed architecture and clear separation between core editor logic, rendering, and LLM integration.**


