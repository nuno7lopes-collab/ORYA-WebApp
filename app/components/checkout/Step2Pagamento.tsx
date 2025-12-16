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
import { isValidPhone, sanitizePhone } from "@/lib/phone";
import { sanitizeUsername, validateUsername } from "@/lib/username";

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
  waves?: CheckoutWave[];
  additional?: {
    quantidades?: Record<string, number>;
    total?: number;
    guestName?: string;
    guestEmail?: string;
    guestPhone?: string | null;
  };
  paymentScenario?: string | null;
};

type GuestInfo = {
  name: string;
  email: string;
  phone?: string;
};

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
  const lastIntentKeyRef = useRef<string | null>(null);
  const inFlightIntentRef = useRef<string | null>(null);
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

  useEffect(() => {
    if (!promoCode.trim()) {
      setAppliedDiscount(0);
    }
  }, [promoCode]);

  useEffect(() => {
    if (isFreeScenario && purchaseMode !== "auth") {
      setPurchaseMode("auth");
      setClientSecret(null);
      setServerAmount(null);
    }
  }, [isFreeScenario, purchaseMode]);

  const safeDados: CheckoutData | null =
    dados && typeof dados === "object" ? (dados as CheckoutData) : null;
  const scenario = safeDados?.paymentScenario ?? cachedIntent?.paymentScenario ?? null;
  const isFreeScenario = scenario === "FREE_CHECKOUT";

  const stripePromise = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) return null;
    return loadStripe(key);
  }, []);

  useEffect(() => {
    if (!stripePromise) {
      setError("Configuração de pagamentos indisponível. Tenta novamente mais tarde.");
      setLoading(false);
    }
  }, [stripePromise]);

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

    const items: CheckoutItem[] = waves
      .map((w) => {
        const qty = quantidades[w.id] ?? 0;
        if (!qty || qty <= 0) return null;
        const ticketId = Number(w.id);
        if (!Number.isFinite(ticketId)) return null;
        return { ticketId, quantity: qty };
      })
      .filter(Boolean) as CheckoutItem[];

    if (items.length === 0) return null;

    const totalFromStep1 =
      typeof additional.total === "number" ? additional.total : null;

      return {
        slug: safeDados.slug,
        items,
        total: totalFromStep1,
        promoCode: promoCode.trim() || undefined,
        paymentScenario: safeDados.paymentScenario ?? undefined,
      };
  }, [safeDados, promoCode]);

  const checkUsernameAvailability = async (value: string) => {
    const cleaned = sanitizeUsername(value);
    const validation = validateUsername(cleaned);
    if (!validation.valid) {
      setError(validation.error);
      return { ok: false, username: cleaned };
    }
    try {
      const res = await fetch(`/api/username/check?username=${encodeURIComponent(cleaned)}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.available === false) {
        setError("Esse @ já está a ser usado.");
        return { ok: false, username: cleaned };
      }
      return { ok: true, username: validation.normalized };
    } catch (err) {
      console.error("[Step2Pagamento] erro a verificar username", err);
      setError("Não foi possível verificar o username. Tenta novamente.");
      return { ok: false, username: cleaned };
    }
  };

  useEffect(() => {
    // Se não houver dados de checkout, mandamos de volta
    if (!payload) {
      irParaPasso(1);
      return;
    }

    if (!stripePromise) return;
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

    // Chave estável para não recriar PaymentIntent sem necessidade
    const intentKey = JSON.stringify({
      payload,
      guest: guestPayload,
      userId: userId ?? "guest",
      mode: purchaseMode,
      scenario: safeDados?.paymentScenario ?? null,
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

        const res = await fetch("/api/payments/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            guest: guestPayload ?? undefined,
          }),
        });

        const data = await res.json();
        console.log("[Step2Pagamento] Resposta de /api/payments/intent:", {
          status: res.status,
          ok: res.ok,
          data,
        });

        // Se a API disser 401 ➜ perder sessão entretanto
        if (res.status === 401) {
          if (purchaseMode === "guest") {
            if (!cancelled) {
              setBreakdown(null);
              setError(
                typeof data?.error === "string"
                  ? data.error
                  : "Não foi possível continuar como convidado."
              );
            }
            return;
          }
          if (!cancelled) {
            setUserId(null);
            setClientSecret(null);
            setServerAmount(null);
            setBreakdown(null);
            setError(null);
          }
          return;
        }

        if (!res.ok || !data?.ok || (!data.clientSecret && !data.freeCheckout)) {
          setBreakdown(null);
          if (data?.code === "USERNAME_REQUIRED_FOR_FREE") {
            if (!cancelled) {
              setError("Este evento gratuito requer sessão com username definido.");
              setPurchaseMode("auth");
              setAuthInfo("Inicia sessão e define um username para concluir a inscrição gratuita.");
            }
            return;
          }
          const msg =
            typeof data?.error === "string"
              ? data.error
              : "Não foi possível preparar o pagamento.";

          if (data?.code === "ORGANIZER_STRIPE_NOT_CONNECTED") {
            if (!cancelled) {
              setError(
                data?.message ||
                  "Pagamentos desativados para este evento enquanto o organizador não ligar a Stripe.",
              );
              setAuthInfo("Liga a Stripe em Finanças & Payouts para ativares pagamentos.");
            }
            return;
          }

          const promoFail =
            payload?.promoCode && typeof data?.error === "string" && data.error.toLowerCase().includes("código");

          if (promoFail && !cancelled) {
            setPromoWarning("Código não aplicado. Continuas sem desconto.");
            setPromoCode("");
            setAppliedDiscount(0);
            setAppliedPromoLabel(null);
            setError(null);
            setBreakdown(null);
            return;
          }

          if (!cancelled) setError(msg);
          return;
        }

        if (!cancelled) {
          const paymentScenarioResponse =
            typeof data?.paymentScenario === "string"
              ? data.paymentScenario
              : safeDados?.paymentScenario ?? null;
          const purchaseIdFromServer = typeof data?.purchaseId === "string" ? data.purchaseId : undefined;
          const promoLabel =
            promoCode?.trim()
              ? promoCode.trim()
              : data.discountCents && data.discountCents > 0
                ? "Promo automática"
                : null;
          const isAutoAppliedPromo = !promoCode?.trim() && Boolean(promoLabel);

          if (data.freeCheckout) {
            const totalCents =
              data.breakdown && typeof data.breakdown === "object"
                ? (data.breakdown as CheckoutBreakdown).totalCents ?? 0
                : 0;
            setBreakdown(
              data.breakdown && typeof data.breakdown === "object"
                ? (data.breakdown as CheckoutBreakdown)
                : null,
            );
            setAppliedDiscount(
              typeof data.discountCents === "number"
                ? data.discountCents / 100
                : typeof data.breakdown?.discountCents === "number"
                  ? data.breakdown.discountCents / 100
                  : 0,
            );
            setAppliedPromoLabel(promoLabel);
            setClientSecret(null);
            setServerAmount(0);
            atualizarDados({
              additional: {
                ...(safeDados?.additional ?? {}),
                paymentIntentId: "FREE_CHECKOUT",
                purchaseId: purchaseIdFromServer,
                total: totalCents / 100,
                freeCheckout: true,
                promoCode: payload?.promoCode,
                appliedPromoLabel: promoLabel ?? undefined,
                paymentScenario: paymentScenarioResponse ?? undefined,
              },
            });
            lastIntentKeyRef.current = intentKey;
            irParaPasso(3);
            return;
          }
          setClientSecret(data.clientSecret as string);
          setServerAmount(
            typeof data.amount === "number" ? data.amount : null,
          );
          setBreakdown(
            data.breakdown && typeof data.breakdown === "object"
              ? (data.breakdown as CheckoutBreakdown)
              : null,
          );
          setAppliedDiscount(
            typeof data.discountCents === "number"
              ? data.discountCents / 100
              : typeof data.breakdown?.discountCents === "number"
                ? data.breakdown.discountCents / 100
                : 0,
          );
          setAppliedPromoLabel(promoLabel);
          atualizarDados({
            paymentScenario: paymentScenarioResponse ?? undefined,
            additional: {
              ...(safeDados?.additional ?? {}),
              purchaseId: purchaseIdFromServer ?? (safeDados?.additional as Record<string, unknown> | undefined)?.purchaseId,
              paymentIntentId: typeof data?.paymentIntentId === "string" ? data.paymentIntentId : safeDados?.additional?.paymentIntentId,
            },
          });
          lastIntentKeyRef.current = intentKey;
          setCachedIntent({
            key: intentKey,
            clientSecret: data.clientSecret as string,
            amount: typeof data.amount === "number" ? data.amount : null,
            breakdown:
              data.breakdown && typeof data.breakdown === "object"
                ? (data.breakdown as CheckoutBreakdown)
                : null,
            discount:
              typeof data.discountCents === "number"
                ? data.discountCents / 100
                : typeof data.breakdown?.discountCents === "number"
                  ? data.breakdown.discountCents / 100
                  : 0,
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

  const appearance: Appearance = {
    theme: "night",
    variables: {
      colorPrimary: "#FF00C8",
      colorBackground: "#0A0A0F",
      colorText: "#F5F5F5",
      colorDanger: "#FF4242",
      fontFamily:
        "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      borderRadius: "16px",
    },
    rules: {
      ".Input": {
        padding: "14px",
        backgroundColor: "#11131A",
        border: "1px solid rgba(255,255,255,0.08)",
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

// Callback chamado pelo AuthWall quando o utilizador faz login/cria conta com sucesso
  const handleAuthenticated = async (newUserId: string) => {
    setUserId(newUserId);
    setAuthChecked(true);
    setAuthChecking(false);
    setPurchaseMode("auth");

    // Tentar migrar bilhetes de guest para este user (best-effort)
    try {
      await fetch("/api/tickets/migrate-guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.warn("[Step2Pagamento] Falha ao migrar bilhetes de convidado", err);
    }
  };

  // Callback para continuar como convidado
  const handleGuestContinue = () => {
    if (isFreeScenario) {
      setError("Eventos gratuitos requerem sessão com username.");
      setPurchaseMode("auth");
      setAuthInfo("Inicia sessão e define um username para concluir a inscrição gratuita.");
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
  };

  return (
    <div className="flex flex-col gap-6 text-white">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">
            Passo 2 de 3
          </p>
          <h2 className="text-xl font-semibold leading-tight">
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

      <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
        <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5]" />
      </div>

      {/* 🔐 Se ainda estamos a verificar auth */}
      {authChecking && (
        <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 flex flex-col justify-center items-center text-center shadow-[0_0_40px_rgba(255,0,200,0.25)]">
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
          {error || !stripePromise ? (
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
          ) : loading || !clientSecret || !options ? (
            <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 flex flex-col justify-center items-center text-center shadow-[0_0_40px_rgba(255,0,200,0.25)]">
              <div className="relative mb-6">
                <div className="h-14 w-14 rounded-full border-2 border-white/20 border-t-transparent animate-spin" />
                <div className="absolute inset-0 h-14 w-14 animate-pulse rounded-full border border-[#6BFFFF]/20" />
              </div>
              <h3 className="text-sm font-semibold mb-1 animate-pulse">
                A preparar o teu pagamento…
              </h3>
              <p className="text-[11px] text-white/65 max-w-xs leading-relaxed">
                Estamos a ligar-te à Stripe para criar uma transação segura.
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
            <div className="flex-1 rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-6 shadow-[0_0_60px_rgba(0,0,0,0.6)] overflow-y-auto max-h-[65vh] space-y-4">
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
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-2">
                <label className="text-xs text-white/70">Tens um código promocional?</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    placeholder="Insere o código"
                    className="flex-1 rounded-xl bg-black/50 border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]"
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
              <Elements stripe={stripePromise} options={options}>
                <PaymentForm total={total} discount={appliedDiscount} breakdown={breakdown ?? undefined} />
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
          {!isFreeScenario && (
            <div className="flex items-center gap-2 text-[11px] bg-black/40 rounded-full p-1 border border-white/10 w-fit">
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

          {isFreeScenario ? (
            <div className="space-y-2">
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-50">
                Evento gratuito — inicia sessão e garante que tens username definido para concluir a inscrição.
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
};

function PaymentForm({ total, discount = 0, breakdown }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { irParaPasso, atualizarDados, dados } = useCheckout();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currency = breakdown?.currency ?? "EUR";
  const discountCents = Math.max(0, Math.round(discount * 100));
  const hasInvoice = Boolean(breakdown?.lines?.length);
  const platformFeeCents =
    breakdown && breakdown.feeMode === "ADDED" ? breakdown.platformFeeCents : 0;
  const subtotalCents = breakdown?.subtotalCents ?? 0;
  const baseSubtotalCents =
    hasInvoice && discountCents > 0 ? subtotalCents + discountCents : subtotalCents;
  const promoApplied = discountCents > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {(hasInvoice || total !== null) && (
        <div className="rounded-2xl border border-white/10 bg-black/40 px-5 py-4 shadow-inner shadow-black/40 space-y-3">
          <div className="flex items-center justify-between text-xs text-white/70">
            <span className="uppercase tracking-[0.14em]">Resumo</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 border border-white/10 text-[11px] text-white/70">
              🔒 Pagamento seguro
            </span>
          </div>

          {hasInvoice && (
            <div className="space-y-2">
              {breakdown?.lines?.map((line) => (
                <div
                  key={`${line.ticketTypeId}-${line.name}-${line.quantity}`}
                  className="flex items-center justify-between text-sm text-white/80"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{line.name}</span>
                    <span className="text-[11px] text-white/55">x{line.quantity}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-semibold">
                      {formatMoney(line.lineTotalCents, line.currency || currency)}
                    </p>
                    <p className="text-[11px] text-white/45">
                      {formatMoney(line.unitPriceCents, line.currency || currency)} / bilhete
                    </p>
                  </div>
                </div>
              ))}

              <div className="h-px w-full bg-white/10" />

              {discountCents > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm text-white/70">
                    <span>Subtotal (antes de desconto)</span>
                    <span className="font-semibold">
                      {formatMoney(baseSubtotalCents, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-emerald-300">
                    <span>Desconto aplicado</span>
                    <span>-{formatMoney(discountCents, currency)}</span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between text-sm text-white/80">
                <span>Subtotal</span>
                <span className="font-semibold">
                  {formatMoney(subtotalCents, currency)}
                </span>
              </div>

              {platformFeeCents > 0 && (
                <div className="flex items-center justify-between text-sm text-white/70">
                  <span>Taxas de serviço</span>
                  <span>{formatMoney(platformFeeCents, currency)}</span>
                </div>
              )}
            </div>
          )}

          {total !== null && (
            <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 border border-white/10">
              <div className="flex flex-col text-white/80">
                <span className="text-[12px]">Total a pagar</span>
                {breakdown?.feeMode === "INCLUDED" && (
                  <span className="text-[11px] text-white/55">
                    Taxas já incluídas
                  </span>
                )}
              </div>
              <span className="text-xl font-semibold text-white">
                {formatMoney(Math.round(total * 100), currency)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl bg-black/40 px-3 py-3 text-sm min-h-[320px] max-h-[400px] overflow-y-auto pr-1 payment-scroll">
          <PaymentElement
            options={{
              // Ordem preferida; apenas métodos autorizados (Stripe: Card/Link/MB WAY — Apple Pay vem via Card)
            paymentMethodOrder: ["card", "link", "mb_way"],
            }}
          />
      </div>

      {error && (
        <p className="text-[11px] text-red-300 mt-1 leading-snug">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || !stripe || !elements}
        className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-6 py-3 text-xs font-semibold text-black shadow-[0_0_32px_rgba(107,255,255,0.55)] disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.03] active:scale-95 transition-transform"
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

  function isUnconfirmedError(err: unknown) {
    if (!err) return false;
    const anyErr = err as { message?: string; status?: number; error_description?: string };
    const msg = (anyErr.message || anyErr.error_description || "").toLowerCase();
    return (
      msg.includes("not confirmed") ||
      msg.includes("confirm your email") ||
      msg.includes("email_not_confirmed")
    );
  }

  useEffect(() => {
    if (authOtpCooldown <= 0) return;
    const t = setInterval(() => {
      setAuthOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [authOtpCooldown]);

  async function triggerResendOtp(email: string) {
    setError(null);
    setAuthOtpResending(true);
    setAuthOtpCooldown(60);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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

  async function handleGoogle() {
    setSubmitting(true);
    setError(null);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(window.location.href)}`
          : undefined;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("orya_post_auth_redirect", window.location.href);
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
      if (mode === "verify") {
        if (!identifier || !otp.trim()) {
          setError("Indica o email e o código recebido.");
          return;
        }
        const emailToUse = identifier.trim().toLowerCase();
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
        await delay(400);
        const { data: userData } = await supabaseBrowser.auth.getUser();
        if (userData?.user) onAuthenticated?.(userData.user.id);
        return;
      }

      if (!identifier || !password) {
        setError("Preenche o email e a palavra-passe.");
        return;
      }

      let emailToUse = identifier.trim().toLowerCase();
      if (!identifier.includes("@")) {
        const res = await fetch("/api/auth/resolve-identifier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !data?.email) {
          setError("Credenciais inválidas. Confirma username/email e password.");
          return;
        }
        emailToUse = data.email;
      }

      if (mode === "login") {
        const { error } = await supabaseBrowser.auth.signInWithPassword({
          email: emailToUse,
          password,
        });
        if (error) {
          if (isUnconfirmedError(error)) {
            setMode("verify");
            setIdentifier(emailToUse);
            setError("Email ainda não confirmado. Reenviei-te um novo código.");
            await triggerResendOtp(emailToUse);
            return;
          }
          setError(error.message ?? "Não foi possível iniciar sessão.");
          return;
        }
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
        const usernameCheck = await checkUsernameAvailability(username);
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
                Enviámos um código de confirmação para <strong>{identifier}</strong>. Introduz abaixo ou pede novo código.
              </p>
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
                  Não chegou? {authOtpCooldown > 0 ? `Podes reenviar em ${authOtpCooldown}s.` : "Reenvia um novo código."}
                </span>
                <button
                  type="button"
                  onClick={() => identifier && triggerResendOtp(identifier)}
                  disabled={authOtpCooldown > 0 || authOtpResending || !identifier}
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
          <p className="text-[11px] text-white/60">Podes reenviar código em {authOtpCooldown}s.</p>
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
          className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-6 py-2.5 text-xs font-semibold text-black shadow-[0_0_24px_rgba(107,255,255,0.55)] disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95 transition-transform"
        >
          {mode === "verify"
            ? submitting
              ? "A confirmar…"
              : "Confirmar código e continuar"
            : mode === "login"
            ? submitting
              ? "A entrar…"
              : "Iniciar sessão e continuar"
            : submitting
            ? "A enviar código…"
            : "Criar conta e enviar código"}
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
    <div className="flex-1 rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-6 shadow-[0_0_40px_rgba(0,0,0,0.6)] flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-1">Continuar como convidado</h3>
          <p className="text-[11px] text-white/60 max-w-sm leading-relaxed">
            Compra em 30 segundos. Guardamos os teus bilhetes pelo email e podes
            criar conta depois para os ligar ao teu perfil.
          </p>
          <div className="mt-2 space-y-1 text-[11px] text-white/55">
            <p>• Email é usado para entregar bilhetes e recibo.</p>
            <p>• Telefone ajuda no contacto no dia do evento (opcional).</p>
          </div>
        </div>
        <span className="text-[20px]">🎟️</span>
      </div>

      <div className="flex flex-col gap-3 text-[12px]">
        <div className="flex flex-col gap-1">
          <label className="text-white/70">Nome completo</label>
          <input
            type="text"
            className={`w-full rounded-xl bg-black/60 border px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF] ${
              guestErrors.name ? "border-red-400/70" : "border-white/15"
            }`}
            placeholder="Como queres que apareça no bilhete"
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
            className={`w-full rounded-xl bg-black/60 border px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF] ${
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
            className={`w-full rounded-xl bg-black/60 border px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF] ${
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
            className={`w-full rounded-xl bg-black/60 border px-3 py-2 text-[12px] outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF] ${
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
        className="mt-1 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-6 py-2.5 text-xs font-semibold text-black shadow-[0_0_24px_rgba(107,255,255,0.55)] hover:scale-[1.02] active:scale-95 transition-transform"
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
