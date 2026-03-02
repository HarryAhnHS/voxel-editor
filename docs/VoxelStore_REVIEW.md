# Voxel Store Review

Review of `app/store/voxelStore.ts` for mutation safety, performance, and undo/redo readiness.

---

## 1. Mutation bugs (Map reuse)

**Verdict: ✅ No Map reuse on writes.**

| Action        | Behavior |
|---------------|----------|
| `addVoxel`    | `new Map(state.voxels)` then `next.set(...)` — new Map reference. |
| `removeVoxel` | `new Map(state.voxels)` then `next.delete(...)` — new Map reference. |
| `clear`       | `createFreshMap()` — new Map. |
| `applyVoxels` | `createFreshMap()` then only our own `next.set(...)` — new Map. |

Zustand/React will see a new `voxels` reference on every mutation, so subscriptions and re-renders behave correctly.

**Shallow copy note:** `new Map(state.voxels)` copies the Map but not the **Voxel objects** inside it. Existing entries are the same object references. So:

- The store itself never mutates those objects.
- If a consumer did `const v = voxels.get('0,0,0'); v.color = 0xff0000`, they would mutate store state.

**Recommendation:** Rely on the contract “don’t mutate voxels you read from the store.” Optional: document in JSDoc on the store or in ARCHITECTURE. Defensive deep-cloning on every read would be expensive and unnecessary for 1k–2k voxels.

---

## 2. Performance pitfalls

**Copy cost on add/remove**

- `addVoxel` and `removeVoxel` do a full copy: `new Map(state.voxels)` → O(n) in current voxel count.
- For 1000–2000 voxels this is a few thousand entries per edit; acceptable per ARCHITECTURE (“acceptable for 1000s”) and avoids structural sharing complexity.

**applyVoxels**

- Replaces the map entirely; does not copy the previous map. Only iterates the input array and fills a new Map. Good.
- Duplicate positions in the input overwrite (same key); `applied` is `next.size` (unique count). Correct.

**Redundant check**

- In `addVoxel`, `clampPosition([x,y,z])` is followed by `isWithinBounds(pos)`. After clamping, `pos` is always in bounds, so `isWithinBounds` is redundant. Harmless; can remove for clarity or keep for defense-in-depth.

**Summary:** No performance bugs. Copy-on-write is intentional and within spec.

---

## 3. Undo/redo readiness

ARCHITECTURE §8: “Command pattern: Each action is a command; stack Command[] for undo/redo; batch LLM generation as single command.”

| Action          | Reversible? | What’s needed |
|-----------------|------------|----------------|
| **addVoxel**    | ✅ Yes     | Undo = `removeVoxel(x,y,z)`. Command stores `{ type: 'add', position, color }`. |
| **removeVoxel** | ✅ Yes     | **Returns `Voxel \| null`** (the removed voxel, or null if none). Undo = `addVoxel(...removed.position, removed.color)` using the return value. |
| **clear**       | ✅ Yes     | Command captures `Array.from(getState().voxels.values())` before `clear()`; undo calls `applyVoxels(snapshot)`. No store change needed. |
| **applyVoxels** | ✅ Yes     | Command captures current voxels (same array conversion) before apply; undo calls `applyVoxels(previousSnapshot)`. No store change needed. |
| **setColor / setTool** | N/A | Usually not on the undo stack (editor UI state). API is fine. |

**Implemented:** `removeVoxel` returns `Voxel | null` so the command can store the return value and use it for undo.

---

## 4. Summary

- **Mutations:** No Map reuse; shallow copy of Map is fine; document “do not mutate voxels from the store.”
- **Performance:** Copy-on-write is acceptable; no extra pitfalls.
- **Undo/redo:** API is ready. **`removeVoxel` returns `Voxel | null`** for easy undo without pre-snapshot.
