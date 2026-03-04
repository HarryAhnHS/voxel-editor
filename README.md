## Cedar Voxel Editor

A browser-based voxel editor built with Next.js, React Three Fiber, and TypeScript.  
It combines a performant 3D voxel sculpting experience with LLM-powered generation, while enforcing strict guardrails on bounds and voxel count.

---

## Features

- **Core voxel editor**
  - Place, remove, and recolor voxels on a 3D grid.
  - Hybrid placement model:
    - Click voxel faces to add adjacent voxels (surface sculpting).
    - Click on a reference plane to place voxels freely on that layer.
  - Hover previews via a ghost cube for both add and remove/recolor operations.

- **3D navigation**
  - Orbit-style controls (via `@react-three/drei` `OrbitControls`):
    - **Left mouse drag**: rotate.
    - **Right mouse drag**: pan.
    - **Mouse wheel**: zoom.
  - `R` resets the camera to a centered, isometric view.

- **Layer & plane system**
  - Configurable reference plane along **X**, **Y**, or **Z** axes.
  - Layer slider and arrow-key shortcuts for stepping through slices.
  - Optional grid + axis guides that track the active plane.

- **Color & background controls**
  - Color picker with presets for voxel color.
  - Separate background color picker for scene backdrop.

- **Undo / redo**
  - Full undo/redo history for voxel edits (add, remove, recolor, plane fill/delete, generator batches, clear).
  - Keyboard shortcuts:
    - **Ctrl/Cmd+Z**: undo.
    - **Ctrl/Cmd+Shift+Z** or **Ctrl/Cmd+Y**: redo.

- **LLM-based generation**
  - Text prompt → structured `VoxelSpec` JSON → deterministic rasterization → voxel scene.
  - Strict Zod schema validation and voxel-count estimation.
  - Hard caps on bounds and total voxels, with clamping/rejection of out-of-range specs.

- **Performance & dev tools**
  - Sparse voxel storage (`Map<string, Voxel>`) instead of 3D arrays.
  - Single `InstancedMesh` for all voxels with per-instance transforms and colors.
  - Dev overlay (toggled via toolbar) with:
    - FPS counter.
    - Voxel count.
    - Stress test that fills the scene with ~1000 voxels for performance validation.

- **Keyboard shortcuts overview**
  - In-editor shortcuts helper overlay listing:
    - Tool modes, camera mode, color panel, generator, undo/redo.
    - Grid/axis visibility and layer controls.
    - Mouse mappings for orbit/pan/zoom and sculpting.

---

## Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **3D & rendering**:
  - `three`
  - `@react-three/fiber`
  - `@react-three/drei`
- **State management**: `zustand`
- **Validation & schemas**: `zod`
- **UI**
  - Tailwind-based styling (see `app/globals.css`)
  - Radix UI primitives via custom wrappers in `app/components/ui`
  - Icons from `lucide-react` and `react-icons`

High-level architecture and design details are documented in:

- `docs/SPEC.md` – product & technical specification.
- `docs/ARCHITECTURE.md` – data model, rendering, interaction, and LLM pipeline.
- `docs/UIDESIGN.md` – UI and interaction design.
- `docs/ACCEPTANCE.md` – acceptance criteria.
- `docs/ACCEPTANCE_EVAL.md` – evaluation of how the implementation meets the acceptance criteria.

---

## Local Development

### Prerequisites

- Node.js 18+ (recommended: matching the version supported by your Next.js setup)
- npm (or another package manager, though this repo uses `npm` by default)

### Install dependencies

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

Then open `http://localhost:3000` in your browser.

The main editor UI is rendered by `app/page.tsx` and `app/components/VoxelScene.tsx`.

---

## LLM Generation Setup

LLM-powered generation is handled by the API route `app/api/generate/route.ts`.  
It calls an OpenAI-compatible chat endpoint and expects JSON output matching the `VoxelSpec` schema in `types/voxelSpec.ts`.

### Required environment variables

Set the following environment variables (e.g., in a `.env.local` file):

```bash
OPENAI_API_KEY=your_api_key_here
# Optional overrides:
OPENAI_API_URL=https://api.openai.com/v1/chat/completions
OPENAI_MODEL=gpt-4o-mini
```

- `OPENAI_API_KEY` **must** be provided.
- `OPENAI_API_URL` and `OPENAI_MODEL` are optional; the defaults work for the standard OpenAI API.

### Generation flow

1. User opens the generator popover from the top toolbar (or presses `G`).
2. User enters a natural-language description (e.g. “small modern house with a flat roof”).
3. Frontend sends `POST /api/generate` with `{ input: string }`.
4. The API:
   - Builds a prompt (`app/lib/llmPrompts.ts`).
   - Calls the chat API.
   - Extracts JSON, validates it with `voxelSpecSchema`.
   - Returns `{ spec }` or an `{ error }` with a code.
5. Client runs `rasterize(spec)` (`app/lib/rasterize.ts`) to produce a bounded voxel set.
6. Result is converted to internal `Voxel` objects and applied via `voxelStore.applyVoxels`.

If generation fails, errors are shown inline in the generator UI with user-friendly messages (schema issues, cap violations, or server errors).

---

## Project Structure (High Level)

- `app/`
  - `page.tsx` – entry point that mounts the voxel scene.
  - `layout.tsx` – root layout and global styles.
  - `components/`
    - `VoxelScene.tsx` – canvas wrapper, camera controls, overlays, dev tools.
    - `VoxelInstances.tsx` – instanced mesh renderer for all voxels.
    - `VoxelInteraction.tsx` – raycasting, hover previews, click behavior.
    - `VoxelToolbar.tsx` – top toolbar (tools, colors, generator, dev tools, clear/reset).
    - `GhostCube.tsx` – hover/preview cube.
    - `GeneratorPanel.tsx` – LLM generation UI.
    - `FPSCounter.tsx`, `StressTest.tsx`, `VoxelCount.tsx` – dev/perf tools.
    - `ui/` – button, popover, tooltip, color picker, separators.
  - `store/`
    - `voxelStore.ts` – main editor store, tools, history, pointer, and guardrails export.
    - `voxelConstraints.ts` – global bounds and voxel-count constants/utilities.
  - `lib/`
    - `rasterize.ts` – rasterizer from `VoxelSpec` to voxels with clamping and caps.
    - `llmPrompts.ts` – prompt builder for the LLM.
    - `utils.ts` – shared utilities.
  - `api/generate/route.ts` – LLM generation API route.
  - `utils/voxelRaycast.ts` – raycasting helpers and placement computation.
- `types/`
  - `voxelSpec.ts` – Zod schema and types for the structured voxel spec.

See `docs/ARCHITECTURE.md` for a deeper breakdown.

---

## Development Notes

- The editor is designed to remain responsive at **1000+ voxels**:
  - Avoids 3D array allocation, relies on sparse `Map` storage.
  - Uses a single `InstancedMesh` with matrix/color updates on voxel changes.
  - Hover and layer changes do **not** rebuild the instanced mesh; they use local state and lightweight math.
- Undo/redo is snapshot-based, with defensive no-op checks to avoid bloating history for redundant operations.

---

## Deployment

This is a standard Next.js App Router project and can be deployed anywhere that supports Node-based Next.js apps (e.g. Vercel).

Typical Vercel deployment steps:

1. Push the repository to GitHub/GitLab/Bitbucket.
2. Create a new project in Vercel and import the repo.
3. Configure environment variables (`OPENAI_API_KEY` etc.).
4. Deploy – Vercel will run `npm run build` and host the app.

Refer to the official Next.js deployment docs if you need more details.

