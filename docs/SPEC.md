# Voxel Editor – Specification

## 1. Goal

Build a browser-based voxel editor using TypeScript and Next.js that allows users to:

- Place and remove colored voxels on a 3D grid
- Navigate in 3D (rotate, zoom, pan)
- Select colors from a palette
- Support 1000+ voxels with smooth performance
- Generate voxel structures from text or code using an LLM
- (If implemented) Support undo/redo

The focus is a strong core editor foundation with clean architecture and performance-aware rendering.

---

## 2. Core Requirements

### 2.1 Editor Interaction

- Click to place voxels
- Click to remove voxels
- Visual hover indicator for placement target
- Tool mode toggle (Add / Remove)
- Color selection palette

### 2.2 Navigation

- Orbit controls (rotate)
- Zoom
- Pan
- Stable camera defaults

### 2.3 Rendering Performance

- Must handle 1000+ voxels smoothly
- Use instanced rendering to minimize draw calls
- Sparse voxel storage to avoid cubic memory allocation

### 2.4 LLM Generation

Users can input:
- Natural language (e.g., "small modern 2-story house")
- Structured code-like instructions
- Simple function-style descriptions

System behavior:
- LLM produces a structured `VoxelSpec` (strict JSON)
- App validates the spec
- App deterministically rasterizes the spec into voxels
- Hard caps on:
  - Maximum bounds
  - Maximum voxel count

---

## 3. Architecture Decisions

### 3.1 Data Model

Voxels are stored in a sparse structure:

Map<string, Voxel> where key = "x,y,z"

This avoids allocating a full 3D array and scales efficiently.

### 3.2 Rendering

- Single `THREE.InstancedMesh` for voxels
- Per-instance transforms and colors
- Rebuilt only when voxel set changes

### 3.3 Interaction

- Raycasting against instanced mesh
- Use `instanceId` to map click to voxel
- Use face normal to compute adjacent placement

### 3.4 LLM Pipeline

Two-stage pipeline:

1. Input → VoxelSpec (JSON)
2. VoxelSpec → deterministic voxel rasterization

This ensures:
- Predictability
- Guardrails
- Debuggability

---

## 4. Non-Goals

- Advanced lighting (global illumination, shadows)
- Physics
- Multiplayer
- Infinite world
- Persistent cloud storage

---

## 5. Success Criteria

- Editor feels smooth and intuitive
- Performance remains stable at 1000+ voxels
- LLM generation produces bounded, structured outputs
- Clean, readable, modular code