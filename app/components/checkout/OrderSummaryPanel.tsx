"use client";

import { formatMoney } from "./checkoutUtils";
import type { CheckoutBreakdown } from "./contextoCheckout";

type OrderSummaryPanelProps = {
  total: number | null;
  discount?: number;
  breakdown?: CheckoutBreakdown | null;
};

export default function OrderSummaryPanel({
  total,
  discount = 0,
  breakdown,
}: OrderSummaryPanelProps) {
  if (total === null) return null;
  const currency = breakdown?.currency ?? "EUR";
  const cardPlatformFeeCents = breakdown?.cardPlatformFeeCents ?? 0;
  const baseCents = breakdown
    ? Math.max(0, (breakdown.subtotalCents ?? 0) - (breakdown.discountCents ?? 0))
    : Math.round(total * 100);

  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-4 shadow-inner shadow-black/40 backdrop-blur-xl space-y-3">
      <div className="flex items-center justify-between text-xs text-white/70">
        <span className="uppercase tracking-[0.14em]">Resumo</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 border border-white/10 text-[11px] text-white/70">
          🔒 Pagamento seguro
        </span>
      </div>

      <div className="space-y-2 text-[12px] text-white/75">
        <div className="flex items-center justify-between">
          <span>Valor base</span>
          <span>{formatMoney(baseCents, currency)}</span>
        </div>
        {cardPlatformFeeCents > 0 && (
          <div className="flex items-center justify-between">
            <span>Taxa de plataforma (Cartão)</span>
            <span>{formatMoney(cardPlatformFeeCents, currency)}</span>
          </div>
        )}
        {discount > 0 ? (
          <div className="flex items-center justify-between text-emerald-200">
            <span>Desconto</span>
            <span>-{discount.toFixed(2)} €</span>
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 border border-white/12">
        <div className="flex flex-col text-white/80">
          <span className="text-[12px]">Total a pagar</span>
        </div>
        <span className="text-xl font-semibold text-white">
          {formatMoney(Math.round(total * 100), currency)}
        </span>
      </div>
    </div>
  );
}
