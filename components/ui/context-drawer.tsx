"use client";

import { useEffect, useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ContextDrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  widthClassName?: string;
};

export function ContextDrawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  widthClassName = "max-w-md",
}: ContextDrawerProps) {
  const titleId = useId();
  const eyebrowId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/50"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className={cn(
          "absolute right-0 top-0 flex h-full w-full flex-col border-l border-white/15 bg-gradient-to-br from-[#0b1226]/95 via-[#0b1124]/90 to-[#050912]/95 p-5 shadow-[0_30px_120px_rgba(0,0,0,0.7)]",
          widthClassName,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : eyebrow ? eyebrowId : undefined}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            {eyebrow ? (
              <p id={eyebrowId} className="text-[11px] uppercase tracking-[0.28em] text-white/60">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <p id={titleId} className="text-xl font-semibold text-white">
                {title}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 px-3 py-2 text-[12px] text-white/70 hover:border-white/40"
          >
            Fechar
          </button>
        </div>
        <div className="mt-4 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
