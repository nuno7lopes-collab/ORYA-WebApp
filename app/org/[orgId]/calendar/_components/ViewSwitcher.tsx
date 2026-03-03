"use client";

import { cn } from "@/lib/utils";

export type CalendarView = "day" | "week" | "month";

type ViewSwitcherProps = {
  value: CalendarView;
  onChange: (view: CalendarView) => void;
  className?: string;
};

const OPTIONS: Array<{ value: CalendarView; label: string }> = [
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
];

export function ViewSwitcher({ value, onChange, className }: ViewSwitcherProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-white/10 bg-[rgba(10,14,26,0.92)] p-3 shadow-[0_18px_44px_rgba(0,0,0,0.42)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">Vista</p>
        <div className="hidden sm:inline-flex items-center rounded-full border border-white/15 bg-black/30 p-1">
          {OPTIONS.map((option) => (
            <button
              key={`calendar-view-${option.value}`}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs transition",
                value === option.value
                  ? "border border-cyan-300/45 bg-cyan-400/12 text-cyan-100"
                  : "border border-transparent text-white/70 hover:border-white/20 hover:text-white",
              )}
              aria-pressed={value === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="sm:hidden inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-3 py-1.5 text-xs text-white/85">
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/55">Vista</span>
          <select
            value={value}
            onChange={(event) => onChange(event.target.value as CalendarView)}
            className="bg-transparent text-xs text-white/90 outline-none"
            aria-label="Selecionar vista do calendário"
          >
            {OPTIONS.map((option) => (
              <option key={`calendar-view-mobile-${option.value}`} value={option.value} className="bg-slate-900 text-white">
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
