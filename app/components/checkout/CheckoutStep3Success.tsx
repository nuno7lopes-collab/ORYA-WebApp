"use client";

import { useCheckout } from "@/app/components/checkout/checkoutContext";

export default function CheckoutStep3Success() {
  const { eventSlug, ticketName, qty, closeCheckout } = useCheckout();

  return (
    <div className="space-y-6 text-white">
      {/* HEADER */}
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/60">
          Passo 3 de 3
        </p>
        <h2 className="mt-1 text-2xl font-semibold">Pagamento concluído</h2>
        <p className="mt-1 text-sm text-white/70">
          A tua compra foi confirmada! 🎉
        </p>
      </div>

      {/* CARD */}
      <div className="rounded-2xl border border-white/15 bg-black/40 p-5 shadow-xl">
        <p className="text-sm text-white/70">Bilhete comprado</p>
        <p className="text-lg font-semibold text-white mt-1">
          {ticketName ?? "Bilhete geral"}
        </p>

        <p className="mt-3 text-sm text-white/70">Quantidade</p>
        <p className="text-base font-semibold text-white">{qty}</p>

        <p className="mt-4 text-sm text-white/70">
          Podes consultar este bilhete na tua conta ORYA.
        </p>
      </div>

      {/* ACTIONS */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={closeCheckout}
          className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold text-white hover:bg-white/20"
        >
          Fechar
        </button>

        <a
          href={`/eventos/${eventSlug}`}
          className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2 text-sm font-semibold text-black shadow-[0_0_18px_rgba(107,255,255,0.5)] hover:scale-[1.02] active:scale-95"
        >
          Voltar ao evento
        </a>
      </div>
    </div>
  );
}