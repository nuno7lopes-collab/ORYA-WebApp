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
  timezoneControl?: ReactNode;
  scopeControl?: ReactNode;
  filterControl?: ReactNode;
  overlayControl?: ReactNode;
  actions?: CalendarCommandBarAction[];
  hint?: string;
  className?: string;
};

const CHIP_BASE =
  "inline-flex h-9 items-center rounded-full border border-white/20 bg-black/35 px-3 text-xs text-white/85 transition hover:border-white/40 hover:text-white";

export function CalendarCommandBar({
  view,
  onViewChange,
  rangeLabel,
  onPrevious,
  onNext,
  onToday,
  dateControl,
  timezoneControl,
  scopeControl,
  filterControl,
  overlayControl,
  actions = [],
  hint,
  className,
}: CalendarCommandBarProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/12 bg-[rgba(8,12,22,0.9)] px-3 py-3 shadow-[0_18px_54px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      <div className="orya-scrollbar-hide flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
        <button type="button" onClick={onPrevious} className={CHIP_BASE} aria-label="Anterior">
          ←
        </button>
        <button type="button" onClick={onToday} className={CHIP_BASE}>
          Hoje
        </button>
        <button type="button" onClick={onNext} className={CHIP_BASE} aria-label="Seguinte">
          →
        </button>
        {dateControl ? <div className="inline-flex">{dateControl}</div> : null}
        <span className="inline-flex items-center text-sm font-semibold text-white">{rangeLabel}</span>
        {timezoneControl ? <div className="inline-flex">{timezoneControl}</div> : null}
        <ViewSwitcher value={view} onChange={onViewChange} />
        {scopeControl ? <div className="inline-flex">{scopeControl}</div> : null}
        {filterControl ? <div className="inline-flex">{filterControl}</div> : null}
        {overlayControl ? <div className="inline-flex">{overlayControl}</div> : null}
        {actions.map((action) => {
          const toneClass =
            action.tone === "primary"
              ? "border-cyan-300/45 bg-cyan-400/14 text-cyan-100 hover:border-cyan-300/75"
              : "border-white/20 bg-black/35 text-white/80 hover:border-white/35 hover:text-white";
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
      {hint ? <p className="mt-2 truncate text-[11px] text-white/58">{hint}</p> : null}
    </section>
  );
}

