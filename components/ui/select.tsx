import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
};

/**
 * Minimal Select para temas escuros.
 * (Nota: não é o Radix original do shadcn, mas cobre o mesmo uso rápido.)
 */
export function Select({ value, onValueChange, options, placeholder, className }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={cn(
        "rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white shadow-sm outline-none transition",
        "focus:border-[rgba(107,255,255,0.5)] focus:ring-2 focus:ring-[rgba(107,255,255,0.25)]",
        className,
      )}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
          {opt.label}
        </option>
      ))}
    </select>
  );
}
