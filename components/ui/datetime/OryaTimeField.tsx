"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  buildTimeOptions,
  clampLocalTime,
  compareLocalTime,
  isValidLocalTime,
  normalizeStepMinutes,
} from "@/lib/datetime/localInput";
import { ORYA_TIME_OPTION_SSOT_CLASS, ORYA_TIME_TRIGGER_SSOT_CLASS } from "./ssot";
import { useAdaptiveOverlayPosition } from "./useAdaptiveOverlayPosition";

type OryaTimeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  stepMinutes?: 5 | 10 | 15 | 30;
  minTime?: string;
  maxTime?: string;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  label?: string;
  onOpenChange?: (open: boolean) => void;
};

function isTypingTarget(target: EventTarget | null) {
  if (!target || !(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function OryaTimeField({
  value,
  onChange,
  stepMinutes = 15,
  minTime,
  maxTime,
  placeholder = "Hora",
  className,
  buttonClassName,
  disabled,
  label,
  onOpenChange,
}: OryaTimeFieldProps) {
  const dialogId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const normalizedStep = normalizeStepMinutes(stepMinutes);
  const options = useMemo(() => buildTimeOptions(normalizedStep), [normalizedStep]);

  const validOptions = useMemo(
    () =>
      options.filter((option) => {
        if (minTime && isValidLocalTime(minTime) && compareLocalTime(option, minTime) < 0) return false;
        if (maxTime && isValidLocalTime(maxTime) && compareLocalTime(option, maxTime) > 0) return false;
        return true;
      }),
    [maxTime, minTime, options],
  );

  const [active, setActive] = useState<string>(() => {
    if (isValidLocalTime(value) && validOptions.includes(value)) return value;
    return validOptions[0] ?? "";
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const update = () => setIsMobile(window.matchMedia("(max-width: 767px)").matches);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [mounted]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!isValidLocalTime(value)) return;
    const clamped = clampLocalTime(value, minTime, maxTime);
    if (clamped) setActive(clamped);
  }, [maxTime, minTime, value]);

  const { style: overlayStyle } = useAdaptiveOverlayPosition({
    open: open && !isMobile,
    anchorRef: buttonRef,
    overlayRef,
    preferredWidth: 240,
    minWidth: 210,
    maxWidth: 320,
    minHeight: 190,
    maxHeight: 420,
  });

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (overlayRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !active) return;
    const id = `${dialogId}-time-${active.replace(":", "-")}`;
    const activeButton = document.getElementById(id) as HTMLButtonElement | null;
    activeButton?.focus();
    activeButton?.scrollIntoView({ block: "nearest" });
  }, [active, dialogId, open]);

  const commit = (next: string) => {
    const clamped = clampLocalTime(next, minTime, maxTime);
    if (!clamped) return;
    onChange(clamped);
    setActive(clamped);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isTypingTarget(event.target)) return;
    if (validOptions.length === 0) return;

    const currentIndex = Math.max(0, validOptions.findIndex((option) => option === active));

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = validOptions[Math.min(validOptions.length - 1, currentIndex + 1)] ?? active;
      setActive(next);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = validOptions[Math.max(0, currentIndex - 1)] ?? active;
      setActive(next);
      return;
    }
    if (event.key === "PageDown") {
      event.preventDefault();
      const next = validOptions[Math.min(validOptions.length - 1, currentIndex + 8)] ?? active;
      setActive(next);
      return;
    }
    if (event.key === "PageUp") {
      event.preventDefault();
      const next = validOptions[Math.max(0, currentIndex - 8)] ?? active;
      setActive(next);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActive(validOptions[0] ?? active);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActive(validOptions[validOptions.length - 1] ?? active);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      commit(active);
    }
  };

  const panel = (
    <div
      id={dialogId}
      ref={overlayRef}
      role="dialog"
      aria-label={label ?? "Selecionar hora"}
      onKeyDown={handleKeyDown}
      className={cn(
        "max-h-[inherit] overflow-hidden rounded-3xl border border-white/15 bg-[linear-gradient(165deg,rgba(5,12,33,0.96),rgba(6,10,20,0.98))] p-4",
        "shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl",
      )}
      style={isMobile ? undefined : overlayStyle ?? undefined}
    >
      <div className="mb-3 border-b border-white/10 pb-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Hora</p>
        <p className="mt-1 text-[11px] text-white/60">
          {validOptions[0] ?? "--:--"} → {validOptions[validOptions.length - 1] ?? "--:--"}
        </p>
      </div>

      <div
        ref={listRef}
        role="listbox"
        className="max-h-[280px] space-y-1 overflow-y-auto overscroll-contain rounded-2xl border border-white/12 bg-white/[0.03] p-2"
      >
        {validOptions.map((option) => {
          const selected = option === value;
          const activeOption = option === active;
          return (
            <button
              key={`${dialogId}-option-${option}`}
              id={`${dialogId}-time-${option.replace(":", "-")}`}
              type="button"
              role="option"
              tabIndex={activeOption ? 0 : -1}
              aria-selected={selected}
              onFocus={() => setActive(option)}
              onMouseEnter={() => setActive(option)}
              onClick={() => commit(option)}
              className={cn(
                ORYA_TIME_OPTION_SSOT_CLASS,
                selected
                  ? "bg-cyan-300 text-black shadow-[0_10px_24px_rgba(107,255,255,0.34)]"
                  : "text-white/86 hover:bg-white/10",
                activeOption && !selected && "ring-1 ring-white/35",
              )}
            >
              <span>{option}</span>
              {selected ? <span className="text-sm">✓</span> : null}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] text-white/50">Atalhos: setas, PgUp/PgDn, Home/End, Enter, Esc.</p>
    </div>
  );

  const displayValue = isValidLocalTime(value) ? value : placeholder;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          ORYA_TIME_TRIGGER_SSOT_CLASS,
          disabled && "cursor-not-allowed opacity-60",
          open && "border-cyan-300/60 text-white",
          buttonClassName,
        )}
      >
        <span className="truncate">{displayValue}</span>
        <span className="text-[10px] text-white/55">▼</span>
      </button>

      {mounted && open
        ? createPortal(
            isMobile ? (
              <div className="fixed inset-0 z-[var(--z-modal)] bg-black/65 backdrop-blur-sm" onClick={() => setOpen(false)}>
                <div
                  className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#060a16] p-4"
                  onClick={(event) => event.stopPropagation()}
                >
                  {panel}
                </div>
              </div>
            ) : (
              <div className="fixed inset-0 z-[var(--z-popover)]" onClick={() => setOpen(false)}>
                <div onClick={(event) => event.stopPropagation()}>{panel}</div>
              </div>
            ),
            document.body,
          )
        : null}
    </div>
  );
}
