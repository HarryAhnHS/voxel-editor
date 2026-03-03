# Voxel Editor – UI & Interaction Design

## 1. Design Philosophy

This editor prioritizes:

- Predictable placement
- Clear tool state
- Performance stability (1000+ voxels)
- Minimal but professional UI
- Full placement freedom (no adjacency required)

The system separates:

1) Camera navigation
2) Editing mode (Add / Remove)
3) Placement mode (Plane / Surface)
4) Layer selection (Y slice)

This prevents ambiguity and keeps behavior consistent.

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
- PlacementMode: Plane | Surface
- ActiveLayerY (integer)

---

## 4. Placement Modes

### 4.1 Plane Placement (Primary Mode)

This mode allows full freedom — voxels can be added anywhere.

Mechanism:
- A work plane exists at Y = ActiveLayerY
- Plane is rendered visually (grid)
- An invisible mesh handles pointer raycasts

When clicking in Add mode:
1. Raycast against plane
2. Convert hit point to voxel coordinates:
   - x = round(hit.x)
   - z = round(hit.z)
   - y = ActiveLayerY
3. If cell is empty → add voxel

Remove mode:
- Raycast instanced mesh
- Remove voxel at instanceId position

Advantages:
- Can place isolated voxels
- Clear mental model
- Works across layers
- Simple implementation

This is the default placement mode.

---

### 4.2 Surface Placement (Secondary Mode)

Used for sculpting existing geometry.

Add mode:
1. Raycast instanced mesh
2. Get instanceId
3. Compute adjacent coordinate using face normal
4. Add voxel at adjacent position

Remove mode:
- Raycast instanced mesh
- Remove clicked voxel

Surface mode only works when clicking existing voxels.

---

## 5. Layer System

ActiveLayerY determines work plane height.

Controls:
- Slider in UI
- [ key → layer down
- ] key → layer up

Visual behavior:
- Grid moves to ActiveLayerY
- Optional: fade voxels not on active layer (if time permits)
- Display current layer in UI

Layer bounds:
- Example: [-20, 20] or [0, 30]
- Clamped to prevent extreme ranges

---

## 6. Hover Preview

Hover preview must not trigger full instanced mesh rebuild.

Behavior:

Plane mode:
- Ghost cube appears at computed (x, ActiveLayerY, z)

Surface mode:
- Ghost cube appears at adjacent position using face normal

Implementation rule:
- Ghost cube is a separate mesh
- Driven by local component state
- Does not modify voxel store

---

## 7. UI Layout

### Option A: Top Toolbar (Recommended)

Top bar contains:

- Tool Toggle: Add | Remove
- Placement Toggle: Plane | Surface
- Layer Slider (Y)
- Color Palette (8–12 colors)
- Clear Button
- Reset View Button
- Voxel Count Display

Minimal Tailwind styling:
- Fixed top
- Dark translucent background
- Compact spacing

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

Target:
- Smooth interaction at 1000+ voxels

---

## 10. Edge Cases to Handle

- Clicking empty space in Surface mode → no-op
- Attempting to add voxel in occupied cell → no-op
- Clicking below/above plane → no placement
- Rapid clicking → no duplicate entries
- Large scenes → stable performance

---

## 11. Visual Guidelines

Keep it clean:

- Neutral background
- Subtle grid
- Soft lighting
- Distinct ghost cube (semi-transparent)
- Clear active color highlight

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
- Full placement freedom
- Predictable layer behavior
- Intuitive add/remove

If a behavior feels ambiguous, adjust toward predictability.