"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type StorePanelModalProps = {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  description?: string;
  stepLabel?: string;
  size?: "md" | "lg" | "xl";
  children: ReactNode;
  footer?: ReactNode;
};

const SIZE_CLASS: Record<NonNullable<StorePanelModalProps["size"]>, string> = {
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-4xl",
};

export default function StorePanelModal({
  open,
  onClose,
  eyebrow,
  title,
  description,
  stepLabel,
  size = "lg",
  children,
  footer,
}: StorePanelModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "w-full overflow-hidden rounded-3xl border border-white/12 bg-[#050915]/95 text-white shadow-[0_28px_80px_rgba(0,0,0,0.75)]",
          SIZE_CLASS[size],
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            {eyebrow ? (
              <p className="text-[11px] uppercase tracking-[0.26em] text-white/55">{eyebrow}</p>
            ) : null}
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {description ? <p className="text-xs text-white/60">{description}</p> : null}
            {stepLabel ? <p className="text-xs text-white/50">{stepLabel}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/70 hover:border-white/40"
          >
            Fechar
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 pb-5 pt-4">{children}</div>

        {footer ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
