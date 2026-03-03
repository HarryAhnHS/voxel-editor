"use client";

import { useState, useCallback, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useVoxelArray, useMeshRef } from "./VoxelInstances";
import { useVoxelStore, keyFromXYZ, isWithinBounds } from "../store/voxelStore";
import { computePlacementCandidate, computePlacementFromEmptySpace } from "../utils/voxelRaycast";
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

      // Raycast against instanced mesh first
      const meshIntersections = raycaster.intersectObject(mesh, false);

      if (meshIntersections.length > 0) {
        // Hit a voxel - in pencil mode, show that we can delete
        // Don't show placement preview when hovering over existing voxel
        setHoverState({
          placementPosition: null,
          isValid: false,
        });
      } else {
        // No voxel hit - show placement preview on active layer plane
        const workPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -activeLayerY);
        const intersectionPoint = new THREE.Vector3();
        const hasIntersection = raycaster.ray.intersectPlane(workPlane, intersectionPoint);

        if (hasIntersection) {
          // Convert intersection point to voxel coordinates on the active layer
          const x = Math.round(intersectionPoint.x);
          const z = Math.round(intersectionPoint.z);
          const y = activeLayerY;

          // Check if position is valid and not occupied
          const placementPosition: VoxelPosition = [x, y, z];
          
          if (isWithinBounds(placementPosition)) {
            const placementKey = keyFromXYZ(x, y, z);
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
      }
    },
    [camera, raycaster, gl.domElement, meshRef, voxels, tool, activeLayerY]
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

      if (meshIntersections.length > 0) {
        // Hit a voxel - in pencil mode, delete it
        const intersection = meshIntersections[0];
        const instanceId = intersection.instanceId;
        if (instanceId !== undefined && instanceId >= 0 && instanceId < voxelArray.length) {
          const voxel = voxelArray[instanceId];
          removeVoxel(...voxel.position);
        }
      } else {
        // No voxel hit - create new voxel on active layer plane
        const workPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -activeLayerY);
        const intersectionPoint = new THREE.Vector3();
        const hasIntersection = raycaster.ray.intersectPlane(workPlane, intersectionPoint);

        if (hasIntersection) {
          // Convert intersection point to voxel coordinates on the active layer
          const x = Math.round(intersectionPoint.x);
          const z = Math.round(intersectionPoint.z);
          const y = activeLayerY;

          // Check if position is valid and not occupied
          const placementPosition: VoxelPosition = [x, y, z];
          
          if (isWithinBounds(placementPosition)) {
            const placementKey = keyFromXYZ(x, y, z);
            const isOccupied = voxels.has(placementKey);
            
            if (!isOccupied) {
              addVoxel(x, y, z);
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
  }, [gl.domElement, camera, raycaster, meshRef, voxelArray, voxels, tool, activeLayerY, addVoxel, removeVoxel, updateHover]);

  return (
    <>
      {/* Ghost cube preview - only show in pencil mode when hovering empty space */}
      {tool === "pencil" && (
        <GhostCube
          position={hoverState.placementPosition}
          visible={hoverState.isValid}
        />
      )}
    </>
  );
}
