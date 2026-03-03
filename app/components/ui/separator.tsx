"use client";

import * as React from "react";
import { cn } from "@/app/lib/utils";

export interface SeparatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
}

export function Separator({
  orientation = "vertical",
  className,
  ...props
}: SeparatorProps) {
  if (orientation === "horizontal") {
    return (
      <div
        className={cn("h-px w-full bg-zinc-800", className)}
        {...props}
      />
    );
  }

  return (
    <div
      className={cn("h-6 w-px bg-zinc-800", className)}
      {...props}
    />
  );
}


