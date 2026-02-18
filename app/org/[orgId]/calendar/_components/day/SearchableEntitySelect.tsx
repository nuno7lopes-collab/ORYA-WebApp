"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const selectedOptions = useMemo(
    () => selectedIds.map((id) => options.find((option) => option.id === id)).filter(Boolean) as SearchableEntityOption[],
    [options, selectedIds],
  );

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
      setActiveIndex(-1);
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

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const orderedOptions = useMemo(() => {
    return [...filteredOptions].sort((left, right) => {
      const leftSelected = selectedSet.has(left.id) ? 1 : 0;
      const rightSelected = selectedSet.has(right.id) ? 1 : 0;
      if (leftSelected !== rightSelected) return rightSelected - leftSelected;
      return left.label.localeCompare(right.label, "pt-PT");
    });
  }, [filteredOptions, selectedSet]);

  const toggleOption = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };
  const selectVisible = () => {
    if (orderedOptions.length === 0) return;
    const next = new Set(selectedSet);
    orderedOptions.forEach((option) => next.add(option.id));
    onChange([...next]);
  };
  const clearVisible = () => {
    if (orderedOptions.length === 0) return;
    const visible = new Set(orderedOptions.map((option) => option.id));
    onChange(selectedIds.filter((id) => !visible.has(id)));
  };

  useEffect(() => {
    if (!open) return;
    if (orderedOptions.length === 0) {
      setActiveIndex(-1);
      return;
    }
    const selectedIndex = orderedOptions.findIndex((option) => selectedSet.has(option.id));
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, orderedOptions, selectedSet]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const activeId = `${listboxId}-opt-${activeIndex}`;
    const activeElement = document.getElementById(activeId);
    if (activeElement && rootRef.current?.contains(activeElement)) {
      activeElement.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, listboxId, open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "inline-flex h-10 min-w-[170px] max-w-[280px] items-center justify-between gap-2 rounded-full border border-white/15",
          "bg-black/30 px-3 text-sm text-white/80 transition hover:border-white/35 hover:text-white",
          open && "border-cyan-300/60 text-white",
        )}
      >
        <span className="min-w-0 flex-1">
          {selectedOptions.length > 0 ? (
            <span className="flex items-center gap-1 overflow-hidden">
              {selectedOptions.slice(0, 2).map((option) => (
                <span
                  key={`trigger-${option.id}`}
                  className="max-w-[108px] truncate rounded-full border border-cyan-200/45 bg-cyan-300/16 px-2 py-0.5 text-[10px] text-cyan-100"
                >
                  {option.label}
                </span>
              ))}
              {selectedOptions.length > 2 ? (
                <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] text-white/85">
                  +{selectedOptions.length - 2}
                </span>
              ) : null}
            </span>
          ) : (
            <span className="truncate">{placeholder}</span>
          )}
        </span>
        {selectedOptions.length > 0 ? (
          <span className="rounded-full border border-cyan-200/45 bg-cyan-300/16 px-2 py-0.5 text-[10px] text-cyan-100">
            {selectedOptions.length}
          </span>
        ) : null}
        <span className="text-[10px] text-white/55">▼</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute left-0 top-[calc(100%+8px)] z-40 w-[min(92vw,320px)] rounded-2xl border border-white/15 bg-[#050912]/95 p-3",
            "shadow-[0_30px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl",
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">{label}</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearVisible}
                disabled={orderedOptions.length === 0}
                className="rounded-full border border-white/15 px-2 py-1 text-[10px] text-white/75 transition hover:border-white/30 hover:text-white disabled:opacity-40"
              >
                Limpar visíveis
              </button>
              <button
                type="button"
                onClick={selectVisible}
                disabled={orderedOptions.length === 0}
                className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-[10px] text-cyan-100 transition hover:border-cyan-300/60 disabled:opacity-40"
              >
                Selecionar visíveis
              </button>
            </div>
          </div>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) => {
                  const max = orderedOptions.length - 1;
                  if (max < 0) return -1;
                  return Math.min(max, current < 0 ? 0 : current + 1);
                });
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) => {
                  const max = orderedOptions.length - 1;
                  if (max < 0) return -1;
                  if (current < 0) return max;
                  return Math.max(0, current - 1);
                });
                return;
              }
              if (event.key === "Home") {
                event.preventDefault();
                setActiveIndex(orderedOptions.length > 0 ? 0 : -1);
                return;
              }
              if (event.key === "End") {
                event.preventDefault();
                setActiveIndex(orderedOptions.length > 0 ? orderedOptions.length - 1 : -1);
                return;
              }
              if (event.key === "Enter") {
                if (activeIndex >= 0 && orderedOptions[activeIndex]) {
                  event.preventDefault();
                  toggleOption(orderedOptions[activeIndex].id);
                }
                return;
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
              }
            }}
            placeholder={`Pesquisar ${placeholder.toLowerCase()}...`}
            aria-label={`Pesquisar ${label}`}
            aria-controls={listboxId}
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
            className="mb-3 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300/60"
            autoFocus
          />

          <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {orderedOptions.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/55">
                Sem resultados.
              </div>
            )}

            <div id={listboxId} role="listbox" aria-label={label} aria-multiselectable="true" className="space-y-1">
              {orderedOptions.map((option, index) => {
                const selected = selectedSet.has(option.id);
                const isActive = index === activeIndex;
                return (
                  <button
                    key={option.id}
                    id={`${listboxId}-opt-${index}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => toggleOption(option.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
                      selected
                        ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100"
                        : "border-white/10 text-white/75 hover:border-white/25 hover:text-white",
                      isActive && "ring-1 ring-white/35",
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

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-[11px] text-white/55">
              {selectedIds.length === 0
                ? "Sem seleção ativa."
                : `${selectedIds.length} selecionado${selectedIds.length > 1 ? "s" : ""}.`}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">Atalhos: ↑ ↓ Enter</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/75 transition hover:border-white/30 hover:text-white"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
