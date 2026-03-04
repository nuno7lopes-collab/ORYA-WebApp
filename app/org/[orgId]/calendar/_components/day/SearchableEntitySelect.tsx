"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/avatar";
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

type PanelPosition = {
  top: number;
  left: number;
  width: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

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
  const [panelPosition, setPanelPosition] = useState<PanelPosition>({ top: 0, left: 0, width: 320 });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();

  const selectedOptions = useMemo(
    () => selectedIds.map((id) => options.find((option) => option.id === id)).filter(Boolean) as SearchableEntityOption[],
    [options, selectedIds],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => {
      const labelValue = option.label.toLowerCase();
      const subtitleValue = option.subtitle?.toLowerCase() ?? "";
      return labelValue.includes(normalizedQuery) || subtitleValue.includes(normalizedQuery);
    });
  }, [options, query]);

  const orderedOptions = useMemo(() => {
    return [...filteredOptions].sort((left, right) => {
      const leftSelected = selectedSet.has(left.id) ? 1 : 0;
      const rightSelected = selectedSet.has(right.id) ? 1 : 0;
      if (leftSelected !== rightSelected) return rightSelected - leftSelected;
      return left.label.localeCompare(right.label, "pt-PT");
    });
  }, [filteredOptions, selectedSet]);

  const updatePanelPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;
    const rect = trigger.getBoundingClientRect();
    const width = clamp(rect.width, 260, 360);
    const margin = 8;
    const left = clamp(rect.left, margin, Math.max(margin, window.innerWidth - width - margin));
    const top = Math.min(window.innerHeight - 16, rect.bottom + 8);
    setPanelPosition({ top, left, width });
  };

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    const handleResize = () => updatePanelPosition();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
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
    if (activeElement && panelRef.current?.contains(activeElement)) {
      activeElement.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, listboxId, open]);

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

  const triggerText =
    selectedOptions.length === 0
      ? placeholder
      : selectedOptions.length === 1
        ? selectedOptions[0].label
        : `${selectedOptions.length} selecionados`;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
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
          "inline-flex h-8 min-w-[156px] max-w-[280px] items-center gap-2 rounded-full border border-white/24 bg-white/[0.04] px-3 text-xs",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:border-cyan-300/60",
          "text-white/90 transition hover:border-white/38 hover:bg-white/[0.08] hover:text-white",
          open && "border-cyan-300/60 text-white",
        )}
      >
        <span className="truncate">{triggerText}</span>
        <span className="ml-auto rounded-full border border-white/20 bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-white/78">
          {selectedOptions.length}
        </span>
        <span className="text-[11px] text-white/70">▼</span>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={label}
              className="z-[110] rounded-2xl border border-white/16 bg-[#10161d]/98 p-3"
              style={{
                position: "fixed",
                top: panelPosition.top,
                left: panelPosition.left,
                width: panelPosition.width,
                maxWidth: "calc(100vw - 16px)",
                maxHeight: "calc(100vh - 24px)",
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[12px] uppercase tracking-[0.14em] text-white/74">{label}</p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={clearVisible}
                    disabled={orderedOptions.length === 0}
                    className="rounded-full border border-white/24 px-2 py-1 text-[11px] text-white/82 transition hover:border-white/40 hover:text-white disabled:opacity-40"
                  >
                    Limpar visíveis
                  </button>
                  <button
                    type="button"
                    onClick={selectVisible}
                    disabled={orderedOptions.length === 0}
                    className="rounded-full border border-cyan-300/42 bg-cyan-300/12 px-2 py-1 text-[11px] text-cyan-100 transition hover:border-cyan-300/65 disabled:opacity-40"
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
                className="org-clean-input mb-3 w-full px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:border-cyan-300/60"
                autoFocus
              />

              <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                {orderedOptions.length === 0 && (
                  <div className="rounded-xl border border-white/14 bg-white/[0.03] px-3 py-2 text-xs text-white/74">
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
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:border-cyan-300/60",
                          selected
                            ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-100"
                            : "border-white/14 text-white/84 hover:border-white/28 hover:text-white",
                          isActive && "ring-1 ring-white/35",
                        )}
                      >
                        <Avatar
                          src={option.avatarUrl}
                          name={option.label}
                          className="h-7 w-7"
                          fallbackText={option.label.slice(0, 2)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{option.label}</span>
                          {option.subtitle ? (
                            <span className="block truncate text-xs text-white/50">{option.subtitle}</span>
                          ) : null}
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
                  <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">↑ ↓ Enter</span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/75 transition hover:border-white/30 hover:text-white"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
