"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CTA_PRIMARY } from "@/app/org/_shared/dashboardUi";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minDateTime?: Date;
  required?: boolean;
};

function formatToLocalInput(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function roundUpToQuarter(date: Date) {
  const d = new Date(date);
  const minutes = d.getMinutes();
  const rounded = Math.ceil(minutes / 15) * 15;
  d.setMinutes(rounded, 0, 0);
  return d;
}

export function InlineDateTimePicker({
  label,
  value,
  onChange,
  minDateTime,
  required,
}: Props) {
  const parsedValue = useMemo(() => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [value]);

  const minDate = useMemo(() => startOfDay(minDateTime ?? new Date()), [minDateTime]);
  const minDateTimeRounded = useMemo(
    () => (minDateTime ? roundUpToQuarter(minDateTime) : roundUpToQuarter(new Date())),
    [minDateTime],
  );

  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(parsedValue ?? new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(parsedValue ?? null);
  const [selectedTime, setSelectedTime] = useState<string>(() => {
    if (!parsedValue) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(parsedValue.getHours())}:${pad(parsedValue.getMinutes())}`;
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (parsedValue) {
      setSelectedDate(parsedValue);
      const pad = (n: number) => n.toString().padStart(2, "0");
      setSelectedTime(`${pad(parsedValue.getHours())}:${pad(parsedValue.getMinutes())}`);
      setViewMonth(parsedValue);
    }
  }, [parsedValue]);
  const days = useMemo(() => {
    const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startWeekday = firstOfMonth.getDay(); // 0-6
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const list: { date: Date; disabled: boolean }[] = [];
    for (let i = 0; i < startWeekday; i++) {
      list.push({ date: new Date(NaN), disabled: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
      const disabled = dayDate < minDate;
      list.push({ date: dayDate, disabled });
    }
    return list;
  }, [viewMonth, minDate]);

  const timeOptions = useMemo(() => {
    const options: { label: string; value: string; disabled: boolean }[] = [];
    const baseDate = selectedDate ?? minDate;
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const label = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
        const optionDate = new Date(baseDate);
        optionDate.setHours(h, m, 0, 0);
        let disabled = false;
        if (minDateTimeRounded && selectedDate && isSameDay(selectedDate, minDateTimeRounded)) {
          disabled = optionDate < minDateTimeRounded;
        } else if (!selectedDate && minDateTimeRounded) {
          disabled = optionDate < minDateTimeRounded;
        }
        options.push({ label, value: label, disabled });
      }
    }
    return options;
  }, [selectedDate, minDateTimeRounded, minDate]);

  useEffect(() => {
    if (!selectedDate || !selectedTime) return;
    const [h, m] = selectedTime.split(":").map((v) => Number(v));
    const next = new Date(selectedDate);
    next.setHours(h || 0, m || 0, 0, 0);
    if (minDateTimeRounded && next < minDateTimeRounded && isSameDay(next, minDateTimeRounded)) {
      return;
    }
    const nextValue = formatToLocalInput(next);
    if (nextValue === value) return;
    onChange(nextValue);
  }, [selectedDate, selectedTime, minDateTimeRounded, onChange, value]);

  const monthLabel = viewMonth.toLocaleString("pt-PT", { month: "long", year: "numeric" });

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/60"
      >
        <span>{parsedValue ? parsedValue.toLocaleString("pt-PT") : "Escolher data/hora"}</span>
        <span className="text-[11px] text-white/60">📅</span>
      </button>
      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/70 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-white/15 bg-[#040712]/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.7)] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-sm text-white/80">
              <button
                type="button"
                onClick={() => {
                  const prev = new Date(viewMonth);
                  prev.setMonth(prev.getMonth() - 1);
                  if (startOfDay(prev) < minDate) return;
                  setViewMonth(prev);
                }}
                className="rounded-full px-2 py-1 text-xs hover:bg-white/10 disabled:opacity-40"
              >
                ←
              </button>
              <span className="font-semibold capitalize">{monthLabel}</span>
              <button
                type="button"
                onClick={() => {
                  const next = new Date(viewMonth);
                  next.setMonth(next.getMonth() + 1);
                  setViewMonth(next);
                }}
                className="rounded-full px-2 py-1 text-xs hover:bg-white/10"
              >
                →
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-[11px] text-white/60">
              {["D", "S", "T", "Q", "Q", "S", "S"].map((d, idx) => (
                <span key={`${d}-${idx}`} className="text-center py-1">
                  {d}
                </span>
              ))}
              {days.map((d, idx) => {
                if (Number.isNaN(d.date.getTime())) {
                  return <span key={`blank-${idx}`} />;
                }
                const isSelected = selectedDate ? isSameDay(selectedDate, d.date) : false;
                return (
                  <button
                    key={d.date.toISOString()}
                    type="button"
                    disabled={d.disabled}
                    onClick={() => {
                      setSelectedDate(d.date);
                    }}
                    className={`h-9 w-9 rounded-full text-[12px] ${
                      d.disabled
                        ? "text-white/25 cursor-not-allowed"
                        : isSelected
                          ? `${CTA_PRIMARY} justify-center p-0 text-[12px]`
                          : "text-white/80 hover:bg-white/10"
                    }`}
                  >
                    {d.date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] text-white/60">Hora (15 em 15 min)</p>
              <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1">
                {timeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => setSelectedTime(opt.value)}
                    className={`rounded-lg px-2 py-1 text-xs ${
                      opt.disabled
                        ? "text-white/30 cursor-not-allowed"
                        : selectedTime === opt.value
                          ? `${CTA_PRIMARY} px-2 py-1 text-xs`
                          : "bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/20 px-4 py-2 text-[12px] text-white hover:bg-white/10"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {required && !value && <p className="text-xs text-red-400">Obrigatório</p>}
    </div>
  );
}
