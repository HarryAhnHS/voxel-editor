"use client";

import { useEffect, useState, useRef } from "react";

/**
 * Simple FPS counter for dev performance monitoring.
 * Updates every second to avoid overhead.
 */
export function FPSCounter() {
  const [fps, setFps] = useState<number | null>(null);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Only show in dev mode
    if (process.env.NODE_ENV === "production") {
      return;
    }

    const measureFPS = (now: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
      }

      frameCountRef.current++;

      // Update FPS every second
      if (now - lastTimeRef.current >= 1000) {
        const elapsed = (now - lastTimeRef.current) / 1000;
        const currentFPS = Math.round(frameCountRef.current / elapsed);
        setFps(currentFPS);
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      rafIdRef.current = requestAnimationFrame(measureFPS);
    };

    rafIdRef.current = requestAnimationFrame(measureFPS);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Only show in dev mode
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  if (fps === null) {
    return null;
  }

  // Color code: green >= 55, yellow >= 30, red < 30
  const colorClass =
    fps >= 55 ? "text-green-400" : fps >= 30 ? "text-yellow-400" : "text-red-400";

  return (
    <span className={`text-xs ${colorClass}`}>
      FPS: <strong>{fps}</strong>
    </span>
  );
}

