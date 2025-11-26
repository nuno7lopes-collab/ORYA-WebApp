"use client";

import { useState } from "react";
import { useCheckout } from "./contextoCheckout";

type Wave = {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  quantity?: number | null;
  status?: string;
  remaining?: number | null;
};

type CheckoutData = {
  waves?: Wave[];
  additional?: Record<string, unknown>;
};

export default function Step1Bilhete() {
  const { dados, irParaPasso, fecharCheckout, atualizarDados } = useCheckout();

  const safeDados: CheckoutData =
    dados && typeof dados === "object"
      ? (dados as CheckoutData)
      : { waves: [], additional: {} };

  const normalizeStatus = (status?: string) =>
    (status || "on_sale").toLowerCase();

  const stableWaves: Wave[] = Array.isArray(safeDados.waves)
    ? [...safeDados.waves].map((w) => ({
        ...w,
        status: normalizeStatus(w.status),
      }))
    : [];
  const cheapestAvailable = [...stableWaves]
    .filter((w) => {
      const st = normalizeStatus(w.status);
      return st !== "sold_out" && st !== "closed";
    })
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0];
  const hasWaves = stableWaves.length > 0;

  // 🧮 Quantidades iniciais por wave (memoizado para não recriar em cada render)
  const initialQuantidades: Record<string, number> = {};
  for (const w of stableWaves) {
    const qty =
      typeof w.quantity === "number" && w.quantity > 0 ? w.quantity : 0;
    initialQuantidades[w.id] = qty;
  }

  const [quantidades, setQuantidades] = useState<Record<string, number>>(
    initialQuantidades,
  );

  // Qual wave está expandida (tipo acordeão)
  const [aberto, setAberto] = useState<string | null>(
    cheapestAvailable?.id ?? stableWaves[0]?.id ?? null,
  );

  // 💰 Total dinâmico
  const total = stableWaves.reduce((acc: number, w: Wave) => {
    const q = quantidades[w.id] ?? 0;
    const price = typeof w.price === "number" ? w.price : 0;
    return acc + q * price;
  }, 0);

  function toggleWave(id: string) {
    setAberto((prev) => (prev === id ? null : id));
  }

  function handleIncrement(id: string) {
    setQuantidades((prev) => ({
      ...prev,
      [id]: (prev[id] ?? 0) + 1,
    }));
  }

  function handleDecrement(id: string) {
    setQuantidades((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) - 1),
    }));
  }

  function handleContinuar() {
    if (total <= 0) return;

    // Guardar info deste step no contexto (quantidades + total)
    atualizarDados({
      additional: {
        ...(safeDados.additional && typeof safeDados.additional === "object" ? safeDados.additional : {}),
        quantidades,
        total,
      },
    });

    irParaPasso(2);
  }

  if (!hasWaves) {
    return (
      <div className="p-6 text-sm text-white/70">
        A carregar bilhetes... Se isto persistir, volta atrás e tenta novamente.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-white max-h-[80vh] overflow-hidden">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">
            Passo 1 de 3
          </p>
          <h2 className="text-xl font-semibold leading-tight">
            Escolhe o teu bilhete
          </h2>
          <p className="text-[11px] text-white/60 max-w-xs">
            Seleciona a wave, ajusta quantidades e revê antes de pagar.
          </p>
        </div>
        <button
          type="button"
          onClick={fecharCheckout}
          className="text-[11px] rounded-full border border-white/15 px-3 py-1 text-white/65 hover:text-white hover:border-white/40 transition-colors"
        >
          Fechar
        </button>
      </header>

      {/* Barra de progresso */}
      <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
        <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5]" />
      </div>

      {/* Lista de waves com scroll interno */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-3">
        {stableWaves.map((wave: Wave) => {
          const q = quantidades[wave.id] ?? 0;
          const isOpen = aberto === wave.id;
          const status = normalizeStatus(wave.status);
          const isSoldOut = status === "sold_out" || status === "closed";
          const badge =
            status === "upcoming"
              ? "Em breve"
              : isSoldOut
                ? "Venda terminada"
                : "Disponível";
          const badgeClass = isSoldOut
            ? "border-red-400/50 bg-red-500/20 text-red-50"
            : status === "upcoming"
              ? "border-amber-300/50 bg-amber-400/20 text-amber-50"
              : "border-emerald-300/50 bg-emerald-500/18 text-emerald-50";

          return (
            <div
              key={wave.id}
              className="rounded-2xl border border-white/12 bg-white/[0.04] shadow-[0_6px_20px_rgba(0,0,0,0.55)]"
            >
              {/* Header Wave */}
              <button
                type="button"
                onClick={() => toggleWave(wave.id)}
                className="w-full flex items-center justify-between px-4 py-3"
                disabled={isSoldOut}
              >
                <div className="text-left">
                  <p className="text-sm font-semibold">{wave.name}</p>
                  <p className="text-[11px] text-white/50">
                    {typeof wave.price === "number"
                      ? `${wave.price.toFixed(2)} €`
                      : "Preço indisponível"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] text-white/75">
                    {badge}
                  </span>
                  <span className="text-xl">{isOpen ? "−" : "+"}</span>
                </div>
              </button>

              {/* Conteúdo Wave */}
              {isOpen && (
                <div className="px-4 pb-4 flex flex-col gap-3">
                  <p className="text-[11px] text-white/60">
                    {wave.description ?? "Sem descrição disponível."}
                  </p>

                  {isSoldOut && (
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/70">
                      Venda terminada. Escolhe outra wave ou volta mais tarde.
                    </div>
                  )}

                  <div className="inline-flex items-center gap-2 rounded-full bg-black/60 border border-white/15 px-2 py-1.5 shadow-md">
                    <button
                      type="button"
                      onClick={() => handleDecrement(wave.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-50"
                      disabled={isSoldOut}
                    >
                      –
                    </button>

                    <span className="w-9 text-center text-sm font-semibold">
                      {q}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleIncrement(wave.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-100 disabled:opacity-50"
                      disabled={isSoldOut}
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Total + CTA */}
      <div className="border-t border-white/10 pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12px] text-white/70">
          Total:{" "}
          <span className="font-semibold text-white text-base">
            {total.toFixed(2)} €
          </span>
        </p>
        <button
          type="button"
          disabled={total === 0}
          onClick={handleContinuar}
          className="mt-3 sm:mt-0 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2.5 text-xs font-semibold text-black shadow-[0_0_26px_rgba(107,255,255,0.55)] disabled:opacity-50 hover:scale-[1.02] active:scale-95 transition-transform"
        >
          Continuar para pagamento
        </button>
      </div>
    </div>
  );
}
