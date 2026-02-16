"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SearchableEntityOption = {
  id: string;
  label: string;
  subtitle?: string | null;
  avatarUrl?: string | null;
};

type SearchableEntitySelectProps = {
  label: string;
  placeholder: string;
  options: SearchableEntityOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  className?: string;
};

export function SearchableEntitySelect({
  label,
  placeholder,
  options,
  selectedIds,
  onChange,
  className,
}: SearchableEntitySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedPrimary = selectedIds.length > 0 ? options.find((option) => option.id === selectedIds[0]) ?? null : null;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => {
      const labelValue = option.label.toLowerCase();
      const subtitleValue = option.subtitle?.toLowerCase() ?? "";
      return labelValue.includes(normalizedQuery) || subtitleValue.includes(normalizedQuery);
    });
  }, [options, query]);

  const triggerLabel = selectedPrimary
    ? selectedIds.length > 1
      ? `${selectedPrimary.label} +${selectedIds.length - 1}`
      : selectedPrimary.label
    : placeholder;

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleOption = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "inline-flex h-10 min-w-[170px] items-center justify-between gap-2 rounded-full border border-white/15",
          "bg-black/30 px-3 text-sm text-white/80 transition hover:border-white/35 hover:text-white",
          open && "border-cyan-300/60 text-white",
        )}
      >
        <span className="truncate">{triggerLabel}</span>
        <span className="text-[10px] text-white/55">▼</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute left-0 top-[calc(100%+8px)] z-40 w-[280px] rounded-2xl border border-white/15 bg-[#050912]/95 p-3",
            "shadow-[0_30px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl",
          )}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar..."
            className="mb-3 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/60"
            autoFocus
          />

          <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => {
                onChange([]);
              }}
              className={cn(
                "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                selectedIds.length === 0
                  ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100"
                  : "border-white/10 text-white/75 hover:border-white/25 hover:text-white",
              )}
            >
              Todos
            </button>

            {filteredOptions.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/55">
                Sem resultados.
              </div>
            )}

            <div role="listbox" aria-label={label} aria-multiselectable="true" className="space-y-1">
              {filteredOptions.map((option) => {
                const selected = selectedSet.has(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => toggleOption(option.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
                      selected
                        ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100"
                        : "border-white/10 text-white/75 hover:border-white/25 hover:text-white",
                    )}
                  >
                    {option.avatarUrl ? (
                      <img
                        src={option.avatarUrl}
                        alt=""
                        className="h-7 w-7 rounded-full border border-white/20 object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[10px] uppercase text-white/70">
                        {option.label.slice(0, 2)}
                      </div>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{option.label}</span>
                      {option.subtitle ? <span className="block truncate text-xs text-white/50">{option.subtitle}</span> : null}
                    </span>
                    <span
                      className={cn(
                        "inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px]",
                        selected ? "border-cyan-200/70 bg-cyan-200/30 text-cyan-50" : "border-white/30 text-transparent",
                      )}
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
