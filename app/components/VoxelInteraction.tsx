"use client";

import { useState, useCallback, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useVoxelArray, useMeshRef } from "./VoxelInstances";
import { useVoxelStore, keyFromXYZ, isWithinBounds } from "../store/voxelStore";
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
  const addVoxel = useVoxelStore((state) => state.addVoxel);
  const removeVoxel = useVoxelStore((state) => state.removeVoxel);

  // Local hover state - cheap, doesn't trigger store updates
  const [hoverState, setHoverState] = useState<{
    placementPosition: VoxelPosition | null;
    isValid: boolean;
  }>({
    placementPosition: null,
    isValid: false,
  });

  // Perform raycast and update hover state
  const updateHover = useCallback(
    (event: MouseEvent | React.PointerEvent) => {
      // Don't show hover in move mode
      if (tool === "move") {
        setHoverState({
          placementPosition: null,
          isValid: false,
        });
        return;
      }

      const mesh = meshRef.current;
      if (!mesh) return;

      // Convert mouse position to normalized device coordinates
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      // First try surface-adjacent preview when hovering a voxel (Add mode)
      const meshIntersections = raycaster.intersectObject(mesh, false);

      if (editMode === "add" && meshIntersections.length > 0) {
        const intersection = meshIntersections[0];
        const candidate = computePlacementCandidate(intersection, voxelArray, voxels as any);

        if (candidate.isValid && candidate.placementPosition) {
          setHoverState({
            placementPosition: candidate.placementPosition,
            isValid: true,
          });
          return;
        }
        // Fall through to plane preview if candidate is invalid
      }

      // Plane placement preview for Add mode: intersect active layer plane
      const workPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -activeLayerY);
      const intersectionPoint = new THREE.Vector3();
      const hasIntersection = raycaster.ray.intersectPlane(workPlane, intersectionPoint);

      if (hasIntersection) {
        const planeX = Math.round(intersectionPoint.x);
        const planeZ = Math.round(intersectionPoint.z);
        const planeY = activeLayerY;

        const placementPosition: VoxelPosition = [planeX, planeY, planeZ];

        if (isWithinBounds(placementPosition)) {
          const placementKey = keyFromXYZ(planeX, planeY, planeZ);
          const isOccupied = voxels.has(placementKey);

          setHoverState({
            placementPosition: isOccupied ? null : placementPosition,
            isValid: !isOccupied,
          });
        } else {
          setHoverState({
            placementPosition: null,
            isValid: false,
          });
        }
      } else {
        setHoverState({
          placementPosition: null,
          isValid: false,
        });
      }
    },
    [camera, raycaster, gl.domElement, meshRef, voxelArray, voxels, tool, editMode, activeLayerY]
  );

  // Set up native DOM event listeners to avoid interfering with orbit controls
  useEffect(() => {
    const canvas = gl.domElement;
    let isDragging = false;
    let mouseDownPos: { x: number; y: number } | null = null;
    const DRAG_THRESHOLD = 5; // pixels - if mouse moved more than this, it's a drag

    const handleMouseMove = (event: MouseEvent) => {
      if (isDragging) {
        // Check if mouse has moved significantly from initial position
        if (mouseDownPos) {
          const dx = event.clientX - mouseDownPos.x;
          const dy = event.clientY - mouseDownPos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > DRAG_THRESHOLD) {
            // Significant movement detected - this is a drag
            return;
          }
        }
        return;
      }
      updateHover(event);
    };

    const handleMouseDown = (event: MouseEvent) => {
      // Only track left mouse button
      if (event.button === 0) {
        isDragging = true;
        mouseDownPos = { x: event.clientX, y: event.clientY };
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      // Only handle left mouse button
      if (event.button === 0) {
        isDragging = false;
        mouseDownPos = null;
      }
    };

    const handleClick = (event: MouseEvent) => {
      // Only handle left clicks
      if (event.button !== 0) return;
      
      // Don't handle clicks in move mode
      if (tool === "move") {
        mouseDownPos = null;
        return;
      }

      // If there was a drag, don't place blocks
      if (mouseDownPos) {
        const dx = event.clientX - mouseDownPos.x;
        const dy = event.clientY - mouseDownPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > DRAG_THRESHOLD) {
          // This was a drag, not a click - don't place
          mouseDownPos = null;
          return;
        }
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
        const workPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -activeLayerY);
        const intersectionPoint = new THREE.Vector3();
        const hasIntersection = raycaster.ray.intersectPlane(workPlane, intersectionPoint);

        if (hasIntersection) {
          const planeX = Math.round(intersectionPoint.x);
          const planeZ = Math.round(intersectionPoint.z);
          const planeY = activeLayerY;

          const placementPosition: VoxelPosition = [planeX, planeY, planeZ];

          if (isWithinBounds(placementPosition)) {
            const placementKey = keyFromXYZ(planeX, planeY, planeZ);
            const isOccupied = voxels.has(placementKey);

            if (!isOccupied) {
              addVoxel(planeX, planeY, planeZ);
            }
          }
        }
      }
      
      // Clear mouse down position after handling click
      mouseDownPos = null;
    };

    const handleMouseLeave = () => {
      setHoverState({
        placementPosition: null,
        isValid: false,
      });
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
  }, [gl.domElement, camera, raycaster, meshRef, voxelArray, voxels, tool, editMode, activeLayerY, addVoxel, removeVoxel, updateHover]);

  return (
    <>
      {/* Ghost cube preview - only show in pencil mode */}
      {tool === "pencil" && (
        <GhostCube
          position={hoverState.placementPosition}
          visible={hoverState.isValid}
        />
      )}
    </>
  );
}
