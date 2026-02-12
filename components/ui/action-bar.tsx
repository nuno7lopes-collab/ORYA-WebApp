"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ActionBarProps = {
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export function ActionBar({ children, className, ...props }: ActionBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-2xl border border-white/12 bg-white/5 p-2 shadow-[0_14px_45px_rgba(0,0,0,0.45)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
