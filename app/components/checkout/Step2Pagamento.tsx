"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type CheckoutBreakdown, useCheckout } from "./contextoCheckout";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { getTicketCopy } from "./checkoutCopy";
import Step2Header from "./Step2Header";
import Step2PaymentPanel from "./Step2PaymentPanel";
import Step2AccessGate from "./Step2AccessGate";
import AuthRequiredCard from "./AuthRequiredCard";
import { buildClientFingerprint, buildDeterministicIdemKey } from "./checkoutUtils";
import { validateGuestDetails } from "./checkoutValidation";
import { getStripePublishableKey } from "@/lib/stripePublic";
import {
  mapIntentErrorToUi,
  shouldAutoRetryTerminalIntent,
  type IntentCycleState,
  type IntentErrorPayload,
} from "./intentErrorUtils";

type TicketCopy = ReturnType<typeof getTicketCopy>;

type CheckoutItem = {
  ticketId: number;
  quantity: number;
};

type CheckoutWave = {
  id: number | string;
  price: number;
};

type CheckoutData = {
  slug?: string;
  eventId?: number | string;
  waves?: CheckoutWave[];
  additional?: {
    quantidades?: Record<string, number>;
    total?: number;
    guestName?: string;
    guestEmail?: string;
    guestConsent?: boolean;
    guestPhone?: string | null;
    idempotencyKey?: string;
    purchaseId?: string | null;
    requiresAuth?: boolean;
    pairingId?: number;
    pairingSlotId?: number;
    ticketTypeId?: number;
    inviteToken?: string;
    paymentIntentId?: string;
    appliedPromoLabel?: string;
    promoCode?: string;
    freeCheckout?: boolean;
    clientFingerprint?: string;
    intentFingerprint?: string;
    paymentMethod?: "mbway" | "card";
  };
  paymentScenario?: string | null;
};

type GuestInfo = {
  name: string;
  email: string;
  phone?: string;
  consent?: boolean;
};

const FREE_PLACEHOLDER_INTENT_ID = "FREE_CHECKOUT";

export default function Step2Pagamento() {
  const { dados, irParaPasso, atualizarDados, breakdown, setBreakdown } = useCheckout();
  const checkoutVariant =
    typeof dados?.additional?.checkoutUiVariant === "string"
      ? dados.additional.checkoutUiVariant
      : "DEFAULT";
  const ticketCopy = getTicketCopy(checkoutVariant);
  const ticketPluralWithArticle = `${ticketCopy.articlePlural} ${ticketCopy.plural}`;
  const ticketOneOf = ticketCopy.isPadel ? "uma das inscrições" : "um dos bilhetes";
  const ticketAllPlural = ticketCopy.isPadel ? "todas as inscrições" : "todos os bilhetes";
  const ticketNameLabel = ticketCopy.isPadel ? "Nome na inscrição" : "Nome no bilhete";
  const stripeConfigured = useMemo(() => {
    try {
      return Boolean(getStripePublishableKey());
    } catch {
      return false;
    }
  }, []);
  const ticketEmailLabel = ticketCopy.isPadel ? "Email para inscrições e recibo." : "Email para bilhetes e recibo.";
  const freeHeaderLabel = ticketCopy.freeLabel;
  const freeLabelLower = freeHeaderLabel.toLowerCase();
  const freeDescription = ticketCopy.isPadel
    ? "Confirma a tua inscrição. Requer sessão iniciada e username definido."
    : "Confirma a tua entrada gratuita. Requer sessão iniciada e username definido.";
  const freePrepLabel = ticketCopy.isPadel
    ? "A preparar a tua inscrição…"
    : "A preparar a tua entrada gratuita…";
  const freeConfirmLabel = ticketCopy.isPadel
    ? "Estamos a confirmar a tua inscrição gratuita."
    : "Estamos a confirmar a tua entrada gratuita.";
  const scenarioCopy: Record<string, string> = {
    GROUP_SPLIT: "Estás a pagar apenas a tua parte desta dupla.",
    GROUP_FULL: "Estás a comprar 2 lugares (tu + parceiro).",
    RESALE: `Estás a comprar ${ticketCopy.articleSingular} ${ticketCopy.singular} em revenda.`,
    FREE_CHECKOUT: `${ticketCopy.freeLabel} — só para utilizadores com conta e username.`,
  };

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [serverAmount, setServerAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔐 Auth state
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  // Preferimos convidado por defeito para reduzir fricção
  const [purchaseMode, setPurchaseMode] = useState<"auth" | "guest">("guest");
  const [authInfo, setAuthInfo] = useState<string | null>(null);
  const [guestErrors, setGuestErrors] = useState<{ name?: string; email?: string; phone?: string; consent?: string }>({});

  // 👤 Guest form state
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestEmailConfirm, setGuestEmailConfirm] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestConsent, setGuestConsent] = useState(false);
  const [guestSubmitVersion, setGuestSubmitVersion] = useState(0);
  const [guestAttemptVersion, setGuestAttemptVersion] = useState(0);
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [promoWarning, setPromoWarning] = useState<string | null>(null);
  const [appliedPromoLabel, setAppliedPromoLabel] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"mbway" | "card">("mbway");
  const [intentCycleState, setIntentCycleState] = useState<IntentCycleState>("IDLE");
  const lastIntentKeyRef = useRef<string | null>(null);
  const inFlightIntentRef = useRef<string | null>(null);
  const intentRetryTokenRef = useRef(0);
  const cycleGuardRef = useRef<string | null>(null);
  const terminalRetryCycleKeyRef = useRef<string | null>(null);
  const terminalRetryCountRef = useRef(0);
  const lastClearedFingerprintRef = useRef<string | null>(null);
  const idempotencyMismatchCountRef = useRef(0);
  const loadErrorCountRef = useRef(0);
  const [cachedIntent, setCachedIntent] = useState<{
    key: string;
    clientSecret: string | null;
    amount: number | null;
    breakdown: CheckoutBreakdown;
    discount: number;
    freeCheckout: boolean;
    paymentScenario?: string | null;
    promoLabel?: string | null;
    autoAppliedPromo?: boolean;
    purchaseId?: string | null;
  } | null>(null);

  const handleSelectPaymentMethod = (method: "mbway" | "card") => {
    if (method === paymentMethod) return;
    setPaymentMethod(method);
    setCachedIntent(null);
    setClientSecret(null);
    setServerAmount(null);
    setBreakdown(null);
    setIntentCycleState("IDLE");
    intentRetryTokenRef.current = 0;
    lastIntentKeyRef.current = null;
    inFlightIntentRef.current = null;
    if (safeDados) {
      atualizarDados({
        additional: {
          ...(safeDados.additional ?? {}),
          paymentMethod: method,
          intentFingerprint: undefined,
        },
      });
    }
  };

  const safeDados: CheckoutData | null =
    dados && typeof dados === "object" ? (dados as CheckoutData) : null;
  const scenario = safeDados?.paymentScenario ?? cachedIntent?.paymentScenario ?? null;
  const isGratisScenario = scenario === "FREE_CHECKOUT";
  const needsStripe = !isGratisScenario;
  const pairingId =
    safeDados?.additional && typeof safeDados.additional === "object"
      ? (safeDados.additional as Record<string, unknown>).pairingId
      : undefined;
  const pairingSlotId =
    safeDados?.additional && typeof safeDados.additional === "object"
      ? (safeDados.additional as Record<string, unknown>).pairingSlotId
      : undefined;
  const pairingTicketTypeId =
    safeDados?.additional && typeof safeDados.additional === "object"
      ? (safeDados.additional as Record<string, unknown>).ticketTypeId
      : undefined;
  const inviteToken =
    safeDados?.additional && typeof safeDados.additional === "object"
      ? (safeDados.additional as Record<string, unknown>).inviteToken
      : undefined;
  const promoFromLink =
    safeDados?.additional && typeof safeDados.additional === "object"
      ? (safeDados.additional as Record<string, unknown>).promoCode
      : undefined;

  const additionalForRules =
    safeDados?.additional && typeof safeDados.additional === "object"
      ? safeDados.additional
      : {};

  useEffect(() => {
    if (!promoFromLink || typeof promoFromLink !== "string") return;
    if (promoInput.trim() || promoCode.trim()) return;
    const normalized = promoFromLink.trim().toUpperCase();
    if (!normalized) return;
    setPromoInput(normalized);
    setPromoCode(normalized);
  }, [promoCode, promoFromLink, promoInput]);

  // Regras de acesso ao checkout:
  // - FREE_CHECKOUT: sempre com conta
  // - GROUP_SPLIT: por defeito exige conta (capitão a pagar a sua parte)
  // - Podemos forçar via additional.requiresAuth (SSOT no futuro)
  const requiresAuth =
    Boolean((additionalForRules as Record<string, unknown>)?.requiresAuth) ||
    isGratisScenario ||
    scenario === "GROUP_SPLIT";

  useEffect(() => {
    if (!promoCode.trim()) {
      setAppliedDiscount(0);
    }
  }, [promoCode]);

  useEffect(() => {
    if (requiresAuth && purchaseMode !== "auth") {
      setPurchaseMode("auth");
      setClientSecret(null);
      setServerAmount(null);
    }
  }, [requiresAuth, purchaseMode]);


  // Primeiro: verificar se há sessão Supabase no browser e ficar a escutar mudanças de auth
  useEffect(() => {
    let cancelled = false;

    async function checkAuthOnce() {
      try {
        setAuthChecking(true);
        const { data, error } = await supabaseBrowser.auth.getUser();

        if (cancelled) return;

        if (error || !data?.user) {
          setUserId(null);
          if (error) {
            setAuthInfo("Sessão não encontrada. Inicia sessão ou continua como convidado.");
          }
        } else {
          setUserId(data.user.id);
          setAuthInfo(null);
        }
      } catch (err) {
        console.error("[Step2Pagamento] Erro ao verificar auth inicial:", err);
        if (!cancelled) {
          setUserId(null);
          setAuthInfo("Sessão não encontrada. Inicia sessão ou continua como convidado.");
        }
      } finally {
        if (!cancelled) {
          setAuthChecked(true);
          setAuthChecking(false);
        }
      }
    }

    checkAuthOnce();

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;

      if (session?.user) {
        setUserId(session.user.id);
        setAuthChecked(true);
        setAuthChecking(false);
        setAuthInfo(null);
      } else {
        setUserId(null);
        setAuthChecked(true);
        setAuthChecking(false);
        setAuthInfo("Sessão não encontrada. Inicia sessão ou continua como convidado.");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Se vierem dados pré-preenchidos (ex.: voltar atrás), sincronizamos com o estado local do guest
  useEffect(() => {
    const additional =
      safeDados?.additional && typeof safeDados.additional === "object"
        ? safeDados.additional
        : {};
    if (typeof additional.guestName === "string") {
      setGuestName(additional.guestName);
    }
    if (typeof additional.guestEmail === "string") {
      setGuestEmail(additional.guestEmail);
    }
    if (typeof (additional as Record<string, unknown>)?.guestEmailConfirm === "string") {
      setGuestEmailConfirm((additional as Record<string, string>).guestEmailConfirm);
    }
    if (typeof additional.guestPhone === "string") {
      setGuestPhone(additional.guestPhone);
    }
    if (typeof (additional as Record<string, unknown>).guestConsent === "boolean") {
      setGuestConsent(Boolean((additional as Record<string, unknown>).guestConsent));
    }
    const method =
      (additional as Record<string, unknown>).paymentMethod === "card"
        ? "card"
        : "mbway";
    setPaymentMethod(method);
  }, [safeDados]);

  const payload = useMemo(() => {
    if (!safeDados) return null;

    const waves = Array.isArray(safeDados.waves) ? safeDados.waves : [];
    const additional =
      safeDados.additional && typeof safeDados.additional === "object"
        ? safeDados.additional
        : {};

    const quantidades: Record<string, number> =
      (additional.quantidades as Record<string, number> | undefined) ?? {};

    if (!safeDados.slug || waves.length === 0) return null;

    const items: CheckoutItem[] = (waves
      .map((w) => {
        const qty = quantidades[w.id] ?? 0;
        if (!qty || qty <= 0) return null;
        const ticketId = Number(w.id);
        if (!Number.isFinite(ticketId)) return null;
        return { ticketId, quantity: qty };
      })
      .filter(Boolean) as CheckoutItem[])
      .sort((a, b) => a.ticketId - b.ticketId);

    if (items.length === 0) return null;

    const totalFromStep1 =
      typeof additional.total === "number" ? additional.total : null;
    const resolvedPaymentMethod =
      paymentMethod === "card" ? "card" : "mbway";

    const idemKeyRaw = (safeDados?.additional as Record<string, unknown> | undefined)?.idempotencyKey;
    const idemKey = typeof idemKeyRaw === "string" ? idemKeyRaw.trim() : undefined;
    const purchaseId = undefined;

    const isPadelFlow = checkoutVariant === "PADEL";

    return {
      slug: safeDados.slug,
      items,
      total: totalFromStep1,
      promoCode: promoCode.trim() || undefined,
      paymentScenario: safeDados.paymentScenario ?? undefined,
      requiresAuth,
      paymentMethod: resolvedPaymentMethod,
      idempotencyKey: idemKey,
      purchaseId: purchaseId || undefined,
      pairingId: typeof pairingId === "number" ? pairingId : undefined,
      slotId: typeof pairingSlotId === "number" ? pairingSlotId : undefined,
      ticketTypeId: typeof pairingTicketTypeId === "number" ? pairingTicketTypeId : undefined,
      padelCategoryLinkId:
        isPadelFlow && typeof pairingTicketTypeId === "number" ? pairingTicketTypeId : undefined,
      sourceType: isPadelFlow ? "PADEL_REGISTRATION" : undefined,
      eventId: safeDados.eventId ? Number(safeDados.eventId) : undefined,
      inviteToken: typeof inviteToken === "string" && inviteToken.trim() ? inviteToken.trim() : undefined,
    };
  }, [
    safeDados,
    promoCode,
    requiresAuth,
    paymentMethod,
    pairingId,
    pairingSlotId,
    pairingTicketTypeId,
    inviteToken,
    checkoutVariant,
  ]);

  useEffect(() => {
    // Se não houver dados de checkout, mandamos de volta
    if (!payload) {
      setIntentCycleState("IDLE");
      irParaPasso(1);
      return;
    }

    if (needsStripe && !stripeConfigured) {
      setIntentCycleState("FAILED");
      setError("Configuração de pagamentos indisponível. Tenta novamente mais tarde.");
      setLoading(false);
      return;
    }
    // Enquanto não sabemos se está logado, não fazemos nada
    if (!authChecked) {
      setIntentCycleState("IDLE");
      return;
    }

    const isGuestFlow = purchaseMode === "guest";
    const hasGuestSubmission = guestSubmitVersion > 0;
    const guestNameClean = guestName.trim();
    const guestEmailClean = guestEmail.trim();
    const guestPhoneClean = guestPhone.trim();
    const guestReady =
      isGuestFlow &&
      hasGuestSubmission &&
      guestNameClean !== "" &&
      guestEmailClean !== "" &&
      guestConsent;

    // Se não está logado e ainda não escolheu convidado, mostramos UI e não chamamos a API
    if (!userId && !guestReady) {
      setIntentCycleState("IDLE");
      setLoading(false);
      setClientSecret(null);
      setServerAmount(null);
      return;
    }

    const guestPayload: GuestInfo | null = guestReady
      ? {
          name: guestNameClean,
          email: guestEmailClean,
          phone: guestPhoneClean || undefined,
          consent: guestConsent,
        }
      : null;

    const clientFingerprint = buildClientFingerprint({
      slug: payload.slug,
      items: payload.items,
      total: payload.total ?? null,
      promoCode: payload.promoCode ?? null,
      paymentScenario: payload.paymentScenario ?? null,
      requiresAuth,
      paymentMethod,
      mode: purchaseMode,
      userId: userId ?? null,
      guest: guestPayload
        ? {
            name: guestPayload.name,
            email: guestPayload.email,
            phone: guestPayload.phone ?? null,
            consent: guestPayload.consent ?? false,
          }
        : null,
    });

    const additionalObj =
      safeDados?.additional && typeof safeDados.additional === "object"
        ? (safeDados.additional as Record<string, unknown>)
        : {};

    const existingClientFingerprint =
      typeof (additionalObj as any).clientFingerprint === "string"
        ? String((additionalObj as any).clientFingerprint)
        : null;

    const existingIdempotencyKey =
      (safeDados?.additional as Record<string, unknown> | undefined)?.idempotencyKey ??
      (payload as any)?.idempotencyKey ??
      null;
    const stableIdemFingerprint =
      intentRetryTokenRef.current > 0
        ? `${clientFingerprint}:recovery:${intentRetryTokenRef.current}`
        : clientFingerprint;
    const stableIdempotencyKey = buildDeterministicIdemKey(stableIdemFingerprint);
    const currentIdempotencyKey = existingIdempotencyKey ?? stableIdempotencyKey ?? null;
    const cycleGuardKey = `${clientFingerprint}|${purchaseMode}|${paymentMethod}`;

    if (terminalRetryCycleKeyRef.current !== cycleGuardKey) {
      terminalRetryCycleKeyRef.current = cycleGuardKey;
      terminalRetryCountRef.current = 0;
    }

    const existingIntentFingerprint =
      typeof (additionalObj as any).intentFingerprint === "string"
        ? String((additionalObj as any).intentFingerprint)
        : null;

    const hasExistingPurchaseState = Boolean(
      (additionalObj as any).purchaseId || (additionalObj as any).paymentIntentId || (additionalObj as any).freeCheckout,
    );

    // Se o utilizador alterou o checkout (items/promo/guest/mode/etc.) mas ainda temos um purchaseId antigo,
    // limpamos o estado para não reutilizar o PaymentIntent errado (caso clássico: aplicar/remover promo e não recalcular).
    if (
      hasExistingPurchaseState &&
      existingClientFingerprint &&
      existingClientFingerprint !== clientFingerprint &&
      lastClearedFingerprintRef.current !== clientFingerprint
    ) {
      lastClearedFingerprintRef.current = clientFingerprint;

      // Limpeza local imediata para evitar UI/states inconsistentes
      setCachedIntent(null);
      setClientSecret(null);
      setServerAmount(null);
      setBreakdown(null);
      lastIntentKeyRef.current = null;
      inFlightIntentRef.current = null;

      const nextIdemKey = buildDeterministicIdemKey(clientFingerprint);

      atualizarDados({
        additional: {
          ...(safeDados?.additional ?? {}),
          purchaseId: null,
          paymentIntentId: undefined,
          freeCheckout: undefined,
          appliedPromoLabel: undefined,
          // clientFingerprint é só para o FE detetar mudanças
          clientFingerprint,
          // intentFingerprint é do BE (hash). Ao mudar seleção, limpamos.
          intentFingerprint: undefined,
          idempotencyKey: nextIdemKey ?? undefined,
        },
      });

      setIntentCycleState("IDLE");
      setLoading(false);
      return;
    }

    // Backfill: se já existe purchaseId mas ainda não guardámos fingerprint, guardamos para futuras comparações.
    if (hasExistingPurchaseState && !existingClientFingerprint) {
      atualizarDados({
        additional: {
          ...(safeDados?.additional ?? {}),
          clientFingerprint,
        },
      });
    }

    // Chave estável para não recriar PaymentIntent sem necessidade
    const intentKey = JSON.stringify({
      payload,
      guest: guestPayload,
      userId: userId ?? "guest",
      mode: purchaseMode,
      scenario: safeDados?.paymentScenario ?? null,
      clientFingerprint,
      idempotencyKey: currentIdempotencyKey,
      purchaseId:
        (payload as any)?.purchaseId ??
        (safeDados?.additional as any)?.purchaseId ??
        null,
    });

    // Se já temos um intent em cache com a mesma key, reaproveitamos
    if (cachedIntent?.key === intentKey) {
      setClientSecret(cachedIntent.clientSecret);
      setServerAmount(cachedIntent.amount);
      setBreakdown(cachedIntent.breakdown);
      setAppliedDiscount(cachedIntent.discount);
      setAppliedPromoLabel(cachedIntent.promoLabel ?? null);
      setIntentCycleState("READY");
      lastIntentKeyRef.current = intentKey;
      setLoading(false);
      if (cachedIntent.freeCheckout) {
        irParaPasso(3);
        return;
      }
      return;
    }

    // Se já temos clientSecret para o mesmo payload, não refazemos
    if (clientSecret && lastIntentKeyRef.current === intentKey) {
      setIntentCycleState("READY");
      setLoading(false);
      return;
    }

    // Evita requests paralelos com o mesmo payload; se detectarmos que estamos presos
    // (ex.: Strict Mode cancela a primeira run e deixa loading a true), limpamos o ref
    // para voltar a tentar.
    if (inFlightIntentRef.current === intentKey) {
      if (cycleGuardRef.current === cycleGuardKey) {
        return;
      }
      const stuck =
        loading &&
        !clientSecret &&
        lastIntentKeyRef.current !== intentKey;
      if (!stuck) {
        return;
      }
      inFlightIntentRef.current = null;
    }

    let cancelled = false;

    async function createIntent() {
      let lastResponseStatus: number | null = null;
      let outcome: "READY" | "FAILED" | "CANCELLED" = "FAILED";
      try {
        inFlightIntentRef.current = intentKey;
        cycleGuardRef.current = cycleGuardKey;
        setIntentCycleState("PREPARING");
        setLoading(true);
        setError(null);
        setBreakdown(null);

        if (process.env.NODE_ENV === "development") {
          console.debug("[Step2Pagamento.intent] start", {
            cycleGuardKey,
            idempotencyKey: currentIdempotencyKey,
          });
        }

        const idem = currentIdempotencyKey;

        let attempt = 0;
        // Não enviamos purchaseId; o backend calcula anchors determinísticas. idempotencyKey segue para evitar PI terminal.
        let currentPayload = { ...payload };
        delete (currentPayload as any).purchaseId;
        let currentIntentFingerprint = undefined;
        let currentIdemKey = idem;
        let res: Response | null = null;
        let data: IntentErrorPayload | null = null;

        while (attempt < 2) {
          res = await fetch("/api/payments/intent", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...currentPayload,
              guest: guestPayload ?? undefined,
              requiresAuth,
              purchaseId: null,
              idempotencyKey: currentIdemKey,
              intentFingerprint: currentIntentFingerprint ?? undefined,
            }),
          });
          lastResponseStatus = res.status;

          data = (await res.json().catch(() => null)) as IntentErrorPayload | null;

          if (res.status === 409) {
            const canAutoRetryTerminal = shouldAutoRetryTerminalIntent({
              status: res.status,
              data,
              retryCount: terminalRetryCountRef.current,
              maxRetry: 1,
            });

            if (!canAutoRetryTerminal) {
              break;
            }

            attempt += 1;
            terminalRetryCountRef.current += 1;
            const retryToken = terminalRetryCountRef.current;
            const retryFingerprint = `${clientFingerprint}:terminal-retry:${retryToken}`;
            const nextRetryIdemKey =
              buildDeterministicIdemKey(retryFingerprint) ?? currentIdemKey;
            currentIdemKey = nextRetryIdemKey;

            // Reset controlado: só para PI terminal recuperável.
            currentPayload = { ...payload };
            delete (currentPayload as any).purchaseId;
            currentIntentFingerprint = undefined;

            if (!cancelled) {
              setCachedIntent(null);
              setClientSecret(null);
              setServerAmount(null);
              setBreakdown(null);
              lastIntentKeyRef.current = null;
              inFlightIntentRef.current = null;
              intentRetryTokenRef.current += 1;
              setPromoWarning("A sessão de pagamento expirou. Estamos a gerar um novo intento.");
              try {
                atualizarDados({
                  additional: {
                    ...(safeDados?.additional ?? {}),
                    purchaseId: null,
                    paymentIntentId: undefined,
                    freeCheckout: undefined,
                    appliedPromoLabel: undefined,
                    clientFingerprint,
                    intentFingerprint: undefined,
                    idempotencyKey: currentIdemKey ?? undefined,
                  },
                });
              } catch {}
            }

            if (process.env.NODE_ENV === "development") {
              console.debug("[Step2Pagamento.intent] terminal retry", {
                cycleGuardKey,
                retryToken,
                nextRetryIdemKey,
              });
            }

            continue;
          }

          // status != 409 ➜ sair do loop
          break;
        }

        if (!res) {
          if (!cancelled) {
            setBreakdown(null);
            setError("Falha ao contactar o servidor. Tenta novamente.");
            setIntentCycleState("FAILED");
          }
          return;
        }

        if (!data || typeof data !== "object") {
          if (!cancelled) {
            setBreakdown(null);
            setError("Resposta inválida do servidor. Tenta novamente.");
            setIntentCycleState("FAILED");
          }
          return;
        }

        if (process.env.NODE_ENV === "development") {
          console.debug("[Step2Pagamento.intent] response", {
            status: res.status,
            ok: res.ok,
            data,
          });
        }

        const respCode = typeof data?.code === "string" ? data.code : null;

        // 409 final desta run (sem auto-retry adicional) -> mostrar erro final e parar ciclo.
        if (res.status === 409) {
          const mapped = mapIntentErrorToUi({
            status: res.status,
            data,
            fallbackMessage: "Não foi possível preparar o pagamento.",
            retryCount: terminalRetryCountRef.current,
          });
          if (!cancelled) {
            setCachedIntent(null);
            setClientSecret(null);
            setServerAmount(null);
            setBreakdown(null);
            lastIntentKeyRef.current = null;
            inFlightIntentRef.current = null;
            setIntentCycleState("FAILED");
            setPromoWarning(null);
            setError(mapped.message);
          }
          return;
        }

        // Se a API disser 401 ➜ sessão ausente/expirada OU cenário que exige auth
        if (res.status === 401) {
          const mustAuth =
            requiresAuth ||
            respCode === "AUTH_REQUIRED_FOR_GROUP_SPLIT" ||
            respCode === "AUTH_REQUIRED";

          if (!cancelled) {
            // Garantimos estado limpo para permitir retry correto
            setClientSecret(null);
            setServerAmount(null);
            setBreakdown(null);
            setCachedIntent(null);
          }

          if (mustAuth) {
            if (!cancelled) {
              setIntentCycleState("FAILED");
              setPurchaseMode("auth");
              setGuestSubmitVersion(0);
              setGuestErrors({});
              setError(null);
              const freeCopy =
                respCode === "AUTH_REQUIRED_FOR_GROUP_SPLIT"
                  ? "Para pagar apenas a tua parte tens de iniciar sessão."
                  : isGratisScenario
                    ? "Checkouts gratuitos exigem conta com username. Cria conta ou entra para continuar."
                    : "Este tipo de checkout requer sessão iniciada.";
              setAuthInfo(freeCopy);
            }
            return;
          }

          // Guest permitido, mas algo correu mal (ex.: backend rejeitou por sessão)
          if (!cancelled) {
            setIntentCycleState("FAILED");
            setError(
              typeof data?.error === "string"
                ? data.error
                : "Sessão expirada. Tenta novamente."
            );
          }
          return;
        }

        // 403 ➜ utilizador autenticado mas falta username (free checkout)
        if (res.status === 403 && respCode === "USERNAME_REQUIRED") {
          if (!cancelled) {
            setIntentCycleState("FAILED");
            setPurchaseMode("auth");
            setGuestSubmitVersion(0);
            setGuestErrors({});
            setError(null);
            setAuthInfo("Define um username na tua conta para concluir este checkout gratuito.");
          }
          return;
        }

        if (!res.ok || !data?.ok) {
          setBreakdown(null);

          const respCode = typeof data?.code === "string" ? data.code : null;
          const retryable = typeof data?.retryable === "boolean" ? data.retryable : null;
          const nextAction =
            typeof data?.nextAction === "string" && data.nextAction
              ? data.nextAction
              : null;

          if (respCode === "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH") {
            if (!cancelled) {
              setIntentCycleState("FAILED");
              // Limita a 1 retentativa local para evitar loops de 409
              if (idempotencyMismatchCountRef.current >= 1) {
                setError(
                  typeof data?.error === "string"
                    ? data.error
                    : "O checkout mudou noutro separador. Volta ao passo anterior ou recarrega a página e tenta de novo.",
                );
                return;
              }
              idempotencyMismatchCountRef.current += 1;

              // Limpa estado local para forçar novo intent (sem reusar idempotency antiga)
              setClientSecret(null);
              setServerAmount(null);
              setBreakdown(null);
              setCachedIntent(null);
              lastIntentKeyRef.current = null;
              inFlightIntentRef.current = null;

              try {
                atualizarDados({
                  additional: {
                    ...(safeDados?.additional ?? {}),
                    purchaseId: null,
                    paymentIntentId: undefined,
                    idempotencyKey: undefined,
                    intentFingerprint: undefined,
                    clientFingerprint,
                    freeCheckout: undefined,
                    appliedPromoLabel: undefined,
                  },
                });
              } catch {}

              setError(
                typeof data?.error === "string"
                  ? data.error
                  : "O checkout foi aberto noutro separador. Recriámos o pagamento; volta a clicar em Pagar.",
              );
              // Não re-submete automaticamente; utilizador volta a clicar
            }
            return;
          }

          if (respCode === "USERNAME_REQUIRED_FOR_FREE") {
            if (!cancelled) {
              setIntentCycleState("FAILED");
              setError("Este evento gratuito requer sessão com username definido.");
              setPurchaseMode("auth");
              setAuthInfo(`Inicia sessão e define um username para concluir a ${freeLabelLower}.`);
            }
            return;
          }

          if (respCode === "INVITE_REQUIRED") {
            if (!cancelled) {
              setIntentCycleState("FAILED");
              setError("Este evento é apenas por convite.");
              const inviteCopy = userId
                ? "O teu acesso não está na lista. Confirma o email/username convidado."
                : "Inicia sessão com a conta convidada ou usa o email do convite.";
              setAuthInfo(inviteCopy);
            }
            return;
          }

          const msg =
            respCode === "PRICE_CHANGED"
              ? "Os preços foram atualizados. Revê a seleção e tenta novamente."
              : respCode === "INSUFFICIENT_STOCK"
                ? `Stock insuficiente para ${ticketOneOf}.`
                : typeof data?.error === "string"
                  ? data.error
                  : "Não foi possível preparar o pagamento.";

          if (respCode === "ORGANIZATION_PAYMENTS_NOT_READY") {
            if (!cancelled) {
              setIntentCycleState("FAILED");
              const missingEmail = Boolean(data?.missingEmail);
              const missingStripe = Boolean(data?.missingStripe);
              setError(
                data?.error ||
                  "Pagamentos desativados para este evento. Verifica o email oficial e liga a Stripe.",
              );
              const infoParts: string[] = [];
              if (missingEmail) {
                infoParts.push("Verifica o email oficial da organização em Definições.");
              }
              if (missingStripe) {
                infoParts.push("Liga a Stripe em Finanças & Payouts para ativares pagamentos.");
              }
              if (infoParts.length) {
                setAuthInfo(infoParts.join(" "));
              }
            }
            return;
          }

          if (respCode === "ORGANIZATION_STRIPE_NOT_CONNECTED") {
            if (!cancelled) {
              setIntentCycleState("FAILED");
              setError(
                (typeof data?.message === "string" && data.message.trim()
                  ? data.message
                  : "Pagamentos desativados para este evento enquanto o organização não ligar a Stripe."),
              );
              setAuthInfo("Liga a Stripe em Finanças & Payouts para ativares pagamentos.");
            }
            return;
          }

          const promoFail =
            payload?.promoCode &&
            typeof data?.error === "string" &&
            data.error.toLowerCase().includes("código");

          if (promoFail && !cancelled) {
            setIntentCycleState("FAILED");
            setPromoWarning("Código não aplicado. Continuas sem desconto.");
            setPromoCode("");
            setAppliedDiscount(0);
            setAppliedPromoLabel(null);
            setError(null);
            setBreakdown(null);
            return;
          }

          if (!cancelled) {
            setIntentCycleState("FAILED");
            setError(
              respCode === "PRICE_CHANGED"
                ? "Os preços mudaram. Volta ao passo anterior e revê a seleção."
                : respCode === "INSUFFICIENT_STOCK"
                  ? "Stock insuficiente. Remove itens esgotados e tenta novamente."
                  : nextAction === "PAY_NOW" && retryable
                    ? "Precisamos de novo pagamento para continuar."
                    : msg,
            );

            if (respCode === "PRICE_CHANGED" || respCode === "INSUFFICIENT_STOCK") {
              setPromoWarning(null);
              setBreakdown(null);
              setClientSecret(null);
              setServerAmount(null);
            }
          }
          return;
        }

        if (!cancelled) {
          const paymentScenarioResponse =
            typeof data?.paymentScenario === "string"
              ? data.paymentScenario
              : safeDados?.paymentScenario ?? null;
          const purchaseIdFromServer = typeof data?.purchaseId === "string" ? data.purchaseId : undefined;
          const responseIntentFingerprint =
            typeof data?.intentFingerprint === "string" ? data.intentFingerprint : null;
          const responseIdemKey =
            typeof data?.idempotencyKey === "string" && data.idempotencyKey.trim()
              ? data.idempotencyKey.trim()
              : null;

          const effectiveIntentFingerprint = responseIntentFingerprint ?? existingIntentFingerprint ?? undefined;

          // Só fazemos backfill da idempotencyKey se por algum motivo ainda não existir localmente.
          const localIdem =
            typeof (safeDados?.additional as Record<string, unknown> | undefined)?.idempotencyKey === "string" &&
            String((safeDados?.additional as Record<string, unknown>).idempotencyKey).trim()
              ? String((safeDados?.additional as Record<string, unknown>).idempotencyKey).trim()
              : null;
          const effectiveIdemKey = localIdem ?? responseIdemKey;

          const promoLabel =
            promoCode?.trim()
              ? promoCode.trim()
              : typeof data?.discountCents === "number" && data.discountCents > 0
                ? "Promo automática"
                : null;
          const isAutoAppliedPromo = !promoCode?.trim() && Boolean(promoLabel);
          const breakdownFromResponse =
            data.breakdown && typeof data.breakdown === "object"
              ? (data.breakdown as CheckoutBreakdown)
              : null;
          const discountCentsNumber =
            typeof data.discountCents === "number"
              ? data.discountCents
              : typeof breakdownFromResponse?.discountCents === "number"
                ? breakdownFromResponse.discountCents
                : 0;
          const subtotalCentsNumber =
            typeof breakdownFromResponse?.subtotalCents === "number"
              ? breakdownFromResponse.subtotalCents
              : null;
          const totalCentsNumber =
            typeof breakdownFromResponse?.totalCents === "number"
              ? breakdownFromResponse.totalCents
              : typeof data.amount === "number"
                ? data.amount
                : null;
          const currencyFromResponse =
            typeof data?.currency === "string"
              ? data.currency
              : typeof breakdownFromResponse?.currency === "string"
                ? breakdownFromResponse.currency
                : undefined;

          const statusFromResponse =
            typeof data?.status === "string" ? data.status.toUpperCase() : null;
          const paymentIntentIdFromResponse =
            typeof data?.paymentIntentId === "string" ? data.paymentIntentId : null;

          if (statusFromResponse === "FAILED") {
            setClientSecret(null);
            setServerAmount(null);
            setBreakdown(null);
            setIntentCycleState("FAILED");
            setError(typeof data?.error === "string" ? data.error : "Pagamento falhou.");
            return;
          }

          if (data.freeCheckout || data.isGratisCheckout || statusFromResponse === "PAID") {
            const totalCents = totalCentsNumber ?? 0;
            setBreakdown(breakdownFromResponse);
            setAppliedDiscount(discountCentsNumber > 0 ? discountCentsNumber / 100 : 0);
            setAppliedPromoLabel(promoLabel);
            setClientSecret(null);
            setServerAmount(0);
            atualizarDados({
              additional: {
                ...(safeDados?.additional ?? {}),
                paymentIntentId: paymentIntentIdFromResponse ?? FREE_PLACEHOLDER_INTENT_ID,
                purchaseId: purchaseIdFromServer,
                subtotalCents: subtotalCentsNumber ?? undefined,
                discountCents: discountCentsNumber ?? undefined,
                totalCents: totalCents,
                currency: currencyFromResponse ?? undefined,
                total: totalCents / 100,
                freeCheckout: true,
                clientFingerprint,
                intentFingerprint: effectiveIntentFingerprint,
                idempotencyKey: effectiveIdemKey ?? undefined,
                promoCode: payload?.promoCode,
                promoCodeRaw: payload?.promoCode,
                appliedPromoLabel: promoLabel ?? undefined,
                paymentScenario: paymentScenarioResponse ?? undefined,
              },
            });
            lastIntentKeyRef.current = intentKey;
            outcome = "READY";
            setIntentCycleState("READY");
            irParaPasso(3);
            return;
          }

          setClientSecret(data.clientSecret as string);
          setServerAmount(typeof data.amount === "number" ? data.amount : null);
          setBreakdown(breakdownFromResponse);
          setAppliedDiscount(discountCentsNumber > 0 ? discountCentsNumber / 100 : 0);
          setAppliedPromoLabel(promoLabel);
          atualizarDados({
            paymentScenario: paymentScenarioResponse ?? undefined,
            additional: {
              ...(safeDados?.additional ?? {}),
              clientFingerprint,
              intentFingerprint: effectiveIntentFingerprint,
              idempotencyKey: effectiveIdemKey ?? undefined,
              purchaseId:
                purchaseIdFromServer ??
                (safeDados?.additional as Record<string, unknown> | undefined)?.purchaseId ??
                (payload as any)?.purchaseId,
              paymentIntentId:
                paymentIntentIdFromResponse ??
                safeDados?.additional?.paymentIntentId,
              subtotalCents: subtotalCentsNumber ?? undefined,
              discountCents: discountCentsNumber ?? undefined,
              totalCents: totalCentsNumber ?? undefined,
              currency: currencyFromResponse ?? undefined,
              promoCode: payload?.promoCode,
              promoCodeRaw: payload?.promoCode,
              appliedPromoLabel: promoLabel ?? undefined,
            },
          });
          lastIntentKeyRef.current = intentKey;
          setCachedIntent({
            key: intentKey,
            clientSecret: data.clientSecret as string,
            amount: typeof data.amount === "number" ? data.amount : null,
            breakdown: breakdownFromResponse,
            discount: discountCentsNumber > 0 ? discountCentsNumber / 100 : 0,
            freeCheckout: false,
            paymentScenario: paymentScenarioResponse,
            promoLabel,
            autoAppliedPromo: isAutoAppliedPromo,
            purchaseId: purchaseIdFromServer ?? null,
          });
          outcome = "READY";
          setIntentCycleState("READY");
        }
      } catch (err) {
        console.error("Erro ao criar PaymentIntent:", err);
        if (!cancelled) {
          setIntentCycleState("FAILED");
          setError("Erro inesperado ao preparar o pagamento.");
        }
      } finally {
        if (cancelled) outcome = "CANCELLED";
        if (!cancelled) setLoading(false);
        if (cycleGuardRef.current === cycleGuardKey) {
          cycleGuardRef.current = null;
        }
        if (inFlightIntentRef.current === intentKey) {
          inFlightIntentRef.current = null;
        }
        if (process.env.NODE_ENV === "development") {
          console.debug("[Step2Pagamento.intent] end", {
            cycleGuardKey,
            outcome,
            status: lastResponseStatus,
            retries: terminalRetryCountRef.current,
          });
        }
      }
    }

    createIntent();

    return () => {
      cancelled = true;
      inFlightIntentRef.current = null;
    };
  }, [
    payload,
    irParaPasso,
    authChecked,
    userId,
    stripeConfigured,
    purchaseMode,
    guestSubmitVersion,
    cachedIntent,
    paymentMethod,
  ]);

  if (!safeDados) {
    return (
      <div className="p-6 text-sm text-white/70">
        Ocorreu um problema com os dados do checkout. Volta atrás e tenta de
        novo.
      </div>
    );
  }

  const additional =
    safeDados.additional && typeof safeDados.additional === "object"
      ? safeDados.additional
      : {};
  const totalFromContext = typeof additional.total === "number" ? additional.total : null;

  const breakdownTotal =
    breakdown && typeof breakdown.totalCents === "number" ? breakdown.totalCents / 100 : null;

  const total =
    breakdownTotal !== null
      ? breakdownTotal
      : totalFromContext !== null
        ? totalFromContext
        : serverAmount !== null
          ? serverAmount / 100
          : null;
  const cardFeeBps = breakdown?.cardPlatformFeeBps ?? 100;
  const cardFeePercentLabel = Number.isFinite(cardFeeBps)
    ? `${(cardFeeBps / 100).toFixed(cardFeeBps % 100 === 0 ? 0 : 2)}%`
    : "1%";

  const handlePaymentElementError = () => {
    // Evita loop infinito: só tentamos regenerar 1x automaticamente
    if (loadErrorCountRef.current >= 1) return;
    loadErrorCountRef.current += 1;

    setError("Sessão de pagamento expirou. Vamos criar um novo intento.");
    setIntentCycleState("PREPARING");
    setLoading(true);

    setCachedIntent(null);
    setClientSecret(null);
    setServerAmount(null);
    setBreakdown(null);
    lastIntentKeyRef.current = null;
    inFlightIntentRef.current = null;
    intentRetryTokenRef.current += 1;
    setGuestSubmitVersion((v) => v + 1);

    const fingerprintFromState =
      typeof (safeDados?.additional as Record<string, unknown> | undefined)?.clientFingerprint === "string"
        ? String((safeDados?.additional as Record<string, unknown>).clientFingerprint)
        : null;
    const nextIdemKey = buildDeterministicIdemKey(
      fingerprintFromState
        ? `${fingerprintFromState}:element-recovery:${loadErrorCountRef.current}`
        : `element-recovery:${loadErrorCountRef.current}`,
    );

    atualizarDados({
      additional: {
        ...(safeDados?.additional ?? {}),
        purchaseId: null,
        paymentIntentId: undefined,
        freeCheckout: undefined,
        appliedPromoLabel: safeDados?.additional?.appliedPromoLabel,
        intentFingerprint: undefined,
        idempotencyKey: nextIdemKey ?? undefined,
      },
    });
  };

// Callback chamado pelo AuthWall quando o utilizador faz login/cria conta com sucesso
  const handleAuthenticated = async (newUserId: string) => {
    setUserId(newUserId);
    setAuthChecked(true);
    setAuthChecking(false);
    setPurchaseMode("auth");

    // Tentar migrar bilhetes de guest para este user (best-effort)
    // Claim guest será enfileirado depois da compra via /api/me/claim-guest
  };

  // Callback para continuar como convidado
  const handleGuestContinue = () => {
    if (requiresAuth) {
      setIntentCycleState("FAILED");
      setError("Este tipo de checkout requer sessão iniciada.");
      setPurchaseMode("auth");
      setAuthInfo("Inicia sessão para continuar.");
      return;
    }
    setIntentCycleState("IDLE");
    setError(null);
    setGuestAttemptVersion((v) => v + 1);
    const validation = validateGuestDetails(
      {
        name: guestName,
        email: guestEmail,
        emailConfirm: guestEmailConfirm,
        phone: guestPhone,
      },
      {
        nameRequired: `Nome é obrigatório para emitir ${ticketCopy.articleSingular} ${ticketCopy.singular}.`,
        emailRequired: `Email é obrigatório para enviar ${ticketPluralWithArticle}.`,
        emailInvalid: "Email inválido. Confirma o formato (ex: nome@dominio.com).",
        emailMismatch: "Email e confirmação não coincidem.",
        phoneInvalid: "Telemóvel inválido. Usa apenas dígitos e opcional + no início.",
      },
      {
        phoneLocale: typeof navigator !== "undefined" ? navigator.language : null,
      },
    );
    const nextErrors = {
      ...validation.errors,
      ...(guestConsent ? {} : { consent: "Precisas de aceitar a política de privacidade." }),
    };
    setGuestErrors(nextErrors);

    if (validation.hasErrors || !guestConsent) {
      setIntentCycleState("FAILED");
      setError("Revê os dados e o consentimento para continuar como convidado.");
      return;
    }
    setGuestPhone(validation.normalized.phone ?? "");

    atualizarDados({
      additional: {
        ...(safeDados?.additional ?? {}),
        guestName: validation.normalized.name,
        guestEmail: validation.normalized.email,
        guestEmailConfirm: guestEmailConfirm.trim(),
        guestPhone: validation.normalized.phone,
        guestConsent: guestConsent,
        // Reset de estado para evitar reutilização de intents/purchase antigos
        purchaseId: null,
        paymentIntentId: undefined,
        freeCheckout: undefined,
        appliedPromoLabel: undefined,
        clientFingerprint: undefined,
        intentFingerprint: undefined,
        idempotencyKey: undefined,
      },
    });

    setPurchaseMode("guest");
    setClientSecret(null);
    setServerAmount(null);
    intentRetryTokenRef.current = 0;
    setGuestSubmitVersion((v) => v + 1);
  };

  const showPaymentUI =
    (!authChecking && Boolean(userId)) ||
    (!isGratisScenario && purchaseMode === "guest" && guestSubmitVersion > 0);

  const handleRemovePromo = () => {
    setPromoCode("");
    setPromoInput("");
    setAppliedDiscount(0);
    setAppliedPromoLabel(null);
    setPromoWarning(null);
    setError(null);
    setBreakdown(null);
    setClientSecret(null);
    setServerAmount(null);
    setIntentCycleState("IDLE");
    intentRetryTokenRef.current = 0;
    setGuestSubmitVersion((v) => v + 1);

    try {
      atualizarDados({
        additional: {
          ...(safeDados?.additional ?? {}),
          purchaseId: null,
          paymentIntentId: undefined,
          freeCheckout: undefined,
          appliedPromoLabel: undefined,
          clientFingerprint: undefined,
          intentFingerprint: undefined,
          idempotencyKey: undefined,
        },
      });
    } catch {}

    lastIntentKeyRef.current = null;
    inFlightIntentRef.current = null;
  };

  const shouldShowAuthGate =
    requiresAuth && (scenario === "FREE_CHECKOUT" || scenario === "GROUP_SPLIT");
  const authGateTitle =
    scenario === "FREE_CHECKOUT"
      ? "Entrada gratuita exige conta"
      : "Pagamento em dupla exige conta";
  const authGateDescription =
    scenario === "FREE_CHECKOUT"
      ? "Para confirmares a entrada gratuita precisas de sessão iniciada e username definido."
      : "Para pagar a tua parte da dupla tens de iniciar sessão na ORYA.";
  const authRequiredTitle = shouldShowAuthGate ? authGateTitle : "Este checkout exige conta";
  const authRequiredDescription = shouldShowAuthGate
    ? authGateDescription
    : "Inicia sessão para continuar.";

  return (
    <div className="flex flex-col gap-6 text-white" data-intent-state={intentCycleState}>
      <Step2Header
        isGratisScenario={isGratisScenario}
        freeHeaderLabel={freeHeaderLabel}
        freeDescription={freeDescription}
        scenario={scenario}
        scenarioCopy={scenarioCopy}
      />

      {authChecking && (
        <AuthRequiredCard
          title="A verificar sessão…"
          description="Estamos a confirmar se já tens sessão iniciada na ORYA."
          loading
        />
      )}

      {!authChecking && showPaymentUI ? (
        <Step2PaymentPanel
          needsStripe={needsStripe}
          isGratisScenario={isGratisScenario}
          appliedPromoLabel={appliedPromoLabel}
          appliedDiscount={appliedDiscount}
          promoInput={promoInput}
          promoWarning={promoWarning}
          paymentMethod={paymentMethod}
          cardFeePercentLabel={cardFeePercentLabel}
          loading={loading}
          error={error}
          clientSecret={clientSecret}
          total={total}
          breakdown={breakdown ?? null}
          freeHeaderLabel={freeHeaderLabel}
          freeDescription={freeDescription}
          freePrepLabel={freePrepLabel}
          freeConfirmLabel={freeConfirmLabel}
          onPromoInputChange={setPromoInput}
          onApplyPromo={() => {
            setPromoWarning(null);
            setError(null);
            if (!promoInput.trim()) {
              setPromoWarning("Escreve um código antes de aplicar.");
              return;
            }
            try {
              atualizarDados({
                additional: {
                  ...(safeDados?.additional ?? {}),
                  purchaseId: null,
                  paymentIntentId: undefined,
                  freeCheckout: undefined,
                  appliedPromoLabel: undefined,
                  intentFingerprint: undefined,
                  idempotencyKey: undefined,
                },
              });
            } catch {}
            setCachedIntent(null);
            setClientSecret(null);
            setServerAmount(null);
            setBreakdown(null);
            setIntentCycleState("IDLE");
            intentRetryTokenRef.current = 0;
            lastIntentKeyRef.current = null;
            inFlightIntentRef.current = null;
            setPromoCode(promoInput.trim());
            setGuestSubmitVersion((v) => v + 1);
          }}
          onRemovePromo={handleRemovePromo}
          onSelectPaymentMethod={handleSelectPaymentMethod}
          onPaymentElementError={handlePaymentElementError}
          onFreeConfirm={() => irParaPasso(3)}
        />
      ) : null}

      {/* 🔐/🎟️ Se não está logado e ainda não avançou como convidado */}
      {!authChecking && !userId && !showPaymentUI && (
        <Step2AccessGate
          authInfo={authInfo}
          error={error}
          shouldShowAuthGate={shouldShowAuthGate}
          authGateTitle={authGateTitle}
          authGateDescription={authGateDescription}
          requiresAuth={requiresAuth}
          purchaseMode={purchaseMode}
          onSelectMode={(mode) => {
            setPurchaseMode(mode);
            if (mode === "auth") {
              setClientSecret(null);
              setServerAmount(null);
            }
          }}
          onAuthenticated={handleAuthenticated}
          onGuestContinue={handleGuestContinue}
          guestName={guestName}
          guestEmail={guestEmail}
          guestEmailConfirm={guestEmailConfirm}
          guestPhone={guestPhone}
          guestConsent={guestConsent}
          guestErrors={guestErrors}
          submitAttempt={guestAttemptVersion}
          onChangeName={setGuestName}
          onChangeEmail={setGuestEmail}
          onChangeEmailConfirm={setGuestEmailConfirm}
          onChangePhone={setGuestPhone}
          onChangeConsent={setGuestConsent}
          ticketNameLabel={ticketNameLabel}
          ticketEmailLabel={ticketEmailLabel}
          ticketPluralWithArticle={ticketPluralWithArticle}
          ticketAllPlural={ticketAllPlural}
          authRequiredTitle={authRequiredTitle}
          authRequiredDescription={authRequiredDescription}
        />
      )}
    </div>
  );
}
