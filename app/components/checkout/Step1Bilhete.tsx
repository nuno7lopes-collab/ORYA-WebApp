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
  paymentScenario?: string | null;
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
    const rawQty =
      typeof w.quantity === "number" && w.quantity > 0 ? w.quantity : 0;
    const remaining =
      typeof w.remaining === "number" && w.remaining >= 0
        ? w.remaining
        : null;
    const maxForWave =
      remaining === null ? Number.MAX_SAFE_INTEGER : Math.max(0, remaining);
    initialQuantidades[w.id] = Math.min(rawQty, maxForWave);
  }
  const variant =
    (safeDados.additional?.checkoutUiVariant as string) ?? "EVENT_DEFAULT";

  const [quantidades, setQuantidades] = useState<Record<string, number>>(
    initialQuantidades,
  );
  const [padelSelection, setPadelSelection] = useState<
    "INDIVIDUAL" | "DUO_SPLIT" | "DUO_FULL"
  >("INDIVIDUAL");
  const [padelJoinMode, setPadelJoinMode] = useState<"INVITE_PARTNER" | "LOOKING_FOR_PARTNER">("INVITE_PARTNER");

  // Qual wave está expandida (tipo acordeão)
  const [aberto, setAberto] = useState<string | null>(
    cheapestAvailable?.id ?? stableWaves[0]?.id ?? null,
  );

  // 💰 Totais para mostrar apenas (backend recalcula sempre)
  const { total, selectedQty } = stableWaves.reduce(
    (acc: { total: number; selectedQty: number }, w: Wave) => {
      const q = quantidades[w.id] ?? 0;
      const price = typeof w.price === "number" ? w.price : 0;
      return { total: acc.total + q * price, selectedQty: acc.selectedQty + q };
    },
    { total: 0, selectedQty: 0 },
  );

  function toggleWave(id: string) {
    setAberto((prev) => (prev === id ? null : id));
  }

  function getMaxForWave(waveId: string) {
    const wave = stableWaves.find((w) => w.id === waveId);
    if (!wave) return Number.MAX_SAFE_INTEGER;
    const remaining =
      typeof wave.remaining === "number" && wave.remaining >= 0
        ? wave.remaining
        : null;
    return remaining === null ? Number.MAX_SAFE_INTEGER : Math.max(0, remaining);
  }

  function handleIncrement(id: string) {
    const maxAllowed = getMaxForWave(id);
    setQuantidades((prev) => {
      const current = prev[id] ?? 0;
      if (current >= maxAllowed) return prev;
      return {
        ...prev,
        [id]: current + 1,
      };
    });
  }

  function handleDecrement(id: string) {
    setQuantidades((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) - 1),
    }));
  }

  function handleContinuar() {
    if (variant === "PADEL_TOURNAMENT") {
      const target = stableWaves.find((w) => normalizeStatus(w.status) !== "sold_out" && normalizeStatus(w.status) !== "closed");
      if (!target) return;

      const scenario =
        padelSelection === "DUO_SPLIT"
          ? "GROUP_SPLIT"
          : padelSelection === "DUO_FULL"
            ? "GROUP_FULL"
            : "SINGLE";

      const nextQuantidades: Record<string, number> = { [target.id]: padelSelection === "DUO_FULL" ? 2 : 1 };

      atualizarDados({
        paymentScenario: scenario,
        additional: {
          ...(safeDados.additional && typeof safeDados.additional === "object" ? safeDados.additional : {}),
          quantidades: nextQuantidades,
          total: (target.price ?? 0) * (scenario === "GROUP_FULL" ? 2 : 1),
          padelJoinMode: padelJoinMode,
          checkoutUiVariant: variant,
        },
      });
      irParaPasso(2);
      return;
    }

    // Permitir avançar mesmo que aparente 0€ — backend decide se é FREE/PAID.
    if (selectedQty <= 0) return;

    // Guardar info deste step no contexto (quantidades + total)
    atualizarDados({
      paymentScenario: "SINGLE",
      additional: {
        ...(safeDados.additional && typeof safeDados.additional === "object" ? safeDados.additional : {}),
        quantidades,
        total,
        checkoutUiVariant: variant,
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

  if (variant === "PADEL_TOURNAMENT") {
    const baseWave = stableWaves.find((w) => normalizeStatus(w.status) !== "sold_out" && normalizeStatus(w.status) !== "closed") ?? stableWaves[0];
    const basePrice = baseWave?.price ?? 0;
    return (
      <div className="flex flex-col gap-6 text-white max-h-[80vh] overflow-hidden">
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">
              Passo 1 de 3
            </p>
            <h2 className="text-xl font-semibold leading-tight">Escolhe como queres jogar</h2>
            <p className="text-[11px] text-white/60 max-w-sm">
              Padel: inscrição individual ou como dupla. Pagas já a tua parte ou a dupla completa.
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

        <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5]" />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => {
              setPadelSelection("INDIVIDUAL");
              setPadelJoinMode("INVITE_PARTNER");
            }}
            className={`rounded-2xl border px-4 py-4 text-left transition shadow ${
              padelSelection === "INDIVIDUAL"
                ? "border-[#6BFFFF] bg-white/10 shadow-[0_0_24px_rgba(107,255,255,0.35)]"
                : "border-white/12 bg-white/[0.03] hover:border-white/25"
            }`}
          >
            <p className="text-sm font-semibold">Inscrição individual</p>
            <p className="text-[11px] text-white/65 mt-1">1 lugar. Pode entrar em matchmaking.</p>
            <p className="mt-3 text-lg font-semibold">{basePrice.toFixed(2)} €</p>
            <div className="mt-3 space-y-2 text-[11px] text-white/70">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={padelJoinMode === "INVITE_PARTNER" && padelSelection === "INDIVIDUAL"}
                  onChange={() => setPadelJoinMode("INVITE_PARTNER")}
                />
                Já tenho parceiro (convite)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={padelJoinMode === "LOOKING_FOR_PARTNER" && padelSelection === "INDIVIDUAL"}
                  onChange={() => setPadelJoinMode("LOOKING_FOR_PARTNER")}
                />
                Estou à procura de parceiro
              </label>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setPadelSelection("DUO_SPLIT");
              setPadelJoinMode("INVITE_PARTNER");
            }}
            className={`rounded-2xl border px-4 py-4 text-left transition shadow ${
              padelSelection === "DUO_SPLIT"
                ? "border-[#6BFFFF] bg-white/10 shadow-[0_0_24px_rgba(107,255,255,0.35)]"
                : "border-white/12 bg-white/[0.03] hover:border-white/25"
            }`}
          >
            <p className="text-sm font-semibold">Dupla · pagar só a minha parte</p>
            <p className="text-[11px] text-white/65 mt-1">1 lugar pago. O parceiro paga o dele.</p>
            <p className="mt-3 text-lg font-semibold">{basePrice.toFixed(2)} €</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setPadelSelection("DUO_FULL");
              setPadelJoinMode("INVITE_PARTNER");
            }}
            className={`rounded-2xl border px-4 py-4 text-left transition shadow ${
              padelSelection === "DUO_FULL"
                ? "border-[#6BFFFF] bg-white/10 shadow-[0_0_24px_rgba(107,255,255,0.35)]"
                : "border-white/12 bg-white/[0.03] hover:border-white/25"
            }`}
          >
            <p className="text-sm font-semibold">Dupla · pagar os dois lugares</p>
            <p className="text-[11px] text-white/65 mt-1">2 lugares pagos já garantidos.</p>
            <p className="mt-3 text-lg font-semibold">{(basePrice * 2).toFixed(2)} €</p>
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
          <div className="text-[11px] text-white/70">
            Seleciona uma opção para avançar.
          </div>
          <button
            type="button"
            onClick={handleContinuar}
            className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2.5 text-xs font-semibold text-black shadow-[0_0_26px_rgba(107,255,255,0.55)] hover:scale-[1.02] active:scale-95 transition-transform"
          >
            Continuar
          </button>
        </div>
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
          const maxForWave = getMaxForWave(wave.id);
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
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] text-white/80 ${
                      isSoldOut
                        ? "border-red-400/40 bg-red-500/10"
                        : "border-emerald-300/30 bg-emerald-400/10"
                    }`}
                  >
                    {isSoldOut ? "Esgotado" : "Disponível"}
                  </span>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                      q > 0
                        ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-100"
                        : "border-white/20 bg-white/10 text-white/80"
                    }`}
                  >
                    {q > 0 ? q : isOpen ? "−" : "+"}
                  </span>
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
                      disabled={
                        isSoldOut || (quantidades[wave.id] ?? 0) >= maxForWave
                      }
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
