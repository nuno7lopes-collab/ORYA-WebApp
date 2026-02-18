"use client";

import { cn } from "@/lib/utils";
import { OryaDateField } from "./OryaDateField";

type OryaDateRangeFieldProps = {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  className?: string;
  fromPlaceholder?: string;
  toPlaceholder?: string;
  disabled?: boolean;
};

export function OryaDateRangeField({
  from,
  to,
  onFromChange,
  onToChange,
  minDate,
  maxDate,
  className,
  fromPlaceholder = "De",
  toPlaceholder = "Até",
  disabled,
}: OryaDateRangeFieldProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <OryaDateField
        value={from}
        onChange={onFromChange}
        minDate={minDate}
        maxDate={to || maxDate}
        placeholder={fromPlaceholder}
        disabled={disabled}
      />
      <OryaDateField
        value={to}
        onChange={onToChange}
        minDate={from || minDate}
        maxDate={maxDate}
        placeholder={toPlaceholder}
        disabled={disabled}
      />
    </div>
  );
}
