"use client";

import { useMemo } from "react";
import { OryaDateTimeField } from "@/components/ui/datetime";
import { isValidLocalDateTime, isoToLocalInput } from "@/lib/datetime/localInput";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minDateTime?: Date;
  required?: boolean;
};

export function InlineDateTimePicker({ label, value, onChange, minDateTime, required }: Props) {
  const localValue = useMemo(() => {
    if (isValidLocalDateTime(value)) return value;
    return isoToLocalInput(value);
  }, [value]);

  const minLocal = useMemo(() => {
    if (!minDateTime) return undefined;
    return isoToLocalInput(minDateTime);
  }, [minDateTime]);

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium mb-1">{label}</label>
      <OryaDateTimeField
        value={localValue}
        onChange={onChange}
        minDateTime={minLocal}
        className="w-full"
        dateButtonClassName="h-10 flex-1 rounded-md"
        timeButtonClassName="h-10 rounded-md"
      />
      {required && !localValue ? <p className="text-xs text-red-400">Obrigatório</p> : null}
    </div>
  );
}
