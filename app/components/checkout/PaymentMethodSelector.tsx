"use client";

type PaymentMethod = "mbway" | "card";

type PaymentMethodSelectorProps = {
  value: PaymentMethod;
  cardFeePercentLabel: string;
  onSelect: (method: PaymentMethod) => void;
};

export default function PaymentMethodSelector({
  value,
  cardFeePercentLabel,
  onSelect,
}: PaymentMethodSelectorProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
      <div className="flex items-center justify-between text-[11px] text-white/70">
        <span className="uppercase tracking-[0.16em]">Método de pagamento</span>
        <span
          className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/70"
          title="MB WAY não tem taxa adicional. Cartão inclui taxa de plataforma."
        >
          Info
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelect("mbway")}
          className={`flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition ${
            value === "mbway"
              ? "border-emerald-300/60 bg-emerald-400/10 text-white shadow-[0_18px_40px_rgba(16,185,129,0.18)]"
              : "border-white/15 bg-white/5 text-white/75 hover:border-white/30"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">MB WAY</span>
            <span className="rounded-full border border-amber-300/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
              Recomendado · 0€ taxas
            </span>
          </div>
          <span className="text-[11px] text-white/60">Pagamento rápido no telemóvel.</span>
        </button>
        <button
          type="button"
          onClick={() => onSelect("card")}
          className={`flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition ${
            value === "card"
              ? "border-white/40 bg-white/10 text-white shadow-[0_18px_40px_rgba(255,255,255,0.14)]"
              : "border-white/15 bg-white/5 text-white/75 hover:border-white/30"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Cartão</span>
            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
              +{cardFeePercentLabel}
            </span>
          </div>
          <span className="text-[11px] text-white/60">Inclui taxa de plataforma.</span>
        </button>
      </div>
      <p className="text-[11px] text-white/55">
        MB WAY não tem taxa adicional. Cartão inclui taxa de plataforma.
      </p>
    </div>
  );
}
