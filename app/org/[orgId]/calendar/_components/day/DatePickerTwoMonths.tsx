"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
type DateParts = { year: number; month: number; day: number };

function buildUtcDate(parts: DateParts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function datePartsFromUtc(date: Date): DateParts {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function addDaysToDateParts(parts: DateParts, amount: number): DateParts {
  const next = buildUtcDate(parts);
  next.setUTCDate(next.getUTCDate() + amount);
  return datePartsFromUtc(next);
}

function daysInMonth(parts: { year: number; month: number }) {
  return new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
}

function shiftDatePartsByMonths(parts: DateParts, amount: number): DateParts {
  const nextMonth = addMonthsToParts({ year: parts.year, month: parts.month }, amount);
  return {
    year: nextMonth.year,
    month: nextMonth.month,
    day: Math.min(parts.day, daysInMonth(nextMonth)),
  };
}

function mondayBasedWeekday(parts: DateParts) {
  return (buildUtcDate(parts).getUTCDay() + 6) % 7;
}

function partsEqual(left: DateParts, right: DateParts) {
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

export function DatePickerTwoMonths({
  selectedDate,
  timezone,
  open,
  onOpenChange,
  onSelectDate,
}: DatePickerTwoMonthsProps) {
  const dialogId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedParts = getDateParts(selectedDate, timezone);
  const [baseMonth, setBaseMonth] = useState({ year: selectedParts.year, month: selectedParts.month });
  const [activeParts, setActiveParts] = useState<DateParts>(selectedParts);

  useEffect(() => {
    if (!open) return;
    setBaseMonth({ year: selectedParts.year, month: selectedParts.month });
    setActiveParts(selectedParts);
  }, [open, selectedParts.day, selectedParts.month, selectedParts.year]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open) return;
    const monthOffset = (activeParts.year - baseMonth.year) * 12 + (activeParts.month - baseMonth.month);
    if (monthOffset < 0) {
      setBaseMonth({ year: activeParts.year, month: activeParts.month });
      return;
    }
    if (monthOffset > 1) {
      setBaseMonth(addMonthsToParts({ year: activeParts.year, month: activeParts.month }, -1));
    }
  }, [activeParts.month, activeParts.year, baseMonth.month, baseMonth.year, open]);

  useEffect(() => {
    if (!open) return;
    const activeButtonId = `${dialogId}-day-${activeParts.year}-${activeParts.month}-${activeParts.day}`;
    const activeButton = document.getElementById(activeButtonId) as HTMLButtonElement | null;
    activeButton?.focus();
  }, [activeParts.day, activeParts.month, activeParts.year, baseMonth.month, baseMonth.year, dialogId, open]);

  const nextMonth = useMemo(() => addMonthsToParts(baseMonth, 1), [baseMonth]);
  const todayParts = getDateParts(new Date(), timezone);
  const selectedMonthLabel = useMemo(() => formatMonthLabel(baseMonth), [baseMonth]);
  const commitDate = (parts: DateParts) => {
    onSelectDate(buildZonedDate(parts, timezone, 12, 0));
    onOpenChange(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
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
          id={dialogId}
          role="dialog"
          aria-label="Selecionar data"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onOpenChange(false);
              return;
            }
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setActiveParts((current) => addDaysToDateParts(current, -1));
              return;
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              setActiveParts((current) => addDaysToDateParts(current, 1));
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveParts((current) => addDaysToDateParts(current, -7));
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveParts((current) => addDaysToDateParts(current, 7));
              return;
            }
            if (event.key === "Home") {
              event.preventDefault();
              setActiveParts((current) => addDaysToDateParts(current, -mondayBasedWeekday(current)));
              return;
            }
            if (event.key === "End") {
              event.preventDefault();
              setActiveParts((current) => addDaysToDateParts(current, 6 - mondayBasedWeekday(current)));
              return;
            }
            if (event.key === "PageUp") {
              event.preventDefault();
              setActiveParts((current) => shiftDatePartsByMonths(current, -1));
              return;
            }
            if (event.key === "PageDown") {
              event.preventDefault();
              setActiveParts((current) => shiftDatePartsByMonths(current, 1));
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              commitDate(activeParts);
            }
          }}
          className={cn(
            "absolute left-0 top-[calc(100%+8px)] z-50 rounded-2xl border border-white/15 bg-[#111319]/95 p-4",
            "shadow-[0_36px_90px_rgba(0,0,0,0.7)] backdrop-blur-xl",
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Navegação</p>
              <p className="text-sm font-semibold capitalize text-white">{selectedMonthLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveParts((current) => shiftDatePartsByMonths(current, -1))}
              className="rounded-full border border-white/15 px-3 py-1 text-sm text-white/75 transition hover:border-white/35 hover:text-white"
              aria-label="Mês anterior"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => setActiveParts((current) => shiftDatePartsByMonths(current, 1))}
              className="rounded-full border border-white/15 px-3 py-1 text-sm text-white/75 transition hover:border-white/35 hover:text-white"
              aria-label="Mês seguinte"
            >
              →
            </button>
          </div>

          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setBaseMonth({ year: todayParts.year, month: todayParts.month });
                setActiveParts(todayParts);
                commitDate(todayParts);
              }}
              className="rounded-full border border-cyan-300/45 bg-cyan-300/12 px-3 py-1 text-[11px] text-cyan-100 transition hover:border-cyan-300/75"
            >
              Hoje
            </button>
            <span className="text-[10px] uppercase tracking-[0.16em] text-white/45">{timezone}</span>
          </div>
          <p className="mb-3 text-[10px] text-white/55">Atalhos: setas, Home/End, PgUp/PgDn, Enter.</p>

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
                          const isActive = partsEqual(cell, activeParts);
                          const isToday =
                            cell.year === todayParts.year &&
                            cell.month === todayParts.month &&
                            cell.day === todayParts.day;
                          return (
                            <button
                              key={`${month.year}-${month.month}-${cell.day}`}
                              id={`${dialogId}-day-${cell.year}-${cell.month}-${cell.day}`}
                              type="button"
                              role="gridcell"
                              tabIndex={isActive ? 0 : -1}
                              aria-selected={selected}
                              aria-current={isToday ? "date" : undefined}
                              onFocus={() => setActiveParts(cell)}
                              onMouseEnter={() => setActiveParts(cell)}
                              onClick={() => {
                                setActiveParts(cell);
                                commitDate(cell);
                              }}
                              className={cn(
                                "h-9 rounded-lg border text-sm transition",
                                selected
                                  ? "border-cyan-300/60 bg-cyan-300/20 text-white"
                                  : "border-transparent text-white/80 hover:border-white/25 hover:bg-white/10 hover:text-white",
                                isToday && !selected && "border-white/25",
                                isActive && "ring-1 ring-white/45",
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
