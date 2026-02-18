"use client";

import { cn } from "@/lib/utils";
import {
  compareLocalDate,
  compareLocalTime,
  isValidLocalDate,
  isValidLocalDateTime,
  isValidLocalTime,
  joinLocalDateTime,
  splitLocalDateTime,
} from "@/lib/datetime/localInput";
import { OryaDateField } from "./OryaDateField";
import { OryaTimeField } from "./OryaTimeField";

type OryaDateTimeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  minDateTime?: string;
  maxDateTime?: string;
  stepMinutes?: 5 | 10 | 15 | 30;
  className?: string;
  dateButtonClassName?: string;
  timeButtonClassName?: string;
  disabled?: boolean;
  datePlaceholder?: string;
  timePlaceholder?: string;
  onOpenChange?: (open: boolean) => void;
};

function todayLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function OryaDateTimeField({
  value,
  onChange,
  minDateTime,
  maxDateTime,
  stepMinutes = 15,
  className,
  dateButtonClassName,
  timeButtonClassName,
  disabled,
  datePlaceholder = "Data",
  timePlaceholder = "Hora",
  onOpenChange,
}: OryaDateTimeFieldProps) {
  const current = splitLocalDateTime(value);
  const minParts = splitLocalDateTime(minDateTime);
  const maxParts = splitLocalDateTime(maxDateTime);

  const minDate = isValidLocalDate(minParts.date) ? minParts.date : undefined;
  const maxDate = isValidLocalDate(maxParts.date) ? maxParts.date : undefined;

  const resolvedDate = isValidLocalDate(current.date) ? current.date : "";
  const resolvedTime = isValidLocalTime(current.time) ? current.time : "";

  const minTimeForDate =
    resolvedDate && minDate && resolvedDate === minDate && isValidLocalTime(minParts.time) ? minParts.time : undefined;
  const maxTimeForDate =
    resolvedDate && maxDate && resolvedDate === maxDate && isValidLocalTime(maxParts.time) ? maxParts.time : undefined;

  const coerceInsideDateTimeBounds = (nextDate: string, nextTime: string) => {
    if (!isValidLocalDate(nextDate) || !isValidLocalTime(nextTime)) return "";
    const next = `${nextDate}T${nextTime}`;

    if (isValidLocalDateTime(minDateTime) && next < (minDateTime as string)) return minDateTime as string;
    if (isValidLocalDateTime(maxDateTime) && next > (maxDateTime as string)) return maxDateTime as string;
    return next;
  };

  const handleDateChange = (nextDate: string) => {
    if (!isValidLocalDate(nextDate)) {
      onChange("");
      return;
    }

    let nextTime = resolvedTime || "00:00";

    if (minDate && nextDate === minDate && isValidLocalTime(minParts.time) && compareLocalTime(nextTime, minParts.time) < 0) {
      nextTime = minParts.time;
    }

    if (maxDate && nextDate === maxDate && isValidLocalTime(maxParts.time) && compareLocalTime(nextTime, maxParts.time) > 0) {
      nextTime = maxParts.time;
    }

    const joined = joinLocalDateTime(nextDate, nextTime);
    if (!joined) {
      onChange("");
      return;
    }

    onChange(coerceInsideDateTimeBounds(nextDate, nextTime));
  };

  const handleTimeChange = (nextTime: string) => {
    if (!isValidLocalTime(nextTime)) {
      onChange("");
      return;
    }

    const dateToUse = resolvedDate || minDate || todayLocalDate();
    const joined = joinLocalDateTime(dateToUse, nextTime);
    if (!joined) {
      onChange("");
      return;
    }

    onChange(coerceInsideDateTimeBounds(dateToUse, nextTime));
  };

  const disabledTime =
    !!maxDate && !!minDate && compareLocalDate(maxDate, minDate) === 0 && !!minTimeForDate && !!maxTimeForDate && minTimeForDate === maxTimeForDate;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <OryaDateField
        value={resolvedDate}
        onChange={handleDateChange}
        minDate={minDate}
        maxDate={maxDate}
        placeholder={datePlaceholder}
        buttonClassName={dateButtonClassName}
        disabled={disabled}
        onOpenChange={onOpenChange}
      />
      <OryaTimeField
        value={resolvedTime}
        onChange={handleTimeChange}
        stepMinutes={stepMinutes}
        minTime={minTimeForDate}
        maxTime={maxTimeForDate}
        placeholder={timePlaceholder}
        buttonClassName={timeButtonClassName}
        disabled={disabled || disabledTime}
        onOpenChange={onOpenChange}
      />
    </div>
  );
}
