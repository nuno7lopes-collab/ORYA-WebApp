"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  addDaysToLocalDate,
  addMonthsToLocalDate,
  compareLocalDate,
  formatLocalDateLabel,
  formatLocalDateLong,
  isValidLocalDate,
  startOfWeekLocalDate,
} from "@/lib/datetime/localInput";
import { useAdaptiveOverlayPosition } from "./useAdaptiveOverlayPosition";

export type OryaDayMeta = {
  available?: boolean;
  badge?: string;
};

type DisabledDates = Set<string> | ((day: string) => boolean);

type OryaDateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  disabledDates?: DisabledDates;
  dayMeta?: Record<string, OryaDayMeta>;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  label?: string;
  todayLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const WEEKDAY_LABELS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];

function getTodayLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthLabel(monthStart: string) {
  const [yearRaw, monthRaw] = monthStart.split("-");
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1, 1);
  return new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(date);
}

function monthStartFromDate(value: string) {
  const date = isValidLocalDate(value) ? value : getTodayLocalDate();
  return `${date.slice(0, 7)}-01`;
}

function buildMonthCells(monthStart: string) {
  const start = startOfWeekLocalDate(monthStart);
  const cells: Array<{ date: string; inMonth: boolean }> = [];
  const monthToken = monthStart.slice(0, 7);
  for (let row = 0; row < 6; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const index = row * 7 + col;
      const date = addDaysToLocalDate(start, index);
      cells.push({ date, inMonth: date.slice(0, 7) === monthToken });
    }
  }
  return cells;
}

function dateIsDisabled(day: string, props: { minDate?: string; maxDate?: string; disabledDates?: DisabledDates }) {
  if (!isValidLocalDate(day)) return true;
  if (props.minDate && isValidLocalDate(props.minDate) && compareLocalDate(day, props.minDate) < 0) return true;
  if (props.maxDate && isValidLocalDate(props.maxDate) && compareLocalDate(day, props.maxDate) > 0) return true;

  if (props.disabledDates instanceof Set) return props.disabledDates.has(day);
  if (typeof props.disabledDates === "function") return props.disabledDates(day);
  return false;
}

function isTypingTarget(target: EventTarget | null) {
  if (!target || !(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function OryaDateField({
  value,
  onChange,
  minDate,
  maxDate,
  disabledDates,
  dayMeta,
  placeholder = "Data",
  className,
  buttonClassName,
  disabled,
  label,
  todayLabel = "Hoje",
  open: controlledOpen,
  onOpenChange,
}: OryaDateFieldProps) {
  const dialogId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [monthStart, setMonthStart] = useState<string>(() => monthStartFromDate(value));
  const [activeDate, setActiveDate] = useState<string>(() => (isValidLocalDate(value) ? value : getTodayLocalDate()));

  const isControlled = typeof controlledOpen === "boolean";
  const open = isControlled ? (controlledOpen as boolean) : uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  };

  const today = useMemo(() => getTodayLocalDate(), []);
  const displayValue = isValidLocalDate(value) ? formatLocalDateLabel(value) : placeholder;
  const longValue = isValidLocalDate(value) ? formatLocalDateLong(value) : placeholder;

  const { style: overlayStyle } = useAdaptiveOverlayPosition({
    open: open && !isMobile,
    anchorRef: buttonRef,
    overlayRef,
    preferredWidth: 360,
    minWidth: 300,
    minHeight: 250,
    maxHeight: 520,
  });

  const cells = useMemo(() => buildMonthCells(monthStart), [monthStart]);
  const prevMonthStart = useMemo(() => addMonthsToLocalDate(monthStart, -1).slice(0, 7) + "-01", [monthStart]);
  const nextMonthStart = useMemo(() => addMonthsToLocalDate(monthStart, 1).slice(0, 7) + "-01", [monthStart]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const update = () => setIsMobile(window.matchMedia("(max-width: 767px)").matches);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [mounted]);

  useEffect(() => {
    if (!isValidLocalDate(value)) return;
    setMonthStart(monthStartFromDate(value));
    setActiveDate(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (overlayRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = `${dialogId}-day-${activeDate}`;
    const activeButton = document.getElementById(id) as HTMLButtonElement | null;
    activeButton?.focus();
  }, [activeDate, dialogId, monthStart, open]);

  const commitDay = (day: string) => {
    if (!isValidLocalDate(day)) return;
    if (dateIsDisabled(day, { minDate, maxDate, disabledDates })) return;
    onChange(day);
    setActiveDate(day);
    setMonthStart(monthStartFromDate(day));
    setOpen(false);
    buttonRef.current?.focus();
  };

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isTypingTarget(event.target)) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActiveDate((current) => addDaysToLocalDate(current, -1));
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActiveDate((current) => addDaysToLocalDate(current, 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveDate((current) => addDaysToLocalDate(current, -7));
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveDate((current) => addDaysToLocalDate(current, 7));
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveDate((current) => startOfWeekLocalDate(current));
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveDate((current) => addDaysToLocalDate(startOfWeekLocalDate(current), 6));
      return;
    }
    if (event.key === "PageUp") {
      event.preventDefault();
      setActiveDate((current) => addMonthsToLocalDate(current, -1));
      return;
    }
    if (event.key === "PageDown") {
      event.preventDefault();
      setActiveDate((current) => addMonthsToLocalDate(current, 1));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      commitDay(activeDate);
    }
  };

  useEffect(() => {
    if (!open) return;
    const monthToken = monthStart.slice(0, 7);
    if (!activeDate.startsWith(monthToken)) {
      setMonthStart(monthStartFromDate(activeDate));
    }
  }, [activeDate, monthStart, open]);

  const panel = (
    <div
      id={dialogId}
      ref={overlayRef}
      role="dialog"
      aria-label={label ?? "Selecionar data"}
      onKeyDown={handleDialogKeyDown}
      className={cn(
        "rounded-3xl border border-white/15 bg-[linear-gradient(165deg,rgba(5,12,33,0.96),rgba(6,10,20,0.98))] p-4",
        "shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
      )}
      style={isMobile ? undefined : overlayStyle ?? undefined}
    >
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/10 pb-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Data</p>
        <button
          type="button"
          onClick={() => commitDay(today)}
          className="rounded-full border border-cyan-300/45 bg-cyan-300/12 px-3 py-1 text-[11px] text-cyan-100 transition hover:border-cyan-300/70"
        >
          {todayLabel}
        </button>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMonthStart(prevMonthStart)}
          className="h-10 w-10 rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:border-white/35 hover:bg-white/10"
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <p className="text-3xl font-semibold capitalize text-white">{monthLabel(monthStart)}</p>
        <button
          type="button"
          onClick={() => setMonthStart(nextMonthStart)}
          className="h-10 w-10 rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:border-white/35 hover:bg-white/10"
          aria-label="Mês seguinte"
        >
          ›
        </button>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-[0.16em] text-white/45">
          {WEEKDAY_LABELS.map((weekday) => (
            <span key={`${dialogId}-weekday-${weekday}`} className="py-1">
              {weekday}
            </span>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            const selected = value === cell.date;
            const active = activeDate === cell.date;
            const isToday = today === cell.date;
            const disabledDay = dateIsDisabled(cell.date, { minDate, maxDate, disabledDates });
            const meta = dayMeta?.[cell.date];

            return (
              <button
                key={`${dialogId}-${cell.date}`}
                id={`${dialogId}-day-${cell.date}`}
                type="button"
                role="gridcell"
                tabIndex={active ? 0 : -1}
                aria-selected={selected}
                aria-current={isToday ? "date" : undefined}
                disabled={disabledDay}
                onFocus={() => setActiveDate(cell.date)}
                onMouseEnter={() => setActiveDate(cell.date)}
                onClick={() => commitDay(cell.date)}
                className={cn(
                  "relative h-11 rounded-2xl border text-sm transition",
                  selected
                    ? "border-cyan-300/75 bg-cyan-300 text-black shadow-[0_14px_34px_rgba(107,255,255,0.36)]"
                    : "border-transparent text-white/82 hover:border-white/20 hover:bg-white/10",
                  isToday && !selected && "border-white/25",
                  !cell.inMonth && !selected && "text-white/35",
                  disabledDay && "cursor-not-allowed border-transparent text-white/24 hover:bg-transparent",
                  active && !selected && "ring-1 ring-white/45",
                )}
              >
                <span>{cell.date.slice(-2).replace(/^0/, "")}</span>
                {meta?.available ? <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-cyan-200" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-[10px] text-white/50">Atalhos: setas, Home/End, PgUp/PgDn, Enter, Esc.</p>
      {isValidLocalDate(value) ? <p className="mt-1 text-[11px] text-white/70">{longValue}</p> : null}
    </div>
  );

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "inline-flex h-10 min-w-[132px] items-center justify-between gap-2 rounded-full border border-white/20",
          "bg-black/30 px-3 text-sm text-white/85 transition hover:border-white/35 hover:text-white",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50",
          disabled && "cursor-not-allowed opacity-60",
          open && "border-cyan-300/60 text-white",
          buttonClassName,
        )}
      >
        <span className="truncate">{displayValue}</span>
        <span className="text-[10px] text-white/55">▼</span>
      </button>

      {mounted && open
        ? createPortal(
            isMobile ? (
              <div className="fixed inset-0 z-[var(--z-modal)] bg-black/65 backdrop-blur-sm" onClick={() => setOpen(false)}>
                <div
                  className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#060a16] p-4"
                  onClick={(event) => event.stopPropagation()}
                >
                  {panel}
                </div>
              </div>
            ) : (
              <div className="fixed inset-0 z-[var(--z-popover)]" onClick={() => setOpen(false)}>
                <div onClick={(event) => event.stopPropagation()}>{panel}</div>
              </div>
            ),
            document.body,
          )
        : null}
    </div>
  );
}
