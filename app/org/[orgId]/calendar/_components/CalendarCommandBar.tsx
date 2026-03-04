"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ViewSwitcher, type CalendarView } from "./ViewSwitcher";

type CalendarCommandBarAction = {
  id: string;
  label: string;
  href?: string;
  onClick?: () => void;
  tone?: "primary" | "neutral";
};

type CalendarCommandBarProps = {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  rangeLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  dateControl?: ReactNode;
  scopeControl?: ReactNode;
  filterControl?: ReactNode;
  actions?: CalendarCommandBarAction[];
  hint?: string;
  className?: string;
};

const CHIP_BASE =
  "inline-flex h-8 items-center rounded-full border border-white/24 bg-white/[0.04] px-3 text-xs text-white/90 transition hover:border-white/40 hover:bg-white/[0.08] hover:text-white";

export function CalendarCommandBar({
  view,
  onViewChange,
  rangeLabel,
  onPrevious,
  onNext,
  onToday,
  dateControl,
  scopeControl,
  filterControl,
  actions = [],
  hint,
  className,
}: CalendarCommandBarProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-white/16 bg-white/[0.03] px-2 py-2",
        className,
      )}
    >
      <div className="orya-scrollbar-hide flex items-center gap-2 overflow-x-auto whitespace-nowrap">
        <button type="button" onClick={onPrevious} className={CHIP_BASE} aria-label="Anterior">
          ←
        </button>
        <button type="button" onClick={onToday} className={CHIP_BASE}>
          Hoje
        </button>
        <button type="button" onClick={onNext} className={CHIP_BASE} aria-label="Seguinte">
          →
        </button>
        <span className="h-5 w-px bg-white/12" />
        {dateControl ? <div className="inline-flex">{dateControl}</div> : null}
        <span className="inline-flex items-center px-1 text-sm font-semibold text-white">{rangeLabel}</span>
        <ViewSwitcher value={view} onChange={onViewChange} />
        {scopeControl ? <div className="inline-flex">{scopeControl}</div> : null}
        {filterControl ? <div className="inline-flex">{filterControl}</div> : null}
        {actions.map((action) => {
          const toneClass =
            action.tone === "primary"
              ? "border-cyan-300/45 bg-cyan-400/12 text-cyan-100 hover:border-cyan-300/75"
              : "border-white/24 bg-white/[0.03] text-white/82 hover:border-white/35 hover:text-white";
          if (action.href) {
            return (
              <Link key={action.id} href={action.href} className={cn(CHIP_BASE, toneClass)}>
                {action.label}
              </Link>
            );
          }
          return (
            <button key={action.id} type="button" onClick={action.onClick} className={cn(CHIP_BASE, toneClass)}>
              {action.label}
            </button>
          );
        })}
      </div>
      {hint ? <p className="mt-1 truncate px-1 text-[12px] text-white/72">{hint}</p> : null}
    </section>
  );
}
