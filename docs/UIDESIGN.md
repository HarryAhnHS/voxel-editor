# Voxel Editor – UI & Interaction Design

## 1. Design Philosophy

This editor prioritizes:

- Predictable placement
- Clear tool state
- Performance stability (1000+ voxels)
- Minimal but professional UI
- Full placement freedom (no adjacency required)
- Fast sculpting on existing geometry

The system separates:

1) Camera navigation
2) Editing mode (Add / Remove)
3) Layer selection (Y slice)

Placement behavior is unified under a single hybrid model:
- If cursor is over a voxel, treat that as the primary target (surface behavior).
- If cursor is not over any voxel, fall back to the active layer plane.

This prevents ambiguity while keeping the editor fast to use.

---

## 2. Core Interaction Model

### 2.1 Camera Controls

Orbit-based navigation:

- Left Mouse Drag → Rotate
- Right Mouse Drag → Pan
- Mouse Wheel → Zoom
- R → Reset view

OrbitControls configuration goals:
- Damping enabled
- Zoom distance clamped
- Reasonable rotation speed
- Camera target defaults to world center

The camera is always active. Editing tools do not disable navigation.

---

## 3. Editing Model

Editing behavior depends on:

- ToolMode: Add | Remove
- ActiveLayerY (integer)

Placement is hybrid and does not require a separate placement mode.

---

## 4. Hybrid Placement System

### 4.1 Always-on Work Plane

A work plane exists at Y = ActiveLayerY.

- Plane is rendered visually (grid)
- An invisible plane mesh handles pointer raycasts
- Plane provides full placement freedom when cursor is not over a voxel

This plane is always available and acts as the reference for empty-space placement.

---

### 4.2 Voxel Surface Targeting (Primary When Available)

The voxel instanced mesh is also raycastable.

If the cursor is over an existing voxel:
- You can remove the hovered voxel immediately (Remove tool)
- You can add adjacent voxels by using the face normal (Add tool)
- Hovering should make adjacent placement feel effortless

This enables fast sculpting without needing to switch modes.

---

### 4.3 Hit Selection and Precedence

On hover and click, compute two raycasts:

1) Raycast against the instanced voxel mesh
2) Raycast against the work plane

Choose the active target using this rule:

- If voxel hit exists, use voxel hit (primary)
- Else if plane hit exists, use plane hit (fallback)
- Else no-op

Rationale:
- When geometry exists under the cursor, user intent is usually sculpting.
- When nothing exists under the cursor, user intent is free placement on the active layer.

This keeps behavior consistent and learnable.

---

### 4.4 Add Tool Behavior

When ToolMode = Add:

Case A: Cursor over voxel (voxel hit)
1. Get instanceId
2. Get voxel coordinate V = (vx, vy, vz)
3. Compute adjacent coordinate A = V + faceNormal (rounded to integer axis)
4. If A is empty, add voxel at A using active color

Case B: Cursor not over voxel (plane hit only)
1. Compute coordinate P:
   - x = round(hit.x)
   - z = round(hit.z)
   - y = ActiveLayerY
2. If P is empty, add voxel at P using active color

---

### 4.5 Remove Tool Behavior

When ToolMode = Remove:

Case A: Cursor over voxel (voxel hit)
- Remove voxel at instanceId position

Case B: Cursor not over voxel (plane hit only)
- No-op (optional: allow remove on plane by deleting the voxel at that plane cell if present, but only if it does not add ambiguity)

Recommended for predictability:
- Remove only acts on voxel hits.

---

## 5. Layer System

ActiveLayerY determines work plane height.

Controls:
- Slider in UI
- [ key → layer down
- ] key → layer up

Visual behavior:
- Grid moves to ActiveLayerY
- Display current layer in UI

Layer bounds:
- Example: [-20, 20]
- Clamped to prevent extreme ranges

Optional (if time permits):
- Visual de-emphasis of voxels far from ActiveLayerY (simple opacity or fog-like fade)
- This must not require rebuilding instance buffers, only a shader/material adjustment if attempted.

---

## 6. Hover Preview

Hover preview must not trigger full instanced mesh rebuild.

Hover preview follows the same precedence rule:

- If voxel hit exists:
  - Show ghost cube at adjacent coordinate A (Add tool)
  - Show highlight on hovered voxel (Remove tool)
- Else if plane hit exists:
  - Show ghost cube at plane coordinate P (Add tool)
  - No preview for Remove tool (recommended)

Implementation rule:
- Ghost cube is a separate mesh
- Driven by local component state
- Does not modify voxel store

---

## 7. UI Layout

### Top Toolbar (Recommended)

Top bar contains:

- Tool Toggle: Add | Remove
- Layer Slider (Y)
- Color Palette (8–12 colors)
- Clear Button
- Reset View Button
- Voxel Count Display

Minimal Tailwind styling:
- Fixed top
- Dark translucent background
- Compact spacing

Note:
PlacementMode toggle is removed in this hybrid design to reduce UI complexity.

---

## 8. Keyboard Shortcuts

1 → Add mode  
2 → Remove mode  
[ → Layer down  
] → Layer up  
R → Reset camera  
Ctrl+Z → Undo (if implemented)  
Ctrl+Shift+Z → Redo (if implemented)

---

## 9. Performance Principles

- Single InstancedMesh for voxels
- Rebuild instance matrices only when voxelMap changes
- Hover state must not rebuild instance buffers
- Layer change must not reallocate voxel storage
- Raycasts should be lightweight:
  - Only raycast on pointer move and pointer down
  - Keep hover state local
  - Avoid expensive allocations inside pointer handlers

Target:
- Smooth interaction at 1000+ voxels

---

## 10. Edge Cases to Handle

- Cursor over voxel and plane simultaneously:
  - Voxel always wins
- Attempting to add voxel in occupied cell:
  - No-op
- Clicking empty space (plane hit) in Remove mode:
  - No-op
- Rapid clicking:
  - No duplicate entries, stable performance
- Large scenes:
  - Stable interaction, no major hitches

---

## 11. Visual Guidelines

Keep it clean:

- Neutral background
- Subtle grid
- Soft lighting
- Distinct ghost cube (semi-transparent)
- Clear active color highlight
- Clear tool mode indicator

Avoid:
- Overdesigned UI
- Complex panels
- Excess animations

---

## 12. Future Improvements (If Time)

- X/Z slicing modes
- Layer isolation (hide other layers)
- Box selection tool
- Drag painting
- Scene save/load

---

## 13. Acceptance Alignment

The UI must satisfy:

- Smooth navigation
- Clear tool state
- 1000+ voxel performance
- Full placement freedom via active layer plane
- Fast sculpting via voxel-first targeting
- Predictable precedence rules

If a behavior feels ambiguous, adjust toward predictability.