"use client";

import { useCheckout } from "@/app/components/checkout/checkoutContext";

export default function CheckoutStep1Tickets() {
  const { ticketName, price, qty, setQty, setStep } = useCheckout();

  const handleQtyChange = (delta: number) => {
    setQty(Math.max(1, qty + delta));
  };

  const total = price != null ? price * qty : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/60">
            Passo 1 de 3
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Escolhe a quantidade
          </h2>
          <p className="mt-1 text-xs text-white/70">
            Podes ajustar o número de bilhetes antes de avançar para o
            pagamento.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/15 bg-black/40 p-4">
        <p className="text-sm text-white/70">Bilhete selecionado</p>
        <p className="text-base font-semibold text-white">
          {ticketName ?? "Bilhete geral"}
        </p>
        {price != null && (
          <p className="mt-1 text-sm text-white/70">
            {price.toFixed(2)} € por bilhete
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-3 rounded-full bg-white/5 px-3 py-1.5">
            <button
              type="button"
              onClick={() => handleQtyChange(-1)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-lg text-white/80 disabled:opacity-40"
              disabled={qty <= 1}
            >
              –
            </button>
            <span className="min-w-[2ch] text-center text-sm font-semibold text-white">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => handleQtyChange(1)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-lg text-black hover:scale-105 active:scale-95"
            >
              +
            </button>
          </div>

          {total != null && (
            <div className="text-right">
              <p className="text-xs text-white/60">Total estimado</p>
              <p className="text-lg font-semibold text-white">
                {total.toFixed(2)} €
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2 text-sm font-semibold text-black shadow-[0_0_18px_rgba(107,255,255,0.5)] hover:scale-[1.02] active:scale-95"
        >
          Continuar para pagamento
        </button>
      </div>
    </div>
  );
}