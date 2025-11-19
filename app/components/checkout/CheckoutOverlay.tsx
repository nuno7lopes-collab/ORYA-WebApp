"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

type CheckoutOverlayProps = {
  open: boolean;
  onClose: () => void;
  coverImageUrl?: string | null;
  children: React.ReactNode;
};

/**
 * CheckoutOverlay
 *
 * 🔥 Camada base atrás do modal (blur + dark gradient)
 * Inspirado no estilo DAIS / DICE / Fever
 * - Blur fortíssimo
 * - Gradiente vertical escuro para destacar o modal
 * - Imagem do evento desfocada no fundo
 */
export default function CheckoutOverlay({
  open,
  onClose,
  coverImageUrl,
  children,
}: CheckoutOverlayProps) {
  if (typeof document === "undefined") return null;
  if (!open) return null;

  const cover =
    coverImageUrl && coverImageUrl.trim().length > 0
      ? coverImageUrl
      : "https://images.unsplash.com/photo-1541987392829-5937c1069305?q=80&w=1600";

  return createPortal(
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center"
      role="presentation"
    >
      {/* Layer 1 — Backdrop blackout com blur */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-2xl"
        onClick={onClose}
      />

      {/* Layer 2 — Imagem do evento em blur forte */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `url(${cover})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(30px)",
        }}
      />

      {/* Layer 3 — Gradiente vertical (fade para preto) */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/90" />

      {/* CONTEÚDO (modal ou steps) */}
      <div className="relative z-[80] w-full h-full flex items-center justify-center">
        {children}
      </div>
    </div>,
    document.body,
  );
}
