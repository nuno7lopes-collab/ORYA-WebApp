"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getDateParts } from "@/lib/reservas/availability";
import { cn } from "@/lib/utils";
import {
  addMonthsToParts,
  buildMonthCells,
  buildZonedDate,
  formatHeaderDate,
  formatMonthLabel,
} from "./helpers";

type DatePickerTwoMonthsProps = {
  selectedDate: Date;
  timezone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectDate: (date: Date) => void;
};

const WEEKDAY_LABELS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

export function DatePickerTwoMonths({
  selectedDate,
  timezone,
  open,
  onOpenChange,
  onSelectDate,
}: DatePickerTwoMonthsProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedParts = getDateParts(selectedDate, timezone);
  const [baseMonth, setBaseMonth] = useState({ year: selectedParts.year, month: selectedParts.month });

  useEffect(() => {
    if (!open) return;
    setBaseMonth({ year: selectedParts.year, month: selectedParts.month });
  }, [open, selectedParts.month, selectedParts.year]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onOpenChange, open]);

  const nextMonth = useMemo(() => addMonthsToParts(baseMonth, 1), [baseMonth]);
  const todayParts = getDateParts(new Date(), timezone);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onOpenChange(true);
          }
        }}
        className={cn(
          "inline-flex h-10 min-w-[170px] items-center justify-between gap-2 rounded-full border border-white/15",
          "bg-black/30 px-3 text-sm text-white/80 transition hover:border-white/35 hover:text-white",
          open && "border-cyan-300/60 text-white",
        )}
      >
        <span className="truncate">{formatHeaderDate(selectedDate, timezone)}</span>
        <span className="text-[10px] text-white/55">▼</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Selecionar data"
          className={cn(
            "absolute left-0 top-[calc(100%+8px)] z-50 rounded-2xl border border-white/15 bg-[#111319]/95 p-4",
            "shadow-[0_36px_90px_rgba(0,0,0,0.7)] backdrop-blur-xl",
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setBaseMonth((current) => addMonthsToParts(current, -1))}
              className="rounded-full border border-white/15 px-3 py-1 text-sm text-white/75 transition hover:border-white/35 hover:text-white"
              aria-label="Mês anterior"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setBaseMonth((current) => addMonthsToParts(current, 1))}
              className="rounded-full border border-white/15 px-3 py-1 text-sm text-white/75 transition hover:border-white/35 hover:text-white"
              aria-label="Mês seguinte"
            >
              →
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-1">
            {[baseMonth, nextMonth].map((month) => {
              const rows = buildMonthCells(month);
              return (
                <div key={`${month.year}-${month.month}`} className="w-[280px] max-w-[80vw] shrink-0">
                  <p className="mb-2 text-center text-sm font-semibold text-white">{formatMonthLabel(month)}</p>
                  <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-white/50">
                    {WEEKDAY_LABELS.map((label) => (
                      <span key={`${month.year}-${month.month}-${label}`} className="py-1">
                        {label}
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 grid gap-1">
                    {rows.map((row, rowIndex) => (
                      <div key={`${month.year}-${month.month}-row-${rowIndex}`} className="grid grid-cols-7 gap-1">
                        {row.map((cell, cellIndex) => {
                          if (!cell) {
                            return <span key={`${month.year}-${month.month}-empty-${rowIndex}-${cellIndex}`} className="h-9" />;
                          }
                          const selected =
                            cell.year === selectedParts.year &&
                            cell.month === selectedParts.month &&
                            cell.day === selectedParts.day;
                          const isToday =
                            cell.year === todayParts.year &&
                            cell.month === todayParts.month &&
                            cell.day === todayParts.day;
                          return (
                            <button
                              key={`${month.year}-${month.month}-${cell.day}`}
                              type="button"
                              onClick={() => {
                                onSelectDate(buildZonedDate(cell, timezone, 12, 0));
                                onOpenChange(false);
                              }}
                              className={cn(
                                "h-9 rounded-lg border text-sm transition",
                                selected
                                  ? "border-cyan-300/60 bg-cyan-300/20 text-white"
                                  : "border-transparent text-white/80 hover:border-white/25 hover:bg-white/10 hover:text-white",
                                isToday && !selected && "border-white/25",
                              )}
                            >
                              {cell.day}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
