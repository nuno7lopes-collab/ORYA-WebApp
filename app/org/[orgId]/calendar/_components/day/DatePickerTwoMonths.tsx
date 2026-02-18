"use client";

import { OryaDateField } from "@/components/ui/datetime";
import { getDateParts } from "@/lib/reservas/availability";
import { buildZonedDate } from "./helpers";

type DatePickerTwoMonthsProps = {
  selectedDate: Date;
  timezone: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectDate: (date: Date) => void;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toLocalDate(value: Date, timezone: string) {
  const parts = getDateParts(value, timezone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function toDate(localDate: string, timezone: string) {
  const [yearRaw, monthRaw, dayRaw] = localDate.split("-");
  return buildZonedDate(
    {
      year: Number(yearRaw),
      month: Number(monthRaw),
      day: Number(dayRaw),
    },
    timezone,
    12,
    0,
  );
}

export function DatePickerTwoMonths({ selectedDate, timezone, open, onOpenChange, onSelectDate }: DatePickerTwoMonthsProps) {
  const localValue = toLocalDate(selectedDate, timezone);

  return (
    <OryaDateField
      value={localValue}
      open={open}
      onOpenChange={onOpenChange}
      onChange={(next) => {
        if (!next) return;
        onSelectDate(toDate(next, timezone));
      }}
      placeholder="Data"
      buttonClassName="inline-flex h-9 min-w-[140px] rounded-full"
    />
  );
}
