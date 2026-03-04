"use client";

import { useState, useCallback, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useVoxelArray, useMeshRef } from "./VoxelInstances";
import { useVoxelStore, keyFromXYZ, isWithinBounds, type Voxel } from "../store/voxelStore";
import { computePlacementCandidate } from "../utils/voxelRaycast";
import { GhostCube } from "./GhostCube";
import type { VoxelPosition } from "../store/voxelStore";

/**
 * Handles raycasting interactions for voxel placement and removal.
 * 
 * Pencil tool behavior:
 * - Click empty space → create voxel
 * - Click existing voxel → delete voxel
 * 
 * Move tool: Only camera movement, no editing
 */
export function VoxelInteraction() {
  const { camera, raycaster, gl } = useThree();
  const meshRef = useMeshRef();
  const voxelArray = useVoxelArray();
  const voxels = useVoxelStore((state) => state.voxels);
  const tool = useVoxelStore((state) => state.tool);
  const editMode = useVoxelStore((state) => state.editMode);
  const activeLayerY = useVoxelStore((state) => state.activeLayerY);
  const planeAxis = useVoxelStore((state) => state.planeAxis);
  const selectedColor = useVoxelStore((state) => state.selectedColor);
  const addVoxel = useVoxelStore((state) => state.addVoxel);
  const removeVoxel = useVoxelStore((state) => state.removeVoxel);
  const recolorVoxel = useVoxelStore((state) => state.recolorVoxel);
  const recolorVoxels = useVoxelStore((state) => state.recolorVoxels);
  const setPointerPosition = useVoxelStore((state) => state.setPointerPosition);

  // Local hover state - cheap, doesn't trigger store updates
  const [hoverState, setHoverState] = useState<{
    placementPosition: VoxelPosition | null;
    isValid: boolean;
  }>({
    placementPosition: null,
    isValid: false,
  });

  // Separate hover state for remove mode (highlights the voxel that would be deleted)
  const [removeHover, setRemoveHover] = useState<{
    position: VoxelPosition;
    color: number;
  } | null>(null);

  // Preview for flood-fill recolor (Shift+Brush)
  const [recolorFloodPreview, setRecolorFloodPreview] = useState<VoxelPosition[] | null>(null);

  // Helper: compute all connected voxels of the same color starting from a seed position.
  const computeConnectedRegion = useCallback(
    (start: VoxelPosition, originalColor: number): VoxelPosition[] => {
      const result: VoxelPosition[] = [];
      const visited = new Set<string>();
      const queue: VoxelPosition[] = [start];
      const voxelMap = voxels as any as Map<string, Voxel>;

      while (queue.length > 0) {
        const [cx, cy, cz] = queue.shift()!;
        const key = keyFromXYZ(cx, cy, cz);
        if (visited.has(key)) continue;
        visited.add(key);

        const current = voxelMap.get(key);
        if (!current || current.color !== originalColor) continue;

        result.push([cx, cy, cz]);

        // 6-connected neighbors
        queue.push([cx + 1, cy, cz]);
        queue.push([cx - 1, cy, cz]);
        queue.push([cx, cy + 1, cz]);
        queue.push([cx, cy - 1, cz]);
        queue.push([cx, cy, cz + 1]);
        queue.push([cx, cy, cz - 1]);
      }

      return result;
    },
    [voxels]
  );

  // Perform raycast and update hover state
  const updateHover = useCallback(
    (event: MouseEvent | React.PointerEvent) => {
      // No hover feedback in move mode
      if (tool === "move") {
        setHoverState({
          placementPosition: null,
          isValid: false,
        });
        setRemoveHover(null);
        setRecolorFloodPreview(null);
        setPointerPosition(null);
        return;
      }

      const mesh = meshRef.current;
      if (!mesh) return;

      // Convert mouse position to normalized device coordinates
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const meshIntersections = raycaster.intersectObject(mesh, false);

      // Remove mode: highlight the voxel that would be deleted
      if (editMode === "remove") {
        if (meshIntersections.length > 0) {
          const intersection = meshIntersections[0];
          const instanceId = intersection.instanceId;
          if (
            instanceId !== undefined &&
            instanceId >= 0 &&
            instanceId < voxelArray.length
          ) {
            const voxel = voxelArray[instanceId] as Voxel;
            setRemoveHover({
              position: voxel.position,
              color: voxel.color,
            });
            setPointerPosition(voxel.position);
              setRecolorFloodPreview(null);
            setHoverState({
              placementPosition: null,
              isValid: false,
            });
            return;
          }
        }

        // Not hovering any voxel
        setRemoveHover(null);
        setHoverState({
          placementPosition: null,
          isValid: false,
        });
        setRecolorFloodPreview(null);
        setPointerPosition(null);
        return;
      }

      // Recolor mode: highlight the voxel(s) that would be recolored
      if (editMode === "recolor") {
        if (meshIntersections.length > 0) {
          const intersection = meshIntersections[0];
          const instanceId = intersection.instanceId;
          if (
            instanceId !== undefined &&
            instanceId >= 0 &&
            instanceId < voxelArray.length
          ) {
            const voxel = voxelArray[instanceId] as Voxel;
            const [vx, vy, vz] = voxel.position;
            const originalColor = voxel.color;

            // If Shift is held, preview the entire connected region
            if ((event as MouseEvent).shiftKey || (event as any).shiftKey) {
              if (originalColor !== selectedColor) {
                const region = computeConnectedRegion([vx, vy, vz], originalColor);
                setRecolorFloodPreview(region);
              } else {
                setRecolorFloodPreview(null);
              }
              setRemoveHover(null);
            } else {
              // Single-voxel recolor preview
              setRemoveHover({
                position: voxel.position,
                color: selectedColor, // Show new color in preview
              });
              setRecolorFloodPreview(null);
            }

            setPointerPosition(voxel.position);
            setHoverState({
              placementPosition: null,
              isValid: false,
            });
            return;
          }
        }

        // Not hovering any voxel
        setRemoveHover(null);
        setRecolorFloodPreview(null);
        setHoverState({
          placementPosition: null,
          isValid: false,
        });
        setPointerPosition(null);
        return;
      }

      // Add mode: adjacency preview when hovering a voxel, otherwise plane preview
      setRemoveHover(null);
      setRecolorFloodPreview(null);

      // First try surface-adjacent preview when hovering a voxel (Add mode)
      if (meshIntersections.length > 0) {
        const intersection = meshIntersections[0];
        const candidate = computePlacementCandidate(
          intersection,
          voxelArray,
          voxels as any
        );

        if (candidate.isValid && candidate.placementPosition) {
          setPointerPosition(candidate.placementPosition);
          setHoverState({
            placementPosition: candidate.placementPosition,
            isValid: true,
          });
          return;
        }
        // Fall through to plane preview if candidate is invalid
      }

      // Plane placement preview for Add mode: intersect active layer plane
      const normal =
        planeAxis === "x"
          ? new THREE.Vector3(1, 0, 0)
          : planeAxis === "z"
          ? new THREE.Vector3(0, 0, 1)
          : new THREE.Vector3(0, 1, 0);
      const workPlane = new THREE.Plane(normal, -activeLayerY);
      const intersectionPoint = new THREE.Vector3();
      const hasIntersection = raycaster.ray.intersectPlane(workPlane, intersectionPoint);

      if (hasIntersection) {
        let px: number;
        let py: number;
        let pz: number;

        switch (planeAxis) {
          case "x":
            px = activeLayerY;
            py = Math.round(intersectionPoint.y);
            pz = Math.round(intersectionPoint.z);
            break;
          case "z":
            px = Math.round(intersectionPoint.x);
            py = Math.round(intersectionPoint.y);
            pz = activeLayerY;
            break;
          case "y":
          default:
            px = Math.round(intersectionPoint.x);
            py = activeLayerY;
            pz = Math.round(intersectionPoint.z);
            break;
        }

        const placementPosition: VoxelPosition = [px, py, pz];

        if (isWithinBounds(placementPosition)) {
          const placementKey = keyFromXYZ(px, py, pz);
          const isOccupied = voxels.has(placementKey);

          setPointerPosition(placementPosition);
          setHoverState({
            placementPosition: isOccupied ? null : placementPosition,
            isValid: !isOccupied,
          });
        } else {
          setHoverState({
            placementPosition: null,
            isValid: false,
          });
          setPointerPosition(null);
        }
      } else {
        setHoverState({
          placementPosition: null,
          isValid: false,
        });
        setPointerPosition(null);
      }
    },
    [camera, raycaster, gl.domElement, meshRef, voxelArray, voxels, tool, editMode, planeAxis, activeLayerY, selectedColor, setPointerPosition, computeConnectedRegion]
  );

  // Set up native DOM event listeners to avoid interfering with orbit controls
  useEffect(() => {
    const canvas = gl.domElement;
    let isMouseDown = false;
    let hasDragged = false;
    let mouseDownPos: { x: number; y: number } | null = null;
    const DRAG_THRESHOLD = 5; // pixels - if mouse moved more than this, it's a drag

    const handleMouseMove = (event: MouseEvent) => {
      if (isMouseDown && mouseDownPos) {
        const dx = event.clientX - mouseDownPos.x;
        const dy = event.clientY - mouseDownPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > DRAG_THRESHOLD) {
          // Mark as a drag; subsequent mouseup+click should not edit voxels
          hasDragged = true;
          return; // while dragging, don't update hover
        }
      }

      // Only update hover when not in a drag interaction
      if (!hasDragged) {
        updateHover(event);
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      // Only track left mouse button
      if (event.button === 0) {
        isMouseDown = true;
        hasDragged = false;
        mouseDownPos = { x: event.clientX, y: event.clientY };
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      // Only handle left mouse button
      if (event.button === 0) {
        isMouseDown = false;
        // Keep mouseDownPos/hasDragged for the click handler to inspect
      }
    };

    const handleClick = (event: MouseEvent) => {
      // Only handle left clicks
      if (event.button !== 0) return;
      
      // Don't handle clicks in move mode
      if (tool === "move") {
        mouseDownPos = null;
        hasDragged = false;
        return;
      }

      // If this interaction was a drag, don't place/remove
      if (hasDragged) {
        mouseDownPos = null;
        hasDragged = false;
        return;
      }
      
      const mesh = meshRef.current;
      if (!mesh) return;

      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const meshIntersections = raycaster.intersectObject(mesh, false);
      
      if (editMode === "remove") {
        // Remove mode: raycast instanced mesh and remove clicked voxel
        if (meshIntersections.length > 0) {
          const intersection = meshIntersections[0];
          const instanceId = intersection.instanceId;
          if (instanceId !== undefined && instanceId >= 0 && instanceId < voxelArray.length) {
            const voxel = voxelArray[instanceId];
            removeVoxel(...voxel.position);
          }
        }
      } else if (editMode === "recolor") {
        // Recolor mode: single-click or shift-click flood fill of connected voxels
        if (meshIntersections.length > 0 && !hasDragged) {
          const intersection = meshIntersections[0];
          const instanceId = intersection.instanceId;
          if (instanceId !== undefined && instanceId >= 0 && instanceId < voxelArray.length) {
            const voxel = voxelArray[instanceId] as Voxel;
            const [vx, vy, vz] = voxel.position;
            const originalColor = voxel.color;

            if (event.shiftKey) {
              // Flood fill all connected voxels with the same original color (single history entry)
              if (originalColor !== selectedColor) {
                const region = computeConnectedRegion([vx, vy, vz], originalColor);
                if (region.length > 0) {
                  const updates = region.map(([x, y, z]) => ({
                    x,
                    y,
                    z,
                    color: selectedColor,
                  }));
                  recolorVoxels(updates);
                }
              }
            } else {
              // Simple single-voxel recolor (one history entry via recolorVoxel)
              recolorVoxel(vx, vy, vz, selectedColor);
            }
          }
        }
      } else {
        // Add mode: prefer adjacent placement when clicking an existing voxel
        if (meshIntersections.length > 0) {
          const intersection = meshIntersections[0];
          const candidate = computePlacementCandidate(intersection, voxelArray, voxels as any);

          if (candidate.isValid && candidate.placementPosition) {
            const [cx, cy, cz] = candidate.placementPosition;
            addVoxel(cx, cy, cz);
            mouseDownPos = null;
            return;
          }
        }

        // Fallback: plane placement on active layer
        const normal =
          planeAxis === "x"
            ? new THREE.Vector3(1, 0, 0)
            : planeAxis === "z"
            ? new THREE.Vector3(0, 0, 1)
            : new THREE.Vector3(0, 1, 0);
        const workPlane = new THREE.Plane(normal, -activeLayerY);
        const intersectionPoint = new THREE.Vector3();
        const hasIntersection = raycaster.ray.intersectPlane(workPlane, intersectionPoint);

        if (hasIntersection) {
          let px: number;
          let py: number;
          let pz: number;

          switch (planeAxis) {
            case "x":
              px = activeLayerY;
              py = Math.round(intersectionPoint.y);
              pz = Math.round(intersectionPoint.z);
              break;
            case "z":
              px = Math.round(intersectionPoint.x);
              py = Math.round(intersectionPoint.y);
              pz = activeLayerY;
              break;
            case "y":
            default:
              px = Math.round(intersectionPoint.x);
              py = activeLayerY;
              pz = Math.round(intersectionPoint.z);
              break;
          }

          const placementPosition: VoxelPosition = [px, py, pz];

          if (isWithinBounds(placementPosition)) {
            const placementKey = keyFromXYZ(px, py, pz);
            const isOccupied = voxels.has(placementKey);

            if (!isOccupied) {
              addVoxel(px, py, pz);
            }
          }
        }
      }
      
      // Clear mouse down position after handling click
      mouseDownPos = null;
      hasDragged = false;
    };

    const handleMouseLeave = () => {
      setHoverState({
        placementPosition: null,
        isValid: false,
      });
      setRemoveHover(null);
      setPointerPosition(null);
      isMouseDown = false;
      hasDragged = false;
      mouseDownPos = null;
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [gl.domElement, camera, raycaster, meshRef, voxelArray, voxels, tool, editMode, activeLayerY, addVoxel, removeVoxel, recolorVoxel, recolorVoxels, selectedColor, updateHover, computeConnectedRegion]);

  return (
    <>
      {/* Add mode: placement ghost cube */}
      {tool === "pencil" && editMode === "add" && (
        <GhostCube
          position={hoverState.placementPosition}
          visible={hoverState.isValid}
          color={selectedColor}
        />
      )}

      {/* Remove mode: highlight the voxel that would be deleted */}
      {tool === "pencil" && editMode === "remove" && removeHover && (
        <GhostCube
          position={removeHover.position}
          visible={true}
          color={removeHover.color}
        />
      )}

      {/* Recolor mode: highlight voxel(s) that would be recolored */}
      {tool === "pencil" && editMode === "recolor" && recolorFloodPreview && recolorFloodPreview.length > 0 && (
        <>
          {recolorFloodPreview.map(([x, y, z]) => (
            <GhostCube
              key={keyFromXYZ(x, y, z)}
              position={[x, y, z]}
              visible={true}
              color={selectedColor}
            />
          ))}
        </>
      )}

      {tool === "pencil" && editMode === "recolor" && !recolorFloodPreview && removeHover && (
        <GhostCube
          position={removeHover.position}
          visible={true}
          color={removeHover.color}
        />
      )}
    </>
  );
}
