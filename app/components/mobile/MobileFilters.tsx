"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FilterChipProps = {
  label: string;
  active?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
  className?: string;
};

type SegmentedItem = {
  value: string;
  label: string;
};

type SegmentedTabsProps = {
  items: SegmentedItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function FilterChip({ label, active = false, onClick, icon, className }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
        active
          ? "border-white/35 bg-white/15 text-white shadow-[0_0_18px_rgba(107,255,255,0.2)]"
          : "border-white/15 bg-white/5 text-white/65 hover:border-white/30 hover:text-white",
        className,
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function SegmentedTabs({ items, value, onChange, className }: SegmentedTabsProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/5 p-1 text-[11px] text-white/70",
        className,
      )}
    >
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={cn(
              "rounded-full px-4 py-2 font-semibold transition",
              isActive
                ? "bg-white/18 text-white shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                : "text-white/60 hover:text-white hover:bg-white/10",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
