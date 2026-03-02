# Voxel Editor – Architecture Design

## Overview

This document outlines the data model, rendering architecture, and component structure for the voxel editor. The design prioritizes performance (1000+ voxels), clean separation of concerns, and extensibility for LLM-driven generation.

---

## 1. Data Model

### 1.1 Core Types

```typescript
// Position tuple for voxel coordinates
type VoxelPosition = [x: number, y: number, z: number];

// Voxel data structure
interface Voxel {
  position: VoxelPosition;
  color: number; // THREE.Color compatible (0xRRGGBB)
}

// Sparse storage: Map<"x,y,z", Voxel>
type VoxelStore = Map<string, Voxel>;

// Editor state
interface EditorState {
  voxels: VoxelStore;
  selectedColor: number;
  tool: 'add' | 'remove';
  hoverPosition: VoxelPosition | null;
}
```

### 1.2 Key Functions

**Position Key Encoding:**
```typescript
function positionToKey([x, y, z]: VoxelPosition): string {
  return `${x},${y},${z}`;
}

function keyToPosition(key: string): VoxelPosition {
  const [x, y, z] = key.split(',').map(Number);
  return [x, y, z];
}
```

**Why this approach:**
- ✅ O(1) lookup/insert/delete
- ✅ Memory scales with actual voxels, not grid size
- ✅ Simple serialization (Map → Array → JSON)
- ⚠️ String keys have slight overhead vs numeric hashing, but negligible for 1000s of voxels
- ⚠️ No spatial indexing (not needed for 1000s of voxels; could add octree later if scaling to 10k+)

### 1.3 State Management Strategy

**Option A: React Context + useReducer**
- Pros: Built-in, no deps, good for simple state
- Cons: Re-renders entire tree on voxel changes

**Option B: Zustand/Jotai (lightweight)**
- Pros: Granular updates, good performance, simple API
- Cons: External dependency

**Option C: Custom store with React hooks**
- Pros: Full control, minimal deps
- Cons: More boilerplate

**Recommendation: Zustand** - Provides fine-grained subscriptions, good performance, and simple API for editor state.

### 1.4 Constraint Enforcement (Bounds & Voxel Cap)

SPEC 2.4 requires **hard caps** on maximum bounds and maximum voxel count. Enforcement is layered:

| Layer | Responsibility |
|-------|----------------|
| **Store** | Single enforcement point: `addVoxel` and `applyVoxels` clamp positions to bounds and enforce max voxel count. No write path can exceed limits. |
| **Rasterizer** | When processing VoxelSpec: validate spec bounds/count, then filter and clamp to the same constants before calling `applyVoxels`. Ensures predictable generator output and clear errors. |
| **UI** | No enforcement; optional feedback (e.g. "At max voxels", disable add) for better UX. |

**Implementation:** Shared constants and helpers live in `voxelConstraints.ts` (e.g. `BOUNDS_MIN`, `BOUNDS_MAX`, `MAX_VOXEL_COUNT`, `clampPosition`, `isWithinBounds`). The store imports and enforces on every write; the rasterizer imports the same module to validate and filter. Out-of-bounds positions are **clamped** (ACCEPTANCE: "generation is rejected or clamped"); over-cap adds are rejected (no-op); `applyVoxels` fills up to the cap then stops.

---

## 2. Rendering Architecture

### 2.1 Instanced Mesh Strategy

**Single InstancedMesh per voxel type:**
- One `THREE.InstancedMesh` for all voxels
- Shared geometry: `THREE.BoxGeometry(1, 1, 1)` (unit cube)
- Per-instance data:
  - Transform matrix (position)
  - Color (via instanceColor attribute)

**Update Strategy:**
```typescript
// Pseudocode flow
1. VoxelStore changes → trigger update
2. Convert Map to ordered array (for stable instanceId mapping)
3. Update instanceCount
4. Update instance matrices (setMatrixAt)
5. Update instance colors (setColorAt)
6. Mark instanceMatrix/instanceColor as needsUpdate
```

**Critical Performance Considerations:**

1. **Rebuild Frequency:**
   - ✅ Rebuild only when voxel count changes (add/remove)
   - ✅ Update single instance when color changes (if we track instanceId)
   - ⚠️ Full rebuild on every change is acceptable for 1000 voxels (~16ms)
   - ⚠️ For 10k+, consider incremental updates

2. **Instance ID Mapping:**
   - Store ordered array: `Voxel[]` alongside `VoxelStore`
   - `instanceId` = array index
   - On raycast: `instanceId` → array[index] → position key → voxel lookup
   - Tradeoff: Need to maintain order consistency

3. **Geometry Sharing:**
   - Single BoxGeometry shared across all instances
   - Memory: ~144 bytes per instance (matrix + color) vs ~1000+ bytes per individual mesh

### 2.2 Component Structure

```
VoxelScene (Canvas wrapper)
  ├─ SceneContents
  │   ├─ Lights (ambient, directional, hemisphere)
  │   ├─ GridHelper
  │   └─ VoxelInstances (instanced mesh)
  │       └─ Updates when voxelStore changes
  └─ OrbitControls
```

**VoxelInstances Component:**
```typescript
function VoxelInstances({ voxels }: { voxels: VoxelStore }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const voxelArray = useMemo(() => Array.from(voxels.values()), [voxels]);
  
  useEffect(() => {
    // Update instance matrices and colors
    // Called when voxelArray changes
  }, [voxelArray]);
  
  return <instancedMesh ref={meshRef} args={[geometry, material, voxelArray.length]} />;
}
```

**Tradeoffs:**
- ✅ Single draw call for all voxels
- ✅ Efficient GPU batching
- ⚠️ Full rebuild on any change (acceptable for 1000 voxels)
- ⚠️ No per-voxel culling (not needed for small counts)

---

## 3. Interaction Architecture

### 3.1 Raycasting Flow

```
Mouse Click → Raycast → Hit InstancedMesh → Get instanceId → Map to Voxel → Action
```

**Implementation Details:**

1. **Raycast Setup:**
   - Use `@react-three/drei` `useRaycaster` or R3F `useThree().raycaster`
   - Cast from camera through mouse position
   - Intersect with `InstancedMesh`

2. **Instance ID Resolution:**
   ```typescript
   // THREE.js provides instanceId in intersection
   const intersection = raycaster.intersectObject(instancedMesh)[0];
   const instanceId = intersection.instanceId;
   const voxel = voxelArray[instanceId]; // Map to voxel
   ```

3. **Face Normal Computation:**
   - THREE.js intersection includes `face.normal`
   - Use normal to compute adjacent position:
     ```typescript
     const adjacentPos = voxel.position.map((coord, i) => 
       coord + Math.round(face.normal[i])
     );
     ```

**Challenges:**
- ⚠️ InstancedMesh raycasting requires `raycast` method override or helper
- ✅ `@react-three/drei` may have utilities, or use THREE.js directly
- ⚠️ Need to handle edge cases (clicking empty space, clicking grid)

### 3.2 Hover Preview

**Strategy:**
- Separate `Box` component for hover preview (not instanced)
- Position updates on mouse move (raycast)
- Show/hide based on valid placement target
- Visual: Semi-transparent, slightly larger, outline

**Tradeoffs:**
- ✅ Simple, doesn't affect instanced mesh
- ✅ Can use different material/shader
- ⚠️ Extra draw call (negligible)

### 3.3 Tool Modes

**Add Mode:**
- Raycast → find nearest face → place adjacent
- If no voxel hit, place on grid intersection

**Remove Mode:**
- Raycast → hit voxel → remove from store

---

## 4. LLM Integration Architecture

### 4.1 VoxelSpec Schema

```typescript
// Structured spec for LLM output
interface VoxelSpec {
  bounds: {
    min: VoxelPosition;
    max: VoxelPosition;
  };
  voxels: Array<{
    position: VoxelPosition;
    color: string; // Hex color "#RRGGBB"
  }>;
  metadata?: {
    description: string;
    estimatedCount: number;
  };
}

// Validation constraints
const MAX_BOUNDS = 100; // Max dimension
const MAX_VOXELS = 2000; // Hard cap
```

**Why structured:**
- ✅ Predictable format
- ✅ Easy validation (Zod schema)
- ✅ Deterministic rasterization
- ✅ Debuggable (can inspect spec before rendering)

### 4.2 Pipeline Stages

```
User Input → LLM API → VoxelSpec JSON → Validation → Rasterization → VoxelStore Update
```

**Stage 1: LLM Generation (API Route)**
- Input: Natural language or code-like description
- Output: VoxelSpec JSON
- Validation: Schema check, bounds check, voxel count cap
- Error handling: Retry with stricter prompt if invalid

**Stage 2: Rasterization (Client)**
```typescript
function rasterizeSpec(spec: VoxelSpec): VoxelStore {
  const store = new Map<string, Voxel>();
  
  for (const { position, color } of spec.voxels) {
    // Validate position is within bounds
    // Convert hex color to number
    // Add to store
  }
  
  return store;
}
```

**Stage 3: Batch Update**
- Replace entire VoxelStore (or merge if desired)
- Triggers instanced mesh rebuild
- Could be undoable (single "Generate" command)

**Tradeoffs:**
- ✅ Two-stage pipeline ensures safety
- ✅ Hard caps prevent runaway generation
- ⚠️ LLM may produce invalid JSON (handle with retry/fallback)
- ⚠️ Deterministic rasterization means no randomness (good for reproducibility)

---

## 5. Component Architecture

### 5.1 File Structure

```
app/
  components/
    voxel/
      VoxelScene.tsx          # Canvas wrapper
      VoxelInstances.tsx      # Instanced mesh component
      VoxelHoverPreview.tsx   # Hover indicator
      useVoxelRaycast.ts      # Raycast hook
    editor/
      EditorToolbar.tsx       # Tool/color selection
      ColorPalette.tsx        # Color picker
    llm/
      LLMGenerator.tsx        # Input UI for generation
      VoxelSpecValidator.ts   # Schema validation
      rasterizer.ts           # Spec → VoxelStore
  stores/
    voxelStore.ts             # Zustand store
    editorStore.ts            # Editor state (tool, color)
  lib/
    voxel-utils.ts            # Position encoding, helpers
    three-helpers.ts          # THREE.js utilities
  api/
    generate/route.ts         # LLM API endpoint
```

### 5.2 Data Flow

```
User Action → Store Update → Component Re-render → Instanced Mesh Update
```

**Example: Add Voxel**
1. Click → Raycast → Get position
2. `voxelStore.getState().addVoxel(position, color)`
3. Store updates → `VoxelInstances` receives new `voxels` prop
4. `useEffect` triggers → Update instanced mesh
5. Scene re-renders

**Example: LLM Generation**
1. User submits prompt → API call
2. API returns VoxelSpec → Validate
3. Rasterize → `voxelStore.getState().setVoxels(newStore)`
4. Full rebuild of instanced mesh

---

## 6. Performance Considerations

### 6.1 Rendering Optimizations

1. **Instance Updates:**
   - Batch updates: Only rebuild when voxel count changes
   - Use `useMemo` for voxel array conversion
   - Consider `useFrame` throttling for hover updates

2. **Memory:**
   - Sparse storage: ~100 bytes per voxel (position + color + Map overhead)
   - Instanced mesh: ~144 bytes per instance (matrix + color)
   - Total for 1000 voxels: ~240KB (negligible)

3. **Frame Rate:**
   - Target: 60 FPS with 1000 voxels
   - Instanced rendering should achieve this easily
   - Monitor with `@react-three/fiber` `useFrame` FPS counter

### 6.2 Potential Bottlenecks

1. **Full Rebuild on Every Change:**
   - Current: Rebuild entire mesh on add/remove
   - Impact: ~16ms for 1000 voxels (acceptable)
   - Future: Incremental updates for 10k+ voxels

2. **Raycast Performance:**
   - InstancedMesh raycast is O(n) where n = instances
   - For 1000 voxels: ~1ms (acceptable)
   - Future: Spatial acceleration (octree) if needed

3. **State Updates:**
   - Zustand provides fine-grained subscriptions
   - Only components using changed state re-render
   - Avoid unnecessary re-renders of Canvas

---

## 7. Tradeoffs Summary

### Sparse Storage (Map<string, Voxel>)
- ✅ Memory efficient
- ✅ Fast lookups
- ⚠️ No spatial queries (not needed for 1000s)
- ⚠️ String key overhead (negligible)

### Instanced Rendering
- ✅ Single draw call
- ✅ GPU efficient
- ⚠️ Full rebuild on changes (acceptable for 1000s)
- ⚠️ No per-instance culling (not needed)

### Raycast-Based Interaction
- ✅ Intuitive UX
- ✅ Works with instanced mesh
- ⚠️ Requires instanceId mapping
- ⚠️ O(n) complexity (acceptable for 1000s)

### LLM Two-Stage Pipeline
- ✅ Safe and predictable
- ✅ Easy to debug
- ⚠️ LLM may produce invalid JSON (handle with retry)
- ⚠️ No randomness (by design)

---

## 8. Future Extensibility

### Undo/Redo
- Command pattern: Each action is a command
- Stack: `Command[]` for undo, `Command[]` for redo
- Batch LLM generation as single command

### Spatial Acceleration
- Octree for 10k+ voxels
- Only needed if performance degrades

### Per-Instance Updates
- Track instanceId → voxel mapping
- Update single instance on color change
- Only rebuild on add/remove

### Export/Import
- Serialize VoxelStore → JSON
- VoxelSpec can serve as export format

---

## 9. Implementation Order

1. **Data Model** (stores, types, utilities)
2. **Instanced Rendering** (VoxelInstances component)
3. **Raycast Interaction** (add/remove voxels)
4. **Hover Preview** (visual feedback)
5. **LLM Integration** (API, validation, rasterization)
6. **UI Polish** (toolbar, color palette)

This architecture provides a solid foundation that scales to 1000+ voxels while remaining clean and extensible.

