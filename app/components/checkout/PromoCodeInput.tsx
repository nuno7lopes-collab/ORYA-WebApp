"use client";

type PromoCodeInputProps = {
  promoInput: string;
  onChange: (value: string) => void;
  onApply: () => void;
  onRemove: () => void;
  warning?: string | null;
  appliedDiscount?: number;
  appliedPromoLabel?: string | null;
};

export default function PromoCodeInput({
  promoInput,
  onChange,
  onApply,
  onRemove,
  warning,
  appliedDiscount = 0,
  appliedPromoLabel,
}: PromoCodeInputProps) {
  const hasDiscount = appliedDiscount > 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-2">
      <label htmlFor="promo-code" className="text-xs text-white/70">
        Tens um código promocional?
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="promo-code"
          type="text"
          value={promoInput}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Insere o código"
          className="flex-1 rounded-xl bg-white/[0.05] border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
          autoCapitalize="characters"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={onApply}
          className="px-4 py-2 rounded-full bg-white text-black text-sm font-semibold shadow hover:scale-[1.01] active:scale-[0.99] transition"
        >
          Aplicar
        </button>
      </div>
      {warning ? (
        <div
          role="status"
          className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100"
        >
          {warning}
        </div>
      ) : null}
      {hasDiscount ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
          <span>
            {appliedPromoLabel
              ? `Desconto ${appliedPromoLabel}: -${appliedDiscount.toFixed(2)} €`
              : `Desconto aplicado: -${appliedDiscount.toFixed(2)} €`}
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full border border-emerald-300/40 px-2 py-0.5 text-[11px] text-emerald-50 hover:bg-emerald-500/20"
          >
            Remover
          </button>
        </div>
      ) : null}
    </div>
  );
}
