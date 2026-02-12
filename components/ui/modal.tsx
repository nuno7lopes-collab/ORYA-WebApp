"use client";

import { useEffect, useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  closeLabel?: string;
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  bodyClassName,
  closeLabel = "Fechar",
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();

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
      className="fixed inset-0 z-[120] flex items-start justify-center bg-black/60 px-4 py-10"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className={cn(
          "w-full max-w-xl rounded-2xl border border-white/15 bg-gradient-to-br from-[#0b1226]/90 via-[#0b1124]/85 to-[#050912]/95 p-4 shadow-[0_30px_120px_rgba(0,0,0,0.7)]",
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
      >
        {(title || description) && (
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              {title ? (
                <p id={titleId} className="text-sm font-semibold text-white">
                  {title}
                </p>
              ) : null}
              {description ? (
                <p id={descriptionId} className="text-[12px] text-white/65">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white/75 hover:border-white/35"
            >
              {closeLabel}
            </button>
          </div>
        )}
        <div className={cn(bodyClassName)}>{children}</div>
      </div>
    </div>
  );
}
