"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCheckout } from "./contextoCheckout";

type Wave = {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  quantity?: number | null;
  status?: string;
  remaining?: number | null;
  padelCategoryId?: number | null;
  padelCategoryLabel?: string | null;
  padelCategoryLinkId?: number | null;
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
  const variant = (
    typeof safeDados.additional?.checkoutUiVariant === "string"
      ? safeDados.additional.checkoutUiVariant
      : "DEFAULT"
  ).toUpperCase();
  const isPadelVariant = variant === "PADEL";
  const padelMeta = (safeDados.additional?.padelMeta as
    | { eventId: number; organizerId: number | null; categoryId?: number | null; categoryLinkId?: number | null }
    | undefined) ?? null;

  const [quantidades, setQuantidades] = useState<Record<string, number>>(
    initialQuantidades,
  );
  const padelCategoryOptions = useMemo(() => {
    if (!isPadelVariant) return [];
    const map = new Map<
      string,
      {
        key: string;
        linkId: number | null;
        categoryId: number | null;
        label: string;
      }
    >();
    for (const wave of stableWaves) {
      const linkId = typeof wave.padelCategoryLinkId === "number" ? wave.padelCategoryLinkId : null;
      const categoryId = typeof wave.padelCategoryId === "number" ? wave.padelCategoryId : null;
      if (!linkId && !categoryId) continue;
      const key = linkId ? `link:${linkId}` : `cat:${categoryId}`;
      if (map.has(key)) continue;
      const label =
        wave.padelCategoryLabel?.trim() ||
        (categoryId ? `Categoria ${categoryId}` : linkId ? `Categoria ${linkId}` : "Categoria");
      map.set(key, { key, linkId, categoryId, label });
    }
    return Array.from(map.values());
  }, [isPadelVariant, stableWaves]);
  const [selectedPadelCategoryKey, setSelectedPadelCategoryKey] = useState<string | null>(() => {
    if (!isPadelVariant) return null;
    if (padelMeta?.categoryLinkId) return `link:${padelMeta.categoryLinkId}`;
    if (padelMeta?.categoryId) return `cat:${padelMeta.categoryId}`;
    return padelCategoryOptions[0]?.key ?? null;
  });
  const [padelSelection, setPadelSelection] = useState<
    "INDIVIDUAL" | "DUO_SPLIT" | "DUO_FULL"
  >("INDIVIDUAL");
  const [padelJoinMode, setPadelJoinMode] = useState<"INVITE_PARTNER" | "LOOKING_FOR_PARTNER">("LOOKING_FOR_PARTNER");
  const [partnerContact, setPartnerContact] = useState("");
  const [partnerError, setPartnerError] = useState<string | null>(null);
  const [padelStockError, setPadelStockError] = useState<string | null>(null);
  const [partnerResults, setPartnerResults] = useState<
    { id: string; username: string | null; fullName: string | null; avatarUrl: string | null }[]
  >([]);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [partnerSelected, setPartnerSelected] = useState<{
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    label: string;
  } | null>(null);
  const partnerSelectedLabel = partnerSelected?.label ?? "";
  const searchAbortRef = useRef<AbortController | null>(null);
  const partnerRequired = padelJoinMode === "INVITE_PARTNER";
  const hasPartnerContact = partnerContact.trim().length > 0;
  const canContinuePadel = !partnerRequired || hasPartnerContact;

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

  useEffect(() => {
    if (!isPadelVariant) return;
    if (padelCategoryOptions.length === 0) {
      if (selectedPadelCategoryKey !== null) {
        setSelectedPadelCategoryKey(null);
      }
      return;
    }
    const desiredKey =
      padelMeta?.categoryLinkId ? `link:${padelMeta.categoryLinkId}` : padelMeta?.categoryId ? `cat:${padelMeta.categoryId}` : null;
    const hasCurrent = selectedPadelCategoryKey
      ? padelCategoryOptions.some((opt) => opt.key === selectedPadelCategoryKey)
      : false;
    if (hasCurrent) return;
    if (desiredKey && padelCategoryOptions.some((opt) => opt.key === desiredKey)) {
      setSelectedPadelCategoryKey(desiredKey);
    } else {
      setSelectedPadelCategoryKey(padelCategoryOptions[0].key);
    }
  }, [isPadelVariant, padelCategoryOptions, padelMeta?.categoryId, padelMeta?.categoryLinkId, selectedPadelCategoryKey]);

  const selectedPadelCategory =
    padelCategoryOptions.find((opt) => opt.key === selectedPadelCategoryKey) ?? null;
  const resolvedPadelMeta = padelMeta
    ? {
        ...padelMeta,
        categoryId: selectedPadelCategory?.categoryId ?? padelMeta.categoryId ?? null,
        categoryLinkId: selectedPadelCategory?.linkId ?? padelMeta.categoryLinkId ?? null,
      }
    : null;
  const padelCategoryRequired = isPadelVariant && padelCategoryOptions.length > 1;
  const padelCategorySelected = !padelCategoryRequired || Boolean(selectedPadelCategory);

  const padelFilteredWaves = isPadelVariant && selectedPadelCategory
    ? stableWaves.filter((w) => {
        if (selectedPadelCategory.linkId) return w.padelCategoryLinkId === selectedPadelCategory.linkId;
        if (selectedPadelCategory.categoryId) return w.padelCategoryId === selectedPadelCategory.categoryId;
        return true;
      })
    : stableWaves;
  const padelCandidateWave =
    padelFilteredWaves.find((w) => {
      const st = normalizeStatus(w.status);
      return st !== "sold_out" && st !== "closed";
    }) ?? padelFilteredWaves[0] ?? null;
  const padelRemainingSlots =
    typeof padelCandidateWave?.remaining === "number" ? padelCandidateWave.remaining : null;
  const padelHasPairSlots =
    padelCandidateWave ? (padelRemainingSlots === null ? true : padelRemainingSlots >= 2) : false;

  // Sugestões de parceiro (procura por @username/nome)
  useEffect(() => {
    if (padelJoinMode !== "INVITE_PARTNER") {
      setPartnerResults([]);
      return;
    }
    const term = partnerContact.trim();
    if (partnerSelected && term === partnerSelected.label) {
      setPartnerResults([]);
      return;
    }
    if (term.length < 2) {
      setPartnerResults([]);
      return;
    }

    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;

    const timeout = setTimeout(async () => {
      try {
        setPartnerLoading(true);
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          setPartnerResults([]);
        } else {
          setPartnerResults(Array.isArray(json.results) ? json.results : []);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setPartnerResults([]);
        }
      } finally {
        setPartnerLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [partnerContact, padelJoinMode, partnerSelectedLabel]);

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
    if (variant === "PADEL") {
      if (padelCategoryRequired && !selectedPadelCategory) {
        setPadelStockError("Seleciona primeiro uma categoria.");
        return;
      }
      const target = padelCandidateWave;
      if (!target || !padelHasPairSlots) {
        setPadelStockError("Sem vagas suficientes para criar uma dupla.");
        return;
      }

      // Em modos com convite (INVITE_PARTNER), obrigar a indicar contacto do parceiro
      if (partnerRequired && !hasPartnerContact) {
        setPartnerError("Indica o contacto do parceiro para enviarmos o convite.");
        return;
      }

      if (padelStockError) setPadelStockError(null);
      setPartnerError(null);

      const scenario =
        padelSelection === "DUO_FULL"
          ? "GROUP_FULL"
          : "GROUP_SPLIT";

      // Criar (ou reusar) pairing antes de avançar
      const paymentMode = scenario === "GROUP_FULL" ? "FULL" : "SPLIT";

      const createPairing = async () => {
        if (!resolvedPadelMeta?.eventId) return null;
        try {
          const res = await fetch("/api/padel/pairings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId: resolvedPadelMeta.eventId,
              organizerId: resolvedPadelMeta.organizerId ?? undefined,
              categoryId: resolvedPadelMeta.categoryId ?? undefined,
              paymentMode,
              pairingJoinMode: padelJoinMode,
              invitedContact:
                padelJoinMode === "INVITE_PARTNER" && partnerContact.trim() ? partnerContact.trim() : undefined,
            }),
          });
          const json = await res.json().catch(() => null);
          if (!res.ok || !json?.ok || !json?.pairing?.id) {
            throw new Error(json?.error || "Falha ao preparar inscrição Padel.");
          }
          const pairing = json.pairing as { id: number; slots?: Array<{ id: number; slot_role?: string; slotRole?: string }> };
          const slot =
            pairing.slots?.find((s) => (s.slot_role ?? s.slotRole) === "CAPTAIN") ??
            pairing.slots?.[0] ??
            null;
          return { pairingId: pairing.id, slotId: slot?.id ?? null };
        } catch (err) {
          console.error("[Step1Bilhete] pairing padel", err);
          alert(err instanceof Error ? err.message : "Erro ao preparar inscrição Padel.");
          return null;
        }
      };

      void createPairing().then((pairingResult) => {
        if (!pairingResult?.pairingId) return;
        if ((scenario === "GROUP_FULL" || scenario === "GROUP_SPLIT") && !pairingResult.slotId) {
          alert("Não foi possível identificar o teu slot na dupla. Atualiza a página e tenta novamente.");
          return;
        }

        const nextQuantidades: Record<string, number> = { [target.id]: scenario === "GROUP_FULL" ? 2 : 1 };
        const totalCalc = (target.price ?? 0) * (scenario === "GROUP_FULL" ? 2 : 1);

        atualizarDados({
          paymentScenario: scenario,
          additional: {
            ...(safeDados.additional && typeof safeDados.additional === "object" ? safeDados.additional : {}),
            quantidades: nextQuantidades,
            total: totalCalc,
            padelJoinMode,
            checkoutUiVariant: variant,
            padelMeta: resolvedPadelMeta ?? padelMeta,
            pairingId: pairingResult.pairingId,
            pairingSlotId: pairingResult.slotId ?? undefined,
            ticketTypeId: Number(target.id),
          },
        });
        irParaPasso(2);
      });

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

    if (variant === "PADEL") {
      const baseWave = padelCandidateWave;
      const basePrice = baseWave?.price ?? 0;
      const hasPairSlotsAvailable = padelHasPairSlots;
    return (
      <div className="flex flex-col gap-6 text-white">
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">
              Passo 1 de 3
            </p>
            <h2 className="text-2xl font-semibold leading-tight">Escolhe como queres jogar</h2>
            <p className="text-[11px] text-white/60 max-w-sm">
              Padel: inscrição individual ou como dupla. Pagas já a tua parte ou a dupla completa.
            </p>
          </div>
          <button
            type="button"
            onClick={fecharCheckout}
            className="text-[11px] rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/75 hover:text-white hover:border-white/40 transition-colors"
          >
            Fechar
          </button>
        </header>

        <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden shadow-[0_6px_20px_rgba(0,0,0,0.35)]">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] animate-pulse" />
        </div>

        {padelCategoryOptions.length > 1 && (
          <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.55)]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Categoria</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {padelCategoryOptions.map((opt) => {
                const isSelected = opt.key === selectedPadelCategoryKey;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      setSelectedPadelCategoryKey(opt.key);
                      if (padelStockError) setPadelStockError(null);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-[12px] transition ${
                      isSelected
                        ? "border-[#6BFFFF]/70 bg-white/12 text-white shadow-[0_10px_30px_rgba(107,255,255,0.25)]"
                        : "border-white/15 bg-white/[0.04] text-white/70 hover:border-white/30"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => {
              setPadelSelection("INDIVIDUAL");
              setPadelJoinMode("LOOKING_FOR_PARTNER");
              if (padelStockError) setPadelStockError(null);
            }}
            disabled={!hasPairSlotsAvailable}
            className={`rounded-2xl border px-4 py-4 text-left transition shadow-lg ${
              padelSelection === "INDIVIDUAL"
                ? "border-[#6BFFFF]/70 bg-white/12 shadow-[0_10px_40px_rgba(107,255,255,0.25)]"
                : "border-white/10 bg-white/[0.04] hover:border-white/25"
            } ${!hasPairSlotsAvailable ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <p className="text-sm font-semibold">Inscrição individual</p>
            <p className="text-[11px] text-white/65 mt-1">1 lugar. Entrar em matchmaking.</p>
            <p className="mt-3 text-lg font-semibold">{basePrice.toFixed(2)} €</p>
            <p className="mt-3 text-[11px] text-white/70">
              Pagas só a tua parte e ficas em procura de parceiro.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setPadelSelection("DUO_SPLIT");
              setPadelJoinMode("INVITE_PARTNER");
              if (padelStockError) setPadelStockError(null);
            }}
            disabled={!hasPairSlotsAvailable}
            className={`rounded-2xl border px-4 py-4 text-left transition shadow-lg ${
              padelSelection === "DUO_SPLIT"
                ? "border-[#6BFFFF]/70 bg-white/12 shadow-[0_10px_40px_rgba(107,255,255,0.25)]"
                : "border-white/10 bg-white/[0.04] hover:border-white/25"
            } ${!hasPairSlotsAvailable ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <p className="text-sm font-semibold">Dupla · já tenho parceiro</p>
            <p className="text-[11px] text-white/65 mt-1">1 lugar pago. O parceiro paga o dele.</p>
            <p className="mt-3 text-lg font-semibold">{basePrice.toFixed(2)} €</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setPadelSelection("DUO_FULL");
              setPadelJoinMode("INVITE_PARTNER");
              if (padelStockError) setPadelStockError(null);
            }}
            disabled={!hasPairSlotsAvailable}
            className={`rounded-2xl border px-4 py-4 text-left transition shadow-lg ${
              padelSelection === "DUO_FULL"
                ? "border-[#6BFFFF]/70 bg-white/12 shadow-[0_10px_40px_rgba(107,255,255,0.25)]"
                : "border-white/10 bg-white/[0.04] hover:border-white/25"
            } ${!hasPairSlotsAvailable ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <p className="text-sm font-semibold">Dupla · pagar os dois lugares</p>
            <p className="text-[11px] text-white/65 mt-1">2 lugares pagos já garantidos.</p>
            <p className="mt-3 text-lg font-semibold">{(basePrice * 2).toFixed(2)} €</p>
          </button>
        </div>

        {padelJoinMode === "INVITE_PARTNER" && (
          <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.55)]">
            <p className="text-[12px] font-semibold text-white">Dados do parceiro (obrigatório)</p>
            <p className="text-[11px] text-white/60 mt-1">
              Adiciona o email, telefone ou @username para enviar o convite e prender o lugar dele.
            </p>
            <div className="mt-3">
              {partnerSelected ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2 py-1 text-sm text-white">
                  <div className="h-7 w-7 rounded-full bg-white/10 overflow-hidden border border-white/10">
                    {partnerSelected.avatarUrl ? (
                      <img
                        src={partnerSelected.avatarUrl}
                        alt={partnerSelected.username ?? partnerSelected.fullName ?? "user"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[11px] text-white/70">
                        {(partnerSelected.username ?? partnerSelected.fullName ?? "?").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="font-medium">
                    {partnerSelected.username ? `@${partnerSelected.username}` : partnerSelected.fullName ?? "Utilizador"}
                  </span>
                  {partnerSelected.fullName && partnerSelected.username && (
                    <span className="text-[11px] text-white/70">· {partnerSelected.fullName}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPartnerSelected(null);
                      setPartnerContact("");
                    }}
                    className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[11px] text-white/80 hover:bg-white/20"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  value={partnerContact}
                  onChange={(e) => {
                    setPartnerContact(e.target.value);
                    setPartnerSelected(null);
                    if (partnerError) setPartnerError(null);
                  }}
                  placeholder="Email / telefone / @username"
                  className={`w-full rounded-xl border bg-white/5 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none ${
                    partnerError
                      ? "border-red-400/70 focus:border-red-300/90"
                      : "border-white/15 focus:border-white/40"
                  }`}
                />
              )}
              {partnerError && (
                <p className="mt-2 text-[11px] text-red-300">{partnerError}</p>
              )}
              {!partnerError && partnerLoading && (
                <p className="mt-2 text-[11px] text-white/60">A procurar utilizadores…</p>
              )}
              {!partnerSelected && !partnerError && !partnerLoading && partnerResults.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/12 bg-black/70 shadow-[0_12px_30px_rgba(0,0,0,0.5)]">
                  {partnerResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                    onClick={() => {
                      const username = user.username ? `@${user.username}` : user.fullName ?? "";
                        setPartnerContact(username);
                        setPartnerSelected({
                          ...user,
                          label: username,
                        });
                        setPartnerResults([]);
                        setPartnerError(null);
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-full bg-white/10 overflow-hidden border border-white/10">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.username ?? user.fullName ?? "user"} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[11px] text-white/70">
                            {(user.username ?? user.fullName ?? "?").slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm text-white">{user.username ? `@${user.username}` : user.fullName ?? "Utilizador"}</span>
                        {user.fullName && (
                          <span className="text-[11px] text-white/60">{user.fullName}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
          <div className="text-[11px] text-white/70">
            Seleciona uma opção para avançar.
          </div>
          <button
            type="button"
            onClick={handleContinuar}
            disabled={!canContinuePadel || !hasPairSlotsAvailable || !padelCategorySelected}
            className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-5 py-2.5 text-xs font-semibold text-black shadow-[0_0_26px_rgba(107,255,255,0.55)] hover:scale-[1.02] active:scale-95 transition-transform disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continuar
          </button>
        </div>
        {padelStockError && (
          <p className="text-[11px] text-amber-200">{padelStockError}</p>
        )}
        {!padelStockError && !padelCategorySelected && padelCategoryRequired && (
          <p className="text-[11px] text-amber-200">Seleciona uma categoria para continuar.</p>
        )}
        {!padelStockError && !hasPairSlotsAvailable && (
          <p className="text-[11px] text-amber-200">Sem vagas suficientes para criar uma dupla.</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-white">
      {/* Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">
            Passo 1 de 3
          </p>
          <h2 className="text-2xl font-semibold leading-tight">
            Escolhe o teu bilhete
          </h2>
          <p className="text-[11px] text-white/60 max-w-xs">
            Seleciona a wave, ajusta quantidades e revê antes de pagar.
          </p>
        </div>
        <button
          type="button"
          onClick={fecharCheckout}
          className="text-[11px] rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/75 hover:text-white hover:border-white/40 transition-colors"
        >
          Fechar
        </button>
      </header>

      {/* Barra de progresso */}
      <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden shadow-[0_6px_20px_rgba(0,0,0,0.35)]">
        <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] animate-pulse" />
      </div>

      {/* Lista de waves com scroll interno */}
      <div className="space-y-3">
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
              className="rounded-2xl border border-white/12 bg-white/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.55)] backdrop-blur-xl"
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
