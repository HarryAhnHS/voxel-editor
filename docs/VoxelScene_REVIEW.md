# VoxelScene Component Review

## Against SPEC Navigation Requirements

**SPEC Requirements:**
- ✅ Orbit controls (rotate) - Present
- ✅ Zoom - Present  
- ✅ Pan - Present
- ✅ Stable camera defaults - Present

**ACCEPTANCE.md Requirements:**
- ✅ Rotate: left mouse drag - Default OrbitControls behavior
- ✅ Zoom: scroll - Default OrbitControls behavior
- ⚠️ Pan: right mouse drag - Default, but `screenSpacePanning={false}` may feel off

---

## 1. SSR/Hydration Risks

### ✅ **Low Risk (Currently Safe)**

1. **Component is client-only:**
   - `"use client"` directive present
   - Dynamically imported with `ssr: false` in `page.tsx`
   - No server-side rendering of Canvas

2. **Potential Issues (Minor):**
   - `dpr={[1, 2]}` - Device pixel ratio is client-dependent, but safe since component is client-only
   - `useMemo` for gridConfig - Safe, no hydration concerns
   - Canvas initialization - R3F handles client-side mounting correctly

**Verdict:** No SSR/hydration risks identified. The component is properly isolated.

---

## 2. Control Settings That Will Feel Bad in an Editor

### 🔴 **Critical Issues**

1. **`screenSpacePanning={false}`** (Line 67)
   - **Problem:** Panning is relative to camera orientation, not screen space
   - **Impact:** When rotated, dragging "right" moves in camera space, not screen space. Very disorienting for precise editing.
   - **Fix:** Change to `screenSpacePanning={true}` for intuitive editor feel

2. **Restrictive zoom limits** (Lines 64-65)
   - `minDistance={4}` - May prevent zooming in close enough for detailed work
   - `maxDistance={60}` - May prevent zooming out to see large structures
   - **Impact:** Users may feel constrained when working with different scales
   - **Fix:** Increase range (e.g., `minDistance={2}`, `maxDistance={100}`)

3. **Heavy damping** (Line 63)
   - `dampingFactor={0.08}` - Very low value = heavy damping
   - **Impact:** Camera feels sluggish, imprecise for quick adjustments
   - **Fix:** Increase to `0.1-0.15` for snappier feel, or make it configurable

### 🟡 **Moderate Issues**

4. **Polar angle restriction** (Line 66)
   - `maxPolarAngle={Math.PI * 0.495}` - Prevents going fully upside down
   - **Impact:** Good for preventing disorientation, but may feel restrictive
   - **Note:** This is actually reasonable for an editor, but could be slightly more permissive

5. **No explicit control enables**
   - Missing explicit `enablePan`, `enableRotate`, `enableZoom` props
   - **Impact:** Relies on defaults, less explicit control
   - **Fix:** Add explicit props for clarity and future control

6. **Camera position** (Line 53)
   - `position={[10, 10, 10]}` - Arbitrary starting position
   - **Impact:** May not be optimal viewing angle for voxel editing
   - **Note:** Acceptable default, but could be tuned

---

## 3. Easy UX Improvements (<15 Minutes)

### ✅ **Quick Wins**

1. **Fix screen space panning** (1 min)
   ```tsx
   screenSpacePanning={true}  // Change from false
   ```

2. **Relax zoom limits** (1 min)
   ```tsx
   minDistance={2}   // Allow closer zoom
   maxDistance={100} // Allow further zoom
   ```

3. **Reduce damping for snappier feel** (1 min)
   ```tsx
   dampingFactor={0.12}  // Increase from 0.08
   ```

4. **Add explicit control enables** (1 min)
   ```tsx
   enablePan={true}
   enableRotate={true}
   enableZoom={true}
   ```

5. **Add camera target for better orbit** (2 min)
   ```tsx
   <OrbitControls
     target={[0, 0, 0]}  // Orbit around origin
     // ... other props
   />
   ```

6. **Improve grid visibility** (3 min)
   - Increase grid contrast for better visibility during editing
   - Consider making grid colors configurable or more visible
   ```tsx
   colorCenterLine: 0x666666,  // Lighter
   colorGrid: 0x444444,        // Lighter
   ```

7. **Add subtle axis helper** (5 min)
   - Helps with orientation during editing
   ```tsx
   <axesHelper args={[5]} />  // 5 unit axes
   ```

**Total Estimated Time:** ~14 minutes for all improvements

---

## Summary

### Must Fix (Before Editor Use)
- `screenSpacePanning={false}` → `true`
- Zoom limits too restrictive
- Damping too heavy

### Should Fix (Better UX)
- Explicit control enables
- Camera target
- Grid visibility

### Nice to Have
- Axis helper
- Camera position tuning

---

## Recommended Priority

1. **Immediate:** Fix screen space panning (critical for editor feel)
2. **Immediate:** Relax zoom limits (prevents frustration)
3. **Quick:** Reduce damping (better responsiveness)
4. **Quick:** Add explicit enables + camera target (cleaner, more predictable)
5. **Optional:** Grid + axis improvements (polish)


