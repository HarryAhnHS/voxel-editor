"use client";

import * as React from "react";
import { cn } from "@/app/lib/utils";

type ButtonVariant = "default" | "outline" | "ghost" | "icon" | "primary" | "subtle";
type ButtonSize = "sm" | "md" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-50 disabled:pointer-events-none";

    const variantClass: Record<ButtonVariant, string> = {
      default: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
      primary: "bg-blue-600 text-white hover:bg-blue-500",
      outline:
        "border border-zinc-700 bg-transparent text-zinc-100 hover:bg-zinc-800",
      ghost: "bg-transparent text-zinc-300 hover:bg-zinc-800/70",
      icon: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
      subtle: "bg-zinc-900 text-zinc-200 hover:bg-zinc-800",
    };

    const sizeClass: Record<ButtonSize, string> = {
      sm: "h-7 px-2.5 text-xs",
      md: "h-8 px-3 text-sm",
      icon: "h-8 w-8",
    };

    return (
      <button
        ref={ref}
        className={cn(base, variantClass[variant], sizeClass[size], className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";


