# Implementation Plan

## Phase 1 – Scene Foundation

- Scaffold Next.js + TypeScript app
- Set up React Three Fiber
- Add:
  - Canvas
  - OrbitControls
  - Grid
  - Lighting

Deliverable:
Basic 3D environment with navigation.

---

## Phase 2 – Editor Core

- Implement sparse voxel store (Map<string, Voxel>)
- Define editor actions:
  - addVoxel
  - removeVoxel
  - setColor
  - setTool
- Implement instanced mesh rendering
- Add stress test (bulk add 1000 voxels)

Deliverable:
Renderable voxel scene supporting 1000+ voxels.

Risk:
Instanced mesh update complexity.

Mitigation:
Rebuild instance buffer only when voxel map changes.

---

## Phase 3 – Interaction

- Implement raycasting
- Map instanceId → voxel
- Compute adjacent placement using face normal
- Add hover preview
- Add toolbar + color palette

Deliverable:
Fully functional voxel editor loop.

---

## Phase 4 – LLM Generation

- Define strict `VoxelSpec` schema (Zod)
- Implement deterministic rasterizer
- Add API route for LLM generation
- Validate and guard output
- Apply batch voxel operations

Deliverable:
Text/code → structured voxel generation.

Risk:
LLM returns invalid JSON.

Mitigation:
Schema validation + retry + hard caps.

---

## Phase 5 – Undo/Redo (If Time)

- Implement command pattern
- Maintain undo/redo stacks
- Add keyboard shortcuts
- Batch commands for generator outputs

Deliverable:
Reversible editing actions.

---

## Final Pass

- Clean UI polish
- Add keyboard shortcuts
- Add performance notes to README
- Validate deployment on Vercel
- Export AI development threads