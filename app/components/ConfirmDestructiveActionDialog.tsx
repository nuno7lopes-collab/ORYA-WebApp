"use client";

import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  description?: ReactNode;
  consequences?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  dangerLevel?: "medium" | "high";
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDestructiveActionDialog({
  open,
  title,
  description,
  consequences,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  dangerLevel = "medium",
  onConfirm,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;

  const tone =
    dangerLevel === "high"
      ? "from-[#7F1D1D] via-[#991B1B] to-[#111827]"
      : "from-[#92400E] via-[#78350F] to-[#0F172A]";

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-white/12 bg-[#050915]/95 p-5 shadow-[0_28px_80px_rgba(0,0,0,0.75)] text-white">
        <div className="rounded-xl border border-white/10 bg-gradient-to-br px-4 py-3"
          style={{ backgroundImage: `linear-gradient(135deg, var(--tw-gradient-from), var(--tw-gradient-to))` }}
          className={`bg-gradient-to-br ${tone}`}
        >
          <h3 className="text-lg font-semibold leading-tight">{title}</h3>
          {description && <p className="mt-1 text-sm text-white/80">{description}</p>}
        </div>

        {Array.isArray(consequences) && consequences.length > 0 && (
          <ul className="mt-4 space-y-1 text-[13px] text-white/70">
            {consequences.map((c) => (
              <li key={c} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white/60" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 px-3 py-2 text-[12px] text-white/75 hover:border-white/30 hover:bg-white/5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-full px-4 py-2 text-[12px] font-semibold shadow-[0_0_22px_rgba(107,255,255,0.35)] ${
              dangerLevel === "high"
                ? "bg-gradient-to-r from-[#F87171] via-[#EF4444] to-[#B91C1C] text-white hover:brightness-110"
                : "bg-gradient-to-r from-[#FBBF24] via-[#F59E0B] to-[#D97706] text-black hover:brightness-110"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
