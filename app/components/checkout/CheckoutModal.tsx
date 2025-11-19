"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type CheckoutModalProps = {
  open: boolean;
  onClose: () => void;
  coverImageUrl?: string | null;
  children: ReactNode;
};

export default function CheckoutModal({
  open,
  onClose,
  coverImageUrl,
  children,
}: CheckoutModalProps) {
  // Bloquear scroll do body quando o modal está aberto
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  // Fechar com ESC
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;
  if (!open) return null;

  const cover =
    coverImageUrl && coverImageUrl.trim().length > 0
      ? coverImageUrl
      : "https://images.unsplash.com/photo-1541987392829-5937c1069305?q=80&w=1600";

  const modalContent = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      {/* BACKDROP com blur + imagem do evento */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-2xl"
        onClick={onClose}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `url(${cover})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(28px)",
        }}
      />

      {/* CONTAINER PRINCIPAL (80% da largura em desktop, quase full em mobile) */}
      <div
        className="relative z-[81] w-[96vw] max-w-5xl md:w-[80vw] rounded-3xl border border-white/18 bg-gradient-to-br from-[#020617ee] via-[#020617f8] to-[#020617] shadow-[0_30px_120px_rgba(0,0,0,0.9)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow subtil nas bordas */}
        <div className="pointer-events-none absolute -inset-px rounded-[1.7rem] border border-white/10 opacity-60" />
        {/* Top gradient highlight */}
        <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[60%] -translate-x-1/2 rounded-full bg-gradient-to-r from-[#FF00C8]/40 via-[#6BFFFF]/35 to-[#1646F5]/40 blur-3xl opacity-70" />

        {/* BOTÃO CLOSE */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-[82] inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/50 text-xs text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Fechar checkout"
        >
          ✕
        </button>

        {/* CONTEÚDO DO MODAL (aqui entram os 3 passos do checkout) */}
        <div className="relative z-[81] p-4 md:p-6 lg:p-7">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}