"use client";

import * as React from "react";
import { HexColorPicker, HexColorInput } from "react-colorful";
import { cn } from "@/app/lib/utils";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  presets?: string[];
  className?: string;
}

export function ColorPicker({ color, onChange, presets, className }: ColorPickerProps) {

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative rounded-md border border-zinc-700/50 overflow-hidden bg-zinc-900/50">
        <HexColorPicker
          color={color}
          onChange={onChange}
          style={{ width: "100%", height: "128px" }}
        />
      </div>
      {presets && presets.length > 0 && (
        <div className="grid grid-cols-8 gap-1.5">
          {presets.map((presetColor) => {
            const isActive = color.toLowerCase() === presetColor.toLowerCase();
            return (
              <button
                key={presetColor}
                type="button"
                onClick={() => onChange(presetColor)}
                className={cn(
                  "h-7 w-7 rounded-md border-2 transition-all hover:scale-110",
                  isActive
                    ? "border-zinc-100 ring-2 ring-zinc-100/50 ring-offset-2 ring-offset-zinc-950"
                    : "border-zinc-700/50 hover:border-zinc-500"
                )}
                style={{ backgroundColor: presetColor }}
                aria-label={`Color ${presetColor}`}
              />
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2">
        <div
          className="h-9 w-12 rounded-md border border-zinc-700/50 bg-zinc-900/50 flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <HexColorInput
          color={color}
          onChange={onChange}
          prefixed
          className="flex-1 rounded-md border border-zinc-700/50 bg-zinc-900/50 px-3 py-1.5 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-500"
        />
      </div>
    </div>
  );
}
