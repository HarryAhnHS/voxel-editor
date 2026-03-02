# Acceptance Criteria & Manual Test Guide

## Deployment

Live URL:
[Insert Vercel link here]

Local Run:

npm install
npm run dev

---

## Core Editor

### 1. Navigation

- Rotate: left mouse drag
- Zoom: scroll
- Pan: right mouse drag

Expected:
Camera moves smoothly without jitter.

---

### 2. Add Voxels

Steps:
1. Select "Add" mode
2. Choose a color
3. Click adjacent to an existing voxel or grid

Expected:
A voxel appears at the placement target.

---

### 3. Remove Voxels

Steps:
1. Select "Remove" mode
2. Click a voxel

Expected:
Voxel disappears.

---

### 4. Performance Test

Steps:
1. Use stress test button (if present)
2. Add ~1000 voxels

Expected:
- Scene remains interactive
- Camera remains smooth

---

## LLM Generation

Steps:
1. Enter prompt (e.g., "small modern house with flat roof")
2. Click Generate

Expected:
- Structured voxel structure appears
- No unbounded expansion
- Voxel count respects cap

Edge Case:
If output exceeds bounds, generation is rejected or clamped.

---

## Undo / Redo (If Implemented)

Steps:
1. Add voxel
2. Press Ctrl+Z
3. Press Ctrl+Shift+Z

Expected:
- Undo reverses last action
- Redo restores it

---

## Code Quality Expectations

- Sparse voxel storage (no 3D array allocation)
- Instanced mesh rendering
- Clear separation of editor logic and rendering
- Schema validation for LLM outputs