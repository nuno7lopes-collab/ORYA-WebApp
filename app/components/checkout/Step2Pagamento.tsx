"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  loadStripe,
  type Appearance,
  type StripeElementsOptions,
} from "@stripe/stripe-js";
import { type CheckoutBreakdown, useCheckout } from "./contextoCheckout";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { sanitizeRedirectPath } from "@/lib/auth/redirects";
import { isValidPhone, sanitizePhone } from "@/lib/phone";
import { sanitizeUsername, validateUsername } from "@/lib/username";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";

function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function formatMoney(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function buildClientFingerprint(input: unknown) {
  try {
    return JSON.stringify(input);
  } catch {
    // Fallback muito raro (ex.: objeto circular) — usamos um valor que força refresh.
    return `fp_${Date.now()}`;
  }
}

async function checkUsernameAvailabilityRemote(
  value: string,
  onError: (message: string) => void
) {
  const cleaned = sanitizeUsername(value);
  const validation = validateUsername(cleaned);
  if (!validation.valid) {
    onError(validation.error);
    return { ok: false, username: cleaned };
  }
  try {
    const res = await fetch(`/api/username/check?username=${encodeURIComponent(cleaned)}`);
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.available === false) {
      onError("Esse @ já está a ser usado.");
      return { ok: false, username: cleaned };
    }
    return { ok: true, username: validation.normalized };
  } catch (err) {
    console.error("[Step2Pagamento] erro a verificar username", err);
    onError("Não foi possível verificar o username. Tenta novamente.");
    return { ok: false, username: cleaned };
  }
}

type CheckoutItem = {
  ticketId: number;
  quantity: number;
};
const scenarioCopy: Record<string, string> = {
  GROUP_SPLIT: "Estás a pagar apenas a tua parte desta dupla.",
  GROUP_FULL: "Estás a comprar 2 lugares (tu + parceiro).",
  RESALE: "Estás a comprar um bilhete em revenda.",
  FREE_CHECKOUT: "Evento gratuito — só para utilizadores com conta e username.",
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
};

const FREE_PLACEHOLDER_INTENT_ID = "FREE_CHECKOUT";

export default function Step2Pagamento() {
  const { dados, irParaPasso, atualizarDados, breakdown, setBreakdown } = useCheckout();

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
  const [guestErrors, setGuestErrors] = useState<{ name?: string; email?: string; phone?: string }>({});
  const persistedIdemKeyRef = useRef<string | null>(null);

  // 👤 Guest form state
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestEmailConfirm, setGuestEmailConfirm] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestSubmitVersion, setGuestSubmitVersion] = useState(0);
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [promoWarning, setPromoWarning] = useState<string | null>(null);
  const [appliedPromoLabel, setAppliedPromoLabel] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"mbway" | "card">("mbway");
  const lastIntentKeyRef = useRef<string | null>(null);
  const inFlightIntentRef = useRef<string | null>(null);
  const ensuredIdemKeyRef = useRef(false);
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
  const isFreeScenario = scenario === "FREE_CHECKOUT";
  const needsStripe = !isFreeScenario;
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
    isFreeScenario ||
    scenario === "GROUP_SPLIT";

  useEffect(() => {
    if (!safeDados) return;
    if (ensuredIdemKeyRef.current) return;

    const additional =
      safeDados.additional && typeof safeDados.additional === "object"
        ? (safeDados.additional as Record<string, unknown>)
        : {};

    const existing =
      typeof additional.idempotencyKey === "string" && additional.idempotencyKey.trim()
        ? additional.idempotencyKey.trim()
        : null;

    if (!existing) {
      ensuredIdemKeyRef.current = true;
      try {
        atualizarDados({
          additional: {
            ...(safeDados?.additional ?? {}),
            idempotencyKey: crypto.randomUUID(),
          },
        });
      } catch {
        // Se por algum motivo falhar (ambiente sem crypto), não bloqueamos o checkout
      }
      return;
    }

    ensuredIdemKeyRef.current = true;
  }, [safeDados, atualizarDados]);

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


  const stripePromise = useMemo(() => {
    // FREE_CHECKOUT não precisa de Stripe no cliente.
    if (!needsStripe) return null;
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) return null;
    return loadStripe(key);
  }, [needsStripe]);

  useEffect(() => {
    if (needsStripe && !stripePromise) {
      setError("Configuração de pagamentos indisponível. Tenta novamente mais tarde.");
      setLoading(false);
    }
  }, [stripePromise, needsStripe]);

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

    // IdempotencyKey estável: reutiliza a existente; se não houver, gera apenas uma vez
    let idemKey: string | undefined =
      (safeDados?.additional as Record<string, unknown> | undefined)?.idempotencyKey as string | undefined;
    if (!idemKey || !idemKey.trim()) {
      if (!persistedIdemKeyRef.current) {
        try {
          persistedIdemKeyRef.current = crypto.randomUUID();
        } catch {
          persistedIdemKeyRef.current = `idem-${Date.now()}`;
        }
      }
      idemKey = persistedIdemKeyRef.current ?? undefined;
    } else {
      persistedIdemKeyRef.current = idemKey;
    }
    const purchaseId = undefined;

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
      eventId: safeDados.eventId ? Number(safeDados.eventId) : undefined,
      inviteToken: typeof inviteToken === "string" && inviteToken.trim() ? inviteToken.trim() : undefined,
    };
  }, [safeDados, promoCode, requiresAuth, paymentMethod, pairingId, pairingSlotId, pairingTicketTypeId, inviteToken]);

  // Garante idempotencyKey persistida no contexto para estabilizar intentKey e evitar re-renders infinitos
  useEffect(() => {
    if (!safeDados) return;
    const additionalObj =
      safeDados.additional && typeof safeDados.additional === "object"
        ? (safeDados.additional as Record<string, unknown>)
        : {};
    const existing =
      typeof additionalObj.idempotencyKey === "string" && additionalObj.idempotencyKey.trim()
        ? additionalObj.idempotencyKey.trim()
        : null;

    if (existing) {
      persistedIdemKeyRef.current = existing;
      return;
    }

    let newKey = persistedIdemKeyRef.current;
    if (!newKey) {
      try {
        newKey = crypto.randomUUID();
      } catch {
        newKey = `idem-${Date.now()}`;
      }
      persistedIdemKeyRef.current = newKey;
    }

    atualizarDados({
      additional: {
        ...(safeDados.additional as Record<string, unknown> | undefined),
        idempotencyKey: newKey,
      },
    });
  }, [safeDados, atualizarDados]);

  useEffect(() => {
    // Se não houver dados de checkout, mandamos de volta
    if (!payload) {
      irParaPasso(1);
      return;
    }

    if (needsStripe && !stripePromise) return;
    // Enquanto não sabemos se está logado, não fazemos nada
    if (!authChecked) return;

    const isGuestFlow = purchaseMode === "guest";
    const hasGuestSubmission = guestSubmitVersion > 0;
    const guestNameClean = guestName.trim();
    const guestEmailClean = guestEmail.trim();
    const guestPhoneClean = guestPhone.trim();
    const guestReady =
      isGuestFlow && hasGuestSubmission && guestNameClean !== "" && guestEmailClean !== "";

    // Se não está logado e ainda não escolheu convidado, mostramos UI e não chamamos a API
    if (!userId && !guestReady) {
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

    const currentIdempotencyKey =
      (safeDados?.additional as Record<string, unknown> | undefined)?.idempotencyKey ??
      (payload as any)?.idempotencyKey ??
      null;

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

      let nextIdemKey: string | undefined;
      try {
        nextIdemKey = crypto.randomUUID();
      } catch {
        nextIdemKey = undefined;
      }

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
          idempotencyKey: nextIdemKey ?? (additionalObj as any).idempotencyKey,
        },
      });

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
      setLoading(false);
      return;
    }

    // Evita requests paralelos com o mesmo payload; se detectarmos que estamos presos
    // (ex.: Strict Mode cancela a primeira run e deixa loading a true), limpamos o ref
    // para voltar a tentar.
    if (inFlightIntentRef.current === intentKey) {
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
      try {
        inFlightIntentRef.current = intentKey;
        setLoading(true);
        setError(null);
        setBreakdown(null);

        console.log(
          "[Step2Pagamento] A enviar payload para /api/payments/intent:",
          payload,
        );

        const idem =
          (safeDados?.additional as Record<string, unknown> | undefined)?.idempotencyKey ??
          (payload as any)?.idempotencyKey ??
          null;

        let attempt = 0;
        // Não enviamos purchaseId; o backend calcula anchors determinísticas. idempotencyKey segue para evitar PI terminal.
        let currentPayload = { ...payload };
        delete (currentPayload as any).purchaseId;
        let currentIntentFingerprint = undefined;
        let res: Response | null = null;
        let data: any = null;

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
              idempotencyKey: idem,
              intentFingerprint: currentIntentFingerprint ?? undefined,
            }),
          });

          data = await res.json().catch(() => null);

          if (res.status === 409) {
            attempt += 1;
            // Reset total: limpar caches e fazer um retry sem anchors próprias.
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
                    idempotencyKey: undefined,
                  },
                });
              } catch {}
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
            setLoading(false);
          }
          return;
        }

        if (!data || typeof data !== "object") {
          if (!cancelled) {
            setBreakdown(null);
            setError("Resposta inválida do servidor. Tenta novamente.");
          }
          return;
        }
        console.log("[Step2Pagamento] Resposta de /api/payments/intent:", {
          status: res.status,
          ok: res.ok,
          data,
        });

        const respCode = typeof data?.code === "string" ? data.code : null;

        // 409 ➜ idempotencyKey reutilizada com payload diferente (proteção contra intents errados/duplicados)
        if (res.status === 409) {
          if (!cancelled) {
            // Reset total para forçar recalcular (idempotencyKey + purchaseId + PI state)
            setCachedIntent(null);
            setClientSecret(null);
            setServerAmount(null);
            setBreakdown(null);
            lastIntentKeyRef.current = null;
            inFlightIntentRef.current = null;

            let nextIdemKey: string | undefined;
            try {
              nextIdemKey = crypto.randomUUID();
            } catch {
              nextIdemKey = undefined;
            }

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
                  idempotencyKey: nextIdemKey,
                },
              });
            } catch {}

            // Força novo ciclo de preparação (especialmente útil em guest flow)
            setGuestSubmitVersion((v) => v + 1);
            setPromoWarning(
              typeof (data as any)?.error === "string"
                ? (data as any).error
                : "O teu checkout mudou e estamos a recalcular o pagamento…",
            );
            setError(null);
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
              setPurchaseMode("auth");
              setGuestSubmitVersion(0);
              setGuestErrors({});
              setError(null);
              const freeCopy =
                respCode === "AUTH_REQUIRED_FOR_GROUP_SPLIT"
                  ? "Para pagar apenas a tua parte tens de iniciar sessão."
                  : isFreeScenario
                    ? "Checkouts gratuitos exigem conta com username. Cria conta ou entra para continuar."
                    : "Este tipo de checkout requer sessão iniciada.";
              setAuthInfo(freeCopy);
            }
            return;
          }

          // Guest permitido, mas algo correu mal (ex.: backend rejeitou por sessão)
          if (!cancelled) {
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
              // Limita a 1 retentativa local para evitar loops de 409
              if (idempotencyMismatchCountRef.current >= 1) {
                setError(
                  typeof data?.error === "string"
                    ? data.error
                    : "O checkout mudou noutro separador. Volta ao passo anterior ou recarrega a página e tenta de novo.",
                );
                setLoading(false);
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
              setError("Este evento gratuito requer sessão com username definido.");
              setPurchaseMode("auth");
              setAuthInfo(
                "Inicia sessão e define um username para concluir a inscrição gratuita.",
              );
            }
            return;
          }

          if (respCode === "INVITE_REQUIRED") {
            if (!cancelled) {
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
                ? "Stock insuficiente para um dos bilhetes."
                : typeof data?.error === "string"
                  ? data.error
                  : "Não foi possível preparar o pagamento.";

          if (respCode === "ORGANIZATION_PAYMENTS_NOT_READY") {
            if (!cancelled) {
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
              setError(
                data?.message ||
                  "Pagamentos desativados para este evento enquanto o organização não ligar a Stripe.",
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
            setPromoWarning("Código não aplicado. Continuas sem desconto.");
            setPromoCode("");
            setAppliedDiscount(0);
            setAppliedPromoLabel(null);
            setError(null);
            setBreakdown(null);
            return;
          }

          if (!cancelled) {
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
              : data.discountCents && data.discountCents > 0
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
            setError(typeof data?.error === "string" ? data.error : "Pagamento falhou.");
            return;
          }

          if (data.freeCheckout || data.isFreeCheckout || statusFromResponse === "PAID") {
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
        }
      } catch (err) {
        console.error("Erro ao criar PaymentIntent:", err);
        if (!cancelled) {
          setError("Erro inesperado ao preparar o pagamento.");
        }
      } finally {
        if (!cancelled) setLoading(false);
        if (inFlightIntentRef.current === intentKey) {
          inFlightIntentRef.current = null;
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
    stripePromise,
    purchaseMode,
    guestSubmitVersion,
    cachedIntent,
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

  const appearance: Appearance = {
    theme: "night",
    variables: {
      colorPrimary: "#6BFFFF",
      colorBackground: "#0B0F18",
      colorText: "#F7F9FF",
      colorDanger: "#FF5C7A",
      fontFamily:
        "SF Pro Text, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      borderRadius: "14px",
    },
    rules: {
      ".Input": {
        padding: "14px",
        backgroundColor: "rgba(12,16,26,0.75)",
        border: "1px solid rgba(255,255,255,0.12)",
      },
      ".Label": {
        color: "rgba(255,255,255,0.7)",
      },
      ".Tab": {
        backgroundColor: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
      },
      ".Tab--selected": {
        backgroundColor: "rgba(107,255,255,0.12)",
        border: "1px solid rgba(107,255,255,0.45)",
      },
    },
  };

  const options: StripeElementsOptions | undefined = clientSecret
    ? {
        clientSecret,
        appearance,
        // Nota: a lista de métodos permitidos é definida no PaymentIntent (backend).
      }
    : undefined;

  const handlePaymentElementError = () => {
    // Evita loop infinito: só tentamos regenerar 1x automaticamente
    if (loadErrorCountRef.current >= 1) return;
    loadErrorCountRef.current += 1;

    setError("Sessão de pagamento expirou. Vamos criar um novo intento.");
    setLoading(true);

    setCachedIntent(null);
    setClientSecret(null);
    setServerAmount(null);
    setBreakdown(null);
    lastIntentKeyRef.current = null;
    inFlightIntentRef.current = null;
    setGuestSubmitVersion((v) => v + 1);

    let nextIdemKey: string | undefined;
    try {
      nextIdemKey = crypto.randomUUID();
    } catch {
      nextIdemKey = undefined;
    }

    atualizarDados({
      additional: {
        ...(safeDados?.additional ?? {}),
        purchaseId: null,
        paymentIntentId: undefined,
        freeCheckout: undefined,
        appliedPromoLabel: safeDados?.additional?.appliedPromoLabel,
        intentFingerprint: undefined,
        idempotencyKey: nextIdemKey ?? (safeDados?.additional as any)?.idempotencyKey,
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
      setError("Este tipo de checkout requer sessão iniciada.");
      setPurchaseMode("auth");
      setAuthInfo("Inicia sessão para continuar.");
      return;
    }
    setError(null);
    const localErrors: { name?: string; email?: string; phone?: string } = {};
    if (!guestName.trim()) {
      localErrors.name = "Nome é obrigatório para emitir o bilhete.";
    }
    if (!guestEmail.trim()) {
      localErrors.email = "Email é obrigatório para enviar os bilhetes.";
    } else if (!isValidEmail(guestEmail.trim())) {
      localErrors.email = "Email inválido. Confirma o formato (ex: nome@dominio.com).";
    } else if (guestEmailConfirm.trim() && guestEmailConfirm.trim() !== guestEmail.trim()) {
      localErrors.email = "Email e confirmação não coincidem.";
    }

    const phoneNormalized = sanitizePhone(guestPhone);
    if (phoneNormalized) {
      if (!isValidPhone(phoneNormalized)) {
        localErrors.phone = "Telemóvel inválido. Usa apenas dígitos e opcional + no início.";
      }
    }
    setGuestErrors(localErrors);

    if (localErrors.name || localErrors.email || localErrors.phone) {
      setError("Revê os dados para continuar como convidado.");
      return;
    }

    atualizarDados({
      additional: {
        ...(safeDados?.additional ?? {}),
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestEmailConfirm: guestEmailConfirm.trim(),
        guestPhone: phoneNormalized || undefined,
        // Reset de estado para evitar reutilização de intents/purchase antigos
        purchaseId: null,
        paymentIntentId: undefined,
        freeCheckout: undefined,
        appliedPromoLabel: undefined,
        clientFingerprint: undefined,
        intentFingerprint: undefined,
        idempotencyKey: crypto.randomUUID(),
      },
    });

    setPurchaseMode("guest");
    setClientSecret(null);
    setServerAmount(null);
    setGuestSubmitVersion((v) => v + 1);
  };

  const showPaymentUI =
    (!authChecking && Boolean(userId)) ||
    (!isFreeScenario && purchaseMode === "guest" && guestSubmitVersion > 0);

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
          idempotencyKey: crypto.randomUUID(),
        },
      });
    } catch {}

    lastIntentKeyRef.current = null;
    inFlightIntentRef.current = null;
  };

  return (
    <div className="flex flex-col gap-6 text-white">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">
            Passo 2 de 3
          </p>
          <h2 className="text-2xl font-semibold leading-tight">
            {isFreeScenario ? "Inscrição gratuita" : "Pagamento"}
          </h2>
          <p className="text-[11px] text-white/60 max-w-xs">
            {isFreeScenario
              ? "Confirma a tua inscrição. Requer sessão iniciada e username definido."
              : "Pagamento seguro processado pela Stripe."}
          </p>
          {scenario && scenarioCopy[scenario] && (
            <p className="text-[11px] text-white/75 max-w-sm">{scenarioCopy[scenario]}</p>
          )}
        </div>
      </header>

      <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden shadow-[0_6px_20px_rgba(0,0,0,0.35)]">
        <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] animate-pulse" />
      </div>

      {/* 🔐 Se ainda estamos a verificar auth */}
      {authChecking && (
        <div className="flex-1 rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-12 flex flex-col justify-center items-center text-center shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="relative mb-6">
            <div className="h-14 w-14 rounded-full border-2 border-white/20 border-t-transparent animate-spin" />
            <div className="absolute inset-0 h-14 w-14 animate-pulse rounded-full border border-[#6BFFFF]/20" />
          </div>
          <h3 className="text-sm font-semibold mb-1 animate-pulse">
            A verificar sessão…
          </h3>
          <p className="text-[11px] text-white/65 max-w-xs leading-relaxed">
            Estamos a confirmar se já tens sessão iniciada na ORYA.
          </p>
        </div>
      )}

      {/* 💳 UI de pagamento (user logado OU convidado depois de validar form) */}
      {!authChecking && showPaymentUI ? (
        <>
          {error || (needsStripe && !stripePromise) ? (
            <div className="flex-1 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-6 text-sm text-red-100 shadow-[0_0_30px_rgba(255,0,0,0.35)]">
              <p className="font-semibold mb-1 flex items-center gap-2">
                <span className="text-lg">⚠️</span> Ocorreu um problema
              </p>
              <p className="text-[12px] mb-4 leading-relaxed">
                {error ?? "Configuração de pagamentos indisponível. Tenta novamente mais tarde."}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full bg-white text-red-700 px-5 py-1.5 text-[11px] font-semibold shadow hover:bg-white/90 transition"
              >
                Tentar novamente
              </button>
            </div>
          ) : loading || (needsStripe && (!clientSecret || !options)) ? (
            <div className="flex-1 rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-12 flex flex-col justify-center items-center text-center shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <div className="relative mb-6">
                <div className="h-14 w-14 rounded-full border-2 border-white/20 border-t-transparent animate-spin" />
                <div className="absolute inset-0 h-14 w-14 animate-pulse rounded-full border border-[#6BFFFF]/20" />
              </div>
              <h3 className="text-sm font-semibold mb-1 animate-pulse">
                {isFreeScenario ? "A preparar a tua inscrição…" : "A preparar o teu pagamento…"}
              </h3>
              <p className="text-[11px] text-white/65 max-w-xs leading-relaxed">
                {isFreeScenario
                  ? "Estamos a confirmar a tua inscrição gratuita."
                  : "Estamos a ligar-te à Stripe para criar uma transação segura."}
              </p>
            </div>
          ) : error ? (
            <div className="flex-1 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-6 text-sm text-red-100 shadow-[0_0_30px_rgba(255,0,0,0.35)]">
              <p className="font-semibold mb-1 flex items-center gap-2">
                <span className="text-lg">⚠️</span> Ocorreu um problema
              </p>
              <p className="text-[12px] mb-4 leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full bg-white text-red-700 px-5 py-1.5 text-[11px] font-semibold shadow hover:bg-white/90 transition"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <div className="flex-1 rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-6 shadow-[0_0_60px_rgba(0,0,0,0.6)] backdrop-blur-xl space-y-4">
              {promoWarning && (
                <div className="rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                  {promoWarning}
                </div>
              )}
              {appliedPromoLabel === "Promo automática" && appliedDiscount > 0 && (
                <div className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                  Desconto aplicado automaticamente 🎉
                </div>
              )}
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-2">
                <label className="text-xs text-white/70">Tens um código promocional?</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    placeholder="Insere o código"
                    className="flex-1 rounded-xl bg-white/[0.05] border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPromoWarning(null);
                      setError(null);
                      if (!promoInput.trim()) {
                        setPromoWarning("Escreve um código antes de aplicar.");
                        return;
                      }
                      // Promo altera o cálculo: limpamos purchase/payment state para obrigar a recalcular intent.
                      try {
                    atualizarDados({
                      additional: {
                        ...(safeDados?.additional ?? {}),
                        purchaseId: null,
                        paymentIntentId: undefined,
                        freeCheckout: undefined,
                        appliedPromoLabel: undefined,
                        intentFingerprint: crypto.randomUUID(),
                        idempotencyKey: crypto.randomUUID(),
                      },
                    });
                      } catch {}
                      setCachedIntent(null);
                      setClientSecret(null);
                      setServerAmount(null);
                      setBreakdown(null);
                      lastIntentKeyRef.current = null;
                      inFlightIntentRef.current = null;
                      setPromoCode(promoInput.trim());
                      setGuestSubmitVersion((v) => v + 1);
                    }}
                    className="px-4 py-2 rounded-full bg-white text-black text-sm font-semibold shadow hover:scale-[1.01] active:scale-[0.99] transition"
                  >
                    Aplicar
                  </button>
                </div>
                {appliedDiscount > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                    <span>
                      {appliedPromoLabel
                        ? `Desconto ${appliedPromoLabel}: -${appliedDiscount.toFixed(2)} €`
                        : `Desconto aplicado: -${appliedDiscount.toFixed(2)} €`}
                    </span>
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className="rounded-full border border-emerald-300/40 px-2 py-0.5 text-[11px] text-emerald-50 hover:bg-emerald-500/20"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>
              {!isFreeScenario && (
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
                      onClick={() => handleSelectPaymentMethod("mbway")}
                      className={`flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition ${
                        paymentMethod === "mbway"
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
                      onClick={() => handleSelectPaymentMethod("card")}
                      className={`flex flex-col items-start gap-1 rounded-2xl border px-4 py-3 text-left transition ${
                        paymentMethod === "card"
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
              )}
              <Elements stripe={stripePromise} options={options}>
                <PaymentForm
                  total={total}
                  discount={appliedDiscount}
                  breakdown={breakdown ?? undefined}
                  clientSecret={clientSecret}
                  onLoadError={handlePaymentElementError}
                />
              </Elements>
            </div>
          )}
        </>
      ) : null}

      {/* 🔐/🎟️ Se não está logado e ainda não avançou como convidado */}
      {!authChecking && !userId && !showPaymentUI && (
        <div className="space-y-3">
          {authInfo && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-[11px] text-amber-50">
              {authInfo}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/15 px-3 py-2 text-[11px] text-red-50">
              {error}
            </div>
          )}
          {!requiresAuth && (
            <div className="flex items-center gap-2 text-[11px] bg-white/10 rounded-full p-1 border border-white/15 w-fit backdrop-blur">
              <button
                type="button"
                onClick={() => setPurchaseMode("guest")}
                className={`px-3 py-1 rounded-full ${
                  purchaseMode === "guest"
                    ? "bg-white text-black font-semibold"
                    : "text-white/70"
                }`}
              >
                Comprar como convidado
              </button>
              <button
                type="button"
                onClick={() => {
                  setPurchaseMode("auth");
                  setClientSecret(null);
                  setServerAmount(null);
                }}
                className={`px-3 py-1 rounded-full ${
                  purchaseMode === "auth"
                    ? "bg-white text-black font-semibold"
                    : "text-white/70"
                }`}
              >
                Entrar / Criar conta
              </button>
            </div>
          )}

          {requiresAuth ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-50">
                Este checkout exige conta. Para eventos gratuitos precisas de iniciar sessão e ter um username definido.
              </div>
              <AuthWall onAuthenticated={handleAuthenticated} />
            </div>
          ) : purchaseMode === "guest" ? (
            <GuestCheckoutCard
              guestName={guestName}
              guestEmail={guestEmail}
              guestEmailConfirm={guestEmailConfirm}
              guestPhone={guestPhone}
              guestErrors={guestErrors}
              onChangeName={setGuestName}
              onChangeEmail={setGuestEmail}
              onChangeEmailConfirm={setGuestEmailConfirm}
              onChangePhone={setGuestPhone}
              onContinue={handleGuestContinue}
            />
          ) : (
            <AuthWall onAuthenticated={handleAuthenticated} />
          )}
        </div>
      )}
    </div>
  );
}

type PaymentFormProps = {
  total: number | null;
  discount?: number;
  breakdown?: CheckoutBreakdown;
  clientSecret: string | null;
  onLoadError?: () => void;
};

function PaymentForm({ total, discount = 0, breakdown, clientSecret, onLoadError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { irParaPasso, atualizarDados, dados } = useCheckout();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elementReady, setElementReady] = useState(false);
  const currency = breakdown?.currency ?? "EUR";
  const discountCents = Math.max(0, Math.round(discount * 100));
  const promoApplied = discountCents > 0;
  const cardPlatformFeeCents = breakdown?.cardPlatformFeeCents ?? 0;
  const baseCents = breakdown
    ? Math.max(0, (breakdown.subtotalCents ?? 0) - (breakdown.discountCents ?? 0))
    : total
      ? Math.round(total * 100)
      : 0;

  useEffect(() => {
    // sempre que o clientSecret muda, obrigamos o PaymentElement a fazer ready novamente
    setElementReady(false);
  }, [clientSecret]);

  // Proteção: se o PaymentIntent já estiver terminal (succeeded/canceled), força regenerar.
  useEffect(() => {
    if (!stripe || !clientSecret) return;
    let cancelled = false;
    (async () => {
      try {
        const pi = await stripe.retrievePaymentIntent(clientSecret);
        if (cancelled) return;
        const status = pi.paymentIntent?.status;
        if (status && !["requires_payment_method", "requires_action", "requires_confirmation"].includes(status)) {
          setError("Sessão de pagamento expirou. Vamos criar um novo intento.");
          if (onLoadError) onLoadError();
        }
      } catch (err) {
        if (cancelled) return;
        setError("Falha ao validar estado do pagamento. Tenta novamente.");
        if (onLoadError) onLoadError();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stripe, clientSecret, onLoadError]);

  // Se o utilizador for redirecionado pela Stripe (ex.: 3DS), o URL volta com
  // `payment_intent_client_secret` e `redirect_status`. Aqui recuperamos o PI
  // e avançamos automaticamente para o passo 3 quando o pagamento fica concluído.
  useEffect(() => {
    if (!stripe) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const clientSecretFromUrl = params.get("payment_intent_client_secret");

    if (!clientSecretFromUrl) return;

    let cancelled = false;

    (async () => {
      try {
        // Limpamos o erro antigo para não confundir o utilizador.
        setError(null);

        const result = await stripe.retrievePaymentIntent(clientSecretFromUrl);

        if (cancelled) return;

        if (result.error) {
          setError(result.error.message ?? "Não foi possível confirmar o estado do pagamento.");
          return;
        }

        const paymentIntent = result.paymentIntent;
        if (!paymentIntent) {
          setError("Não foi possível confirmar o estado do pagamento.");
          return;
        }

        if (paymentIntent.status === "succeeded") {
          atualizarDados({
            additional: {
              ...(dados?.additional ?? {}),
              paymentIntentId: paymentIntent.id,
            },
          });

          try {
            const { trackEvent } = await import("@/lib/analytics");
            trackEvent("checkout_payment_confirmed", {
              eventId: dados?.eventId,
              promoApplied: discountCents > 0,
              currency,
              totalCents: total ? Math.round(total * 100) : null,
              viaRedirect: true,
            });
          } catch (err) {
            console.warn("[trackEvent] checkout_payment_confirmed (redirect) falhou", err);
          }

          irParaPasso(3);
          return;
        }

        if (paymentIntent.status === "processing") {
          setError("Pagamento em processamento. Aguarda uns segundos e verifica o teu email.");
          return;
        }

        if (paymentIntent.status === "requires_payment_method") {
          setError("O pagamento não foi concluído. Tenta novamente ou usa outro método.");
          return;
        }

        // Para outros estados, mostramos uma mensagem genérica.
        setError("O pagamento não ficou concluído. Tenta novamente.");
      } catch (err) {
        console.error("[PaymentForm] Erro a recuperar PaymentIntent do redirect:", err);
        if (!cancelled) setError("Não foi possível confirmar o estado do pagamento.");
      } finally {
        // Removemos os query params de redirect para evitar loops se o utilizador fizer refresh.
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("payment_intent");
          url.searchParams.delete("payment_intent_client_secret");
          url.searchParams.delete("redirect_status");
          window.history.replaceState({}, "", url.toString());
        } catch {}
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stripe, atualizarDados, dados?.additional, dados?.eventId, irParaPasso, currency, total, discountCents]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || !elementReady) return;

    setSubmitting(true);
    setError(null);

    try {
      const returnUrl =
        typeof window !== "undefined" ? window.location.href : undefined;

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: returnUrl ? { return_url: returnUrl } : undefined,
        redirect: "if_required",
      });

      if (error) {
        setError(error.message ?? "O pagamento não foi concluído.");
        return;
      }

      if (paymentIntent && paymentIntent.status === "succeeded") {
        atualizarDados({
          additional: {
            ...(dados?.additional ?? {}),
            paymentIntentId: paymentIntent.id,
          },
        });
        try {
          const { trackEvent } = await import("@/lib/analytics");
          trackEvent("checkout_payment_confirmed", {
            eventId: dados?.eventId,
            promoApplied,
            currency,
            totalCents: total ? Math.round(total * 100) : null,
          });
        } catch (err) {
          console.warn("[trackEvent] checkout_payment_confirmed falhou", err);
        }
        irParaPasso(3);
      }
    } catch (err) {
      console.error("Erro ao confirmar pagamento:", err);
      setError("Erro inesperado ao confirmar o pagamento.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!clientSecret) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-6 text-sm text-red-100 shadow-[0_0_30px_rgba(255,0,0,0.35)]">
        <p className="font-semibold mb-1 flex items-center gap-2">
          <span className="text-lg">⚠️</span> Não foi possível preparar o pagamento.
        </p>
        <p className="text-[12px] mb-4 leading-relaxed">
          Volta atrás e tenta novamente ou recarrega a página.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-white text-red-700 px-5 py-1.5 text-[11px] font-semibold shadow hover:bg-white/90 transition"
          >
            Recarregar
          </button>
          <button
            type="button"
            onClick={() => irParaPasso(1)}
            className="rounded-full border border-white/30 px-5 py-1.5 text-[11px] text-white hover:bg-white/10 transition"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {total !== null && (
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
      )}

      <div className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-4 text-sm backdrop-blur-xl payment-scroll">
        <div className="flex items-center justify-between text-[11px] text-white/70 mb-3">
          <span className="uppercase tracking-[0.16em]">Método de pagamento</span>
          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
            Stripe
          </span>
        </div>
        <div className="relative">
          {!elementReady && (
            <div className="absolute inset-0 rounded-xl border border-white/10 bg-white/5 animate-pulse pointer-events-none" />
          )}
          <PaymentElement
            // key força remount quando o clientSecret muda para evitar usar intents antigos
            key={clientSecret ?? "payment-element"}
            options={{}}
            onReady={() => setElementReady(true)}
            onLoadError={(err) => {
              console.error("[PaymentElement] loaderror", err);
              setElementReady(false);
              setError(err?.error?.message ?? "Não foi possível carregar o formulário de pagamento. Tenta novamente.");
              if (onLoadError) onLoadError();
              // Debug extra: tentar perceber o estado do PI associado
              if (stripe && clientSecret) {
                stripe
                  .retrievePaymentIntent(clientSecret)
                  .then((res) => {
                    console.warn("[PaymentElement] PI status", res.paymentIntent?.status, res.paymentIntent?.id);
                  })
                  .catch(() => undefined);
              }
            }}
          />
        </div>
      </div>

      {error && (
        <p className="text-[11px] text-red-300 mt-1 leading-snug">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || !stripe || !elements || !elementReady}
        className={`${CTA_PRIMARY} mt-3 w-full justify-center px-6 py-3 text-xs active:scale-95 disabled:cursor-not-allowed disabled:opacity-40`}
      >
        {submitting ? "A processar…" : "Pagar agora"}
      </button>

      <p className="mt-2 text-[10px] text-white/40 text-center leading-snug">
        Pagamento seguro processado pela Stripe. A ORYA nunca guarda dados do
        teu cartão.
      </p>
    </form>
  );
}

type AuthWallProps = {
  onAuthenticated?: (userId: string) => void;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function AuthWall({ onAuthenticated }: AuthWallProps) {
  const [mode, setMode] = useState<"login" | "signup" | "verify">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [authOtpCooldown, setAuthOtpCooldown] = useState(0);
  const [authOtpResending, setAuthOtpResending] = useState(false);
  const isEmailLike = (value: string) => value.includes("@");

  useEffect(() => {
    if (authOtpCooldown <= 0) return;
    const t = setInterval(() => {
      setAuthOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [authOtpCooldown]);

  async function triggerResendOtp(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !isEmailLike(cleanEmail)) {
      setError("Indica um email válido para reenviar o código.");
      setAuthOtpCooldown(0);
      return;
    }
    setError(null);
    setAuthOtpResending(true);
    setAuthOtpCooldown(60);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Não foi possível reenviar o código.");
        setAuthOtpCooldown(0);
      }
    } catch (err) {
      console.error("[AuthWall] resend OTP error:", err);
      setError("Não foi possível reenviar o código.");
      setAuthOtpCooldown(0);
    } finally {
      setAuthOtpResending(false);
    }
  }

  async function syncSessionWithServer() {
    try {
      const { data } = await supabaseBrowser.auth.getSession();
      const access_token = data.session?.access_token;
      const refresh_token = data.session?.refresh_token;
      if (!access_token || !refresh_token) return;
      await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token, refresh_token }),
        credentials: "include",
      });
    } catch (err) {
      console.warn("[AuthWall] syncSessionWithServer falhou", err);
    }
  }

  async function handleGoogle() {
    setSubmitting(true);
    setError(null);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? (() => {
              const currentPath = `${window.location.pathname}${window.location.search}`;
              const safeRedirect = sanitizeRedirectPath(currentPath, "/");
              return `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(
                safeRedirect
              )}`;
            })()
          : undefined;
      if (typeof window !== "undefined") {
        try {
          const currentPath = `${window.location.pathname}${window.location.search}`;
          const safeRedirect = sanitizeRedirectPath(currentPath, "/");
          localStorage.setItem("orya_post_auth_redirect", safeRedirect);
        } catch {}
      }
      const { error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        setError(error.message ?? "Não foi possível iniciar sessão com Google.");
      }
    } catch (err) {
      console.error("[AuthWall] Google OAuth error:", err);
      setError("Não foi possível iniciar sessão com Google.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const emailToUse = identifier.trim().toLowerCase();

      if (mode === "verify") {
        if (!identifier || !isEmailLike(identifier) || !otp.trim()) {
          setError("Indica o email e o código recebido.");
          return;
        }
        const token = otp.trim();
        const { error: verifyErr } = await supabaseBrowser.auth.verifyOtp({
          type: "signup",
          email: emailToUse,
          token,
        });
        if (verifyErr) {
          setError(verifyErr.message || "Código inválido ou expirado.");
          setAuthOtpCooldown(0);
          return;
        }
        await syncSessionWithServer();
        await delay(400);
        const { data: userData } = await supabaseBrowser.auth.getUser();
        if (userData?.user) onAuthenticated?.(userData.user.id);
        return;
      }

      if (!identifier || !password) {
        setError("Preenche o email e a palavra-passe.");
        return;
      }

      if (mode === "login") {
        const loginRes = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password }),
          credentials: "include",
        });
        const loginData = await loginRes.json().catch(() => null);
        if (!loginRes.ok || !loginData?.ok) {
          if (loginData?.error === "EMAIL_NOT_CONFIRMED") {
            const emailValue = isEmailLike(identifier) ? identifier : "";
            setMode("verify");
            setIdentifier(emailValue);
            setError(
              emailValue
                ? "Email ainda não confirmado. Reenviei-te um novo código."
                : "Email ainda não confirmado. Indica o teu email para receberes o código."
            );
            if (emailValue) {
              await triggerResendOtp(emailValue);
            }
            return;
          }
          if (loginData?.error === "RATE_LIMITED") {
            setError("Muitas tentativas. Tenta novamente dentro de minutos.");
            return;
          }
          setError("Credenciais inválidas. Confirma username/email e password.");
          return;
        }

        const session = loginData?.session;
        if (session?.access_token && session?.refresh_token) {
          await supabaseBrowser.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
        }
        await syncSessionWithServer();
      } else {
        if (password.length < 6) {
          setError("A password deve ter pelo menos 6 caracteres.");
          return;
        }
        if (password !== confirmPassword) {
          setError("As passwords não coincidem.");
          return;
        }
        if (!fullName.trim()) {
          setError("Nome é obrigatório para criar conta.");
          return;
        }
        const usernameCheck = await checkUsernameAvailabilityRemote(username, setError);
        if (!usernameCheck.ok) {
          setSubmitting(false);
          return;
        }

        const res = await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: emailToUse,
            password,
            username: usernameCheck.username,
            fullName: fullName.trim(),
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) {
          const message = data?.error ?? "Não foi possível enviar o código de verificação.";
          setError(message);
          return;
        }

        setMode("verify");
        setIdentifier(emailToUse);
        setError("Enviámos um código para confirmar o email. Introduz para continuares.");
        setAuthOtpCooldown(60);
        return;
      }

      // Pequeno delay para garantir que a sessão foi escrita nos cookies
      await delay(600);

      // Depois do delay, garantimos que a sessão está disponível e notificamos o Step2
      try {
        const { data: userData } = await supabaseBrowser.auth.getUser();
        if (userData?.user) {
          onAuthenticated?.(userData.user.id);
        }
      } catch (e: unknown) {
        console.warn("[AuthWall] Não foi possível ler user após login:", e);
      }
    } catch (err) {
      console.error("[AuthWall] Erro:", err);
      setError("Ocorreu um erro. Tenta novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-6 shadow-[0_0_40px_rgba(0,0,0,0.6)] flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-1">
            Inicia sessão para continuar
          </h3>
          <p className="text-[11px] text-white/60 max-w-sm leading-relaxed">
            Para associar os bilhetes à tua conta ORYA e evitar problemas no
            check-in, tens de estar com a sessão iniciada antes de pagar.
          </p>
        </div>
        <span className="text-[20px]">🔐</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-2">
        {mode !== "verify" && (
          <div className="flex gap-2 text-[11px] bg-black/40 rounded-full p-1 border border-white/10 w-fit">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`px-3 py-1 rounded-full ${mode === "login" ? "bg-white text-black font-semibold" : "text-white/70"}`}
            >
              Já tenho conta
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`px-3 py-1 rounded-full ${mode === "signup" ? "bg-white text-black font-semibold" : "text-white/70"}`}
            >
              Criar conta
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2 text-[12px]">
          {mode !== "verify" ? (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-white/70">Email</label>
                <input
                  type="email"
                  className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                  placeholder="nome@exemplo.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-white/70">Palavra-passe</label>
                <input
                  type="password"
                  className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>
              {mode === "signup" && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-white/70">Confirmar palavra-passe</label>
                    <input
                      type="password"
                      className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-white/70">Nome completo</label>
                    <input
                      type="text"
                      className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                      placeholder="O teu nome"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoComplete="name"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-white/70">Username</label>
                    <input
                      type="text"
                      className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                      placeholder="@teuuser"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <p className="text-[12px] text-white/70">
                Código enviado para{" "}
                <strong>{isEmailLike(identifier) ? identifier : "teu email"}</strong>. Introduz abaixo.
              </p>
              <div className="flex flex-col gap-1">
                <label className="text-white/70">Email</label>
                <input
                  type="email"
                  className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                  placeholder="nome@exemplo.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-white/70">Código</label>
                <input
                  type="text"
                  maxLength={8}
                  className="w-full rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
                  placeholder="87612097"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  autoComplete="one-time-code"
                />
              </div>
              <div className="text-[11px] text-white/65 flex items-center justify-between">
                <span>
                  Não chegou? {authOtpCooldown > 0 ? `Reenvio em ${authOtpCooldown}s.` : "Reenvia."}
                </span>
                <button
                  type="button"
                  onClick={() => identifier && triggerResendOtp(identifier)}
                  disabled={authOtpCooldown > 0 || authOtpResending || !identifier || !isEmailLike(identifier)}
                  className="text-[#6BFFFF] hover:text-white transition disabled:opacity-50"
                >
                  Reenviar código
                </button>
              </div>
            </>
          )}
        </div>

        {error && (
          <p className="text-[11px] text-red-300 mt-1 leading-snug">{error}</p>
        )}
        {authOtpCooldown > 0 && mode === "verify" && (
          <p className="text-[11px] text-white/60">Reenvio em {authOtpCooldown}s.</p>
        )}

        <button
          type="button"
          onClick={handleGoogle}
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-black/50 px-6 py-2.5 text-xs font-semibold text-white shadow hover:border-white/40 hover:bg-black/60 transition-colors disabled:opacity-50"
        >
          <span>Continuar com Google</span>
        </button>

        <button
          type="submit"
          disabled={submitting}
          className={`${CTA_PRIMARY} mt-2 w-full justify-center px-6 py-2.5 text-xs active:scale-95 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {mode === "verify"
            ? submitting
              ? "A confirmar…"
              : "Confirmar e continuar"
            : mode === "login"
            ? submitting
              ? "A entrar…"
              : "Entrar e continuar"
            : submitting
            ? "A enviar código…"
            : "Criar conta e enviar"}
        </button>
      </form>
    </div>
  );
}

type GuestCheckoutCardProps = {
  guestName: string;
  guestEmail: string;
  guestEmailConfirm: string;
  guestPhone: string;
  guestErrors: { name?: string; email?: string; phone?: string };
  onChangeName: (v: string) => void;
  onChangeEmail: (v: string) => void;
  onChangeEmailConfirm: (v: string) => void;
  onChangePhone: (v: string) => void;
  onContinue: () => void;
};

function GuestCheckoutCard({
  guestName,
  guestEmail,
  guestEmailConfirm,
  guestPhone,
  guestErrors,
  onChangeName,
  onChangeEmail,
  onChangeEmailConfirm,
  onChangePhone,
  onContinue,
}: GuestCheckoutCardProps) {
  return (
    <div className="flex-1 rounded-2xl border border-white/12 bg-white/[0.06] px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-1">Continuar como convidado</h3>
          <p className="text-[11px] text-white/60 max-w-sm leading-relaxed">
            Compra rápida. Guardamos bilhetes no email.
          </p>
          <div className="mt-2 space-y-1 text-[11px] text-white/55">
            <p>• Email para bilhetes e recibo.</p>
            <p>• Telefone ajuda no dia (opcional).</p>
          </div>
        </div>
        <span className="text-[20px]">🎟️</span>
      </div>

      <div className="flex flex-col gap-3 text-[12px]">
        <div className="flex flex-col gap-1">
          <label className="text-white/70">Nome completo</label>
          <input
            type="text"
            className={`w-full rounded-xl bg-white/[0.05] border px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF] ${
              guestErrors.name ? "border-red-400/70" : "border-white/15"
            }`}
            placeholder="Nome no bilhete"
            value={guestName}
            onChange={(e) => onChangeName(e.target.value)}
            autoComplete="name"
          />
          {guestErrors.name && (
            <span className="text-[11px] text-red-300">{guestErrors.name}</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-white/70">Email</label>
          <input
            type="email"
            className={`w-full rounded-xl bg-white/[0.05] border px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF] ${
              guestErrors.email ? "border-red-400/70" : "border-white/15"
            }`}
            placeholder="nome@exemplo.com"
            value={guestEmail}
            onChange={(e) => onChangeEmail(e.target.value)}
            autoComplete="email"
          />
          {guestErrors.email && (
            <span className="text-[11px] text-red-300">{guestErrors.email}</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-white/70">Confirmar email</label>
          <input
            type="email"
            className={`w-full rounded-xl bg-white/[0.05] border px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF] ${
              guestErrors.email ? "border-red-400/70" : "border-white/15"
            }`}
            placeholder="repete o teu email"
            value={guestEmailConfirm}
            onChange={(e) => onChangeEmailConfirm(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-white/70">Telemóvel (opcional)</label>
          <input
            type="tel"
            inputMode="tel"
            className={`w-full rounded-xl bg-white/[0.05] border px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF] ${
              guestErrors.phone ? "border-red-400/70" : "border-white/15"
            }`}
            placeholder="+351 ..."
            value={guestPhone}
            onChange={(e) => {
              const sanitized = sanitizePhone(e.target.value);
              onChangePhone(sanitized);
            }}
            autoComplete="tel"
          />
          {guestErrors.phone && (
            <span className="text-[11px] text-red-300">{guestErrors.phone}</span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className={`${CTA_PRIMARY} mt-1 w-full justify-center px-6 py-2.5 text-xs active:scale-95`}
      >
        Continuar como convidado
      </button>

      <p className="mt-1 text-[10px] text-white/40 leading-snug">
        Vamos enviar os bilhetes para este email. Depois podes criar conta e
        migrar todos os bilhetes para o teu perfil.
      </p>
    </div>
  );
}
