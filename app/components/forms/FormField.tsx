"use client";

import { useMemo, type Ref } from "react";

type FormFieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  inputClassName?: string;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
};

export default function FormField({
  id,
  label,
  hint,
  error,
  required,
  inputRef,
  inputClassName,
  inputProps,
}: FormFieldProps) {
  const describedBy = useMemo(() => {
    const ids: string[] = [];
    if (hint) ids.push(`${id}-hint`);
    if (error) ids.push(`${id}-error`);
    return ids.length ? ids.join(" ") : undefined;
  }, [error, hint, id]);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-white/70 text-[12px]">
        {label}
        {required ? <span className="ml-1 text-red-300">*</span> : null}
      </label>
      <input
        id={id}
        ref={inputRef}
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        className={`w-full rounded-xl bg-white/[0.05] border px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF] ${
          error ? "border-red-400/70" : "border-white/15"
        } ${inputClassName ?? ""}`}
        {...inputProps}
      />
      {hint ? (
        <span id={`${id}-hint`} className="text-[11px] text-white/50">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} role="alert" className="text-[11px] text-red-300">
          {error}
        </span>
      ) : null}
    </div>
  );
}
