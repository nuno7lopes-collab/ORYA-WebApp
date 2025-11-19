"use client";

import type { FormEvent } from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

type CheckoutError = {
  message: string;
  code?: string;
};

type Step = 1 | 2 | 3;

const stripePublicKey =
  process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY ??
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
  "";

if (!stripePublicKey) {
  console.warn(
    "[ORYA checkout] Stripe public key is not set. Check NEXT_PUBLIC_STRIPE_PUBLIC_KEY or NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in your .env.local.",
  );
}

const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

type CheckoutContentProps = {
  clientSecret: string | null;
  setClientSecret: (value: string | null) => void;
};

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutContentWrapper />
    </Suspense>
  );
}

function CheckoutContentWrapper() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  return (
    <CheckoutContent clientSecret={clientSecret} setClientSecret={setClientSecret} />
  );
}

function CheckoutContent({ clientSecret, setClientSecret }: CheckoutContentProps) {
  const router = useRouter();
   const searchParams = useSearchParams();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<CheckoutError | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [fullTime, setFullTime] = useState(0);
  const [hasExpired, setHasExpired] = useState(false);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [isReserving, setIsReserving] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [isReservationReady, setIsReservationReady] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [summary, setSummary] = useState<{
    eventTitle: string;
    ticketName: string;
    amount: number;
    currency: string;
  } | null>(null);

  // Dados vindos da página do evento (query string)
  const rawEventParam = searchParams.get("event");
  const fromParam = searchParams.get("from") ?? "";

  // 1) Descobrir o slug do evento:
  //    - se vier `event=slug`, usa isso
  //    - se não vier, tenta extrair de `from=/eventos/slug`
  let eventSlug = rawEventParam ?? "";
  if (!eventSlug && fromParam.includes("/eventos/")) {
    const after = fromParam.split("/eventos/")[1];
    if (after) {
      // corta qualquer coisa depois do slug (/, ?, #, etc.)
      eventSlug = after.split(/[/?#]/)[0];
    }
  }

  const eventTitle = searchParams.get("eventTitle") ?? "";
  const ticketName = searchParams.get("ticketName") ?? "Bilhete ORYA";

  // 2) Quantidade: aceita `qty` OU `quantity`
  const qtyRaw =
    searchParams.get("qty") ?? searchParams.get("quantity");

  // 3) Valor: agora ignoramos amountRaw, usaremos summary para o valor real
  const currency = searchParams.get("currency") ?? "EUR";

  const ticketId = searchParams.get("ticketId");

  const qty = qtyRaw ? Number.parseInt(qtyRaw, 10) || 1 : 1;
  const amount = 0;
  const hasValidAmount = false;

  // Para permitir avançar mesmo que o slug falhe por algum motivo,
  // o mínimo que precisamos é do ticketId e qty > 0.
  const hasBasicData = Boolean(ticketId && qty > 0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRedirectUrl(window.location.href);
    }
  }, []);

  // Cancelar reserva ao sair da página ou fechar aba (antes de unmount),
  // mas não depois de o pagamento estar concluído (Step 3).
  useEffect(() => {
    if (!reservationId) return;
    if (currentStep === 3) return;

    const cancelReservation = () => {
      fetch("/api/checkout/reserve/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId }),
      }).catch(() => {});
    };

    const handleBeforeUnload = () => {
      cancelReservation();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      cancelReservation();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [reservationId, currentStep]);

  // 1) Criar / validar reserva logo que a página abre
  useEffect(() => {
    const doReserve = async () => {
      if (!eventSlug || !ticketId) return;
      // Não criar / recriar reservas se já estamos em passos de pagamento ou bilhete confirmado
      if (currentStep !== 1) return;

      try {
        setIsReserving(true);
        setError(null);
        setIsReservationReady(false);

        const res = await fetch("/api/checkout/reserve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventSlug,
            ticketId,
            qty,
          }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok) {
          if (res.status === 401 && data?.code === "NOT_AUTHENTICATED") {
            const currentUrl =
              typeof window !== "undefined" ? window.location.href : "/";
            setRedirectUrl(currentUrl);
            setError({
              message:
                "Precisas de iniciar sessão para continuar este checkout.",
              code: "NOT_AUTHENTICATED",
            });
            return;
          }

          setError({
            message:
              data?.error ??
              "Não foi possível reservar o teu lugar. Volta à página do evento e tenta novamente.",
            code: data?.code,
          });

          if (data?.code === "SOLD_OUT" && eventSlug) {
            setHasExpired(true);
          }

          return;
        }

        const expiresAtStr = data?.expiresAt as string | undefined;
        const nowStr = data?.now as string | undefined;

        if (!expiresAtStr || !nowStr || !data?.reservationId) {
          setError({
            message:
              "Não foi possível obter dados da reserva. Tenta novamente dentro de instantes.",
          });
          return;
        }

        setReservationId(data.reservationId);

        const expiresAtDate = new Date(expiresAtStr);
        const nowDate = new Date(nowStr);
        const diffSeconds = Math.max(
          0,
          Math.floor((expiresAtDate.getTime() - nowDate.getTime()) / 1000),
        );

        setTimeLeft(diffSeconds);
        // Sempre 10 minutos (600s), para a barra não reiniciar ao recarregar
        setFullTime(600);
        setIsReservationReady(true);

        if (diffSeconds <= 0) {
          setHasExpired(true);
        } else {
          // Nova reserva válida → garantir que não ficamos presos em estado expirado
          setHasExpired(false);
        }
      } catch (err) {
        console.error("[/checkout] Erro ao criar reserva:", err);
        setError({
          message:
            "Não foi possível reservar o teu lugar neste momento. Verifica a ligação e tenta novamente.",
        });
      } finally {
        setIsReserving(false);
      }
    };

    void doReserve();
  }, [eventSlug, ticketId, qty, router, currentStep]);

  // 2) Timer de reserva
  useEffect(() => {
    if (!isReservationReady) return;
    if (hasExpired) return;

    if (timeLeft <= 0) {
      setHasExpired(true);
      return;
    }

    const interval = window.setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [timeLeft, hasExpired, isReservationReady]);

  // Auto-fetch PaymentIntent once reservation is ready (Step 1)
  useEffect(() => {
    if (!isReservationReady) return;
    if (currentStep !== 1) return;
    if (summary !== null) return;
    if (!ticketId || qty <= 0) return;
    if (hasExpired) return;

    const autoIntent = async () => {
      try {
        const res = await fetch("/api/payments/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId, quantity: qty }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.clientSecret) return;

        setClientSecret(data.clientSecret);
        const totalAmountEuros =
          typeof data.amount === "number" ? data.amount / 100 : 0;

        setSummary({
          eventTitle: data.event?.title ?? eventTitle,
          ticketName: data.ticket?.name ?? ticketName,
          amount: totalAmountEuros,
          currency: data.currency ?? currency,
        });
      } catch (err) {
        console.error("[autoIntent] Erro ao criar PaymentIntent:", err);
      }
    };

    void autoIntent();
  }, [isReservationReady, currentStep, summary, ticketId, qty]);

  const timerLabel = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }, [timeLeft]);

  // Quando chegamos ao Step 3 (pagamento confirmado), paramos o timer e marcamos como expirado
  useEffect(() => {
    if (currentStep === 3) {
      setTimeLeft(0);
      setHasExpired(true);
    }
  }, [currentStep]);

  const handleGoToLogin = () => {
    const currentUrl =
      redirectUrl ||
      (typeof window !== "undefined" ? window.location.href : "/");

    router.push(
      `/login?redirect=${encodeURIComponent(currentUrl)}&reason=checkout`,
    );
  };

  // 3) Passar do passo 1 → 2 (criar PaymentIntent e obter clientSecret)
  const handlePreparePayment = async () => {
    if (!hasBasicData) {
      setError({
        message:
          "Os dados do bilhete não são válidos. Volta à página do evento e tenta novamente.",
      });
      return;
    }

    // Nota: se por algum motivo não existir reservationId, seguimos mesmo assim.
    // O backend pode tratar este caso como uma compra sem reserva prévia.

    if (hasExpired) {
      setError({
        message:
          "O tempo desta reserva terminou. Volta à página do evento para tentar novamente.",
        code: "RESERVATION_EXPIRED",
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch("/api/payments/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticketId,
          quantity: qty,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401 && data?.code === "NOT_AUTHENTICATED") {
          const currentUrl =
            typeof window !== "undefined" ? window.location.href : "/";

          setRedirectUrl(currentUrl);
          setError({
            message:
              "Precisas de iniciar sessão para concluir o pagamento.",
            code: "NOT_AUTHENTICATED",
          });
          return;
        }

        setError({
          message:
            data?.error ??
            "Não foi possível preparar o pagamento. Tenta novamente dentro de instantes.",
          code: data?.code,
        });
        return;
      }

      if (!data?.clientSecret) {
        setError({
          message:
            "Não foi possível obter os dados de pagamento. Tenta novamente.",
        });
        return;
      }

      setClientSecret(data.clientSecret as string);

      // amount vem em cêntimos do backend; convertemos para euros
      const totalAmountEuros =
        typeof data.amount === "number" ? data.amount / 100 : amount;

      setSummary({
        eventTitle: data.event?.title ?? eventTitle,
        ticketName: data.ticket?.name ?? ticketName,
        amount: totalAmountEuros,
        currency: data.currency ?? currency,
      });

      setCurrentStep(2);
    } catch (err) {
      console.error("[/checkout] Erro inesperado ao criar PaymentIntent:", err);
      setError({
        message:
          "Ocorreu um erro inesperado ao ligar ao sistema de pagamentos. Verifica a tua ligação e tenta novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const effectiveEventTitle = summary?.eventTitle ?? eventTitle;
  const effectiveTicketName = summary?.ticketName ?? ticketName;
  const effectiveAmount = summary?.amount ?? amount;
  const effectiveCurrency = summary?.currency ?? currency;

  // 4) Layout visual + passos
  return (
    <main className="min-h-screen orya-body-bg text-white">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-extrabold tracking-[0.15em]">
              OR
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                Checkout
              </p>
              <p className="text-sm text-white/85">
                Confirma o teu pedido e conclui o pagamento em segurança.
              </p>
            </div>
          </div>

          {/* Timer de reserva */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/50">Reserva ativa por</span>
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${
                hasExpired
                  ? "border-red-500/60 bg-red-500/10 text-red-300"
                  : "border-[#6BFFFF]/60 bg-[#020617] text-[#6BFFFF]"
              }`}
            >
              {!hasExpired ? (
                isReservationReady ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-[#00F5A0] animate-pulse" />
                    <span className="font-mono text-[11px]">{timerLabel}</span>
                  </>
                ) : (
                  <span className="block h-3 w-12 rounded-full bg-white/10 animate-pulse" />
                )
              ) : (
                <span className="font-mono text-[11px]">Tempo expirado</span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* New full-width animated progress bar */}
      <style jsx global>{`
        @keyframes oryaBurn {
          0% { filter: brightness(160%); opacity: 1; }
          50% { filter: brightness(100%); opacity: 0.9; }
          100% { filter: brightness(180%); opacity: 1; }
        }
        @keyframes oryaGlow {
          0% { transform: scale(0.9) translateY(-50%); opacity: 0.7; }
          50% { transform: scale(1.1) translateY(-50%); opacity: 1; }
          100% { transform: scale(0.95) translateY(-50%); opacity: 0.75; }
        }
        @keyframes spark1 {
          0% { transform: translateY(-50%) translateX(0); opacity: 1; }
          50% { opacity: 0.8; }
          100% { opacity: 1; }
        }
        @keyframes spark2 {
          0% { transform: translateY(-50%) translateX(0); opacity: 0.9; }
          50% { opacity: 0.65; }
          100% { opacity: 0.9; }
        }
        @keyframes oryaDistort {
          0% { transform: scaleX(1) skewX(0deg); filter: blur(6px); opacity: 0.85; }
          25% { transform: scaleX(1.04) skewX(-2deg); filter: blur(7px); opacity: 0.9; }
          50% { transform: scaleX(1.02) skewX(1deg); filter: blur(8px); opacity: 1; }
          75% { transform: scaleX(1.05) skewX(-1deg); filter: blur(7px); opacity: 0.92; }
          100% { transform: scaleX(1) skewX(0deg); filter: blur(6px); opacity: 0.85; }
        }
      `}</style>
      <div className="w-full bg-black/40 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-5xl mx-auto px-5 py-3">
          <div className="relative h-3 w-full rounded-full bg-white/10 overflow-hidden">

            {/* BASE: ORYA gradient fill */}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5]"
              style={{
                width: `${Math.max(0, (timeLeft / fullTime) * 100)}%`,
                transition: "width 0.35s ease-out",
              }}
            />

            {/* GLOW LAYER — volumétrico */}
            <div
              className="absolute inset-y-0 left-0 pointer-events-none"
              style={{
                width: `${Math.max(0, (timeLeft / fullTime) * 100)}%`,
              }}
            >
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full blur-2xl opacity-80 bg-gradient-to-br from-[#FF00C8] via-[#6BFFFF] to-[#1646F5]"
                style={{ animation: "oryaGlow 2.4s ease-in-out infinite, oryaDistort 3.8s ease-in-out infinite" }}
              />
            </div>

            {/* SPARK 1 */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-[#6BFFFF] blur-[2px] opacity-90 animate-spark1 pointer-events-none"
              style={{
                left: "0%",
                transform: `translateX(calc(${Math.max(
                  0,
                  (timeLeft / fullTime) * 100
                )}% - 4px)) translateY(-50%)`,
              }}
            />

            {/* SPARK 2 */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-[#FF00C8] blur-[2px] opacity-90 animate-spark2 pointer-events-none"
              style={{
                left: "0%",
                transform: `translateX(calc(${Math.max(
                  0,
                  (timeLeft / fullTime) * 100
                )}% - 8px)) translateY(-50%)`,
              }}
            />

          </div>
        </div>
      </div>

      <section className="max-w-5xl mx-auto px-5 py-10 md:py-14">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)] gap-8 items-start">
          {/* Coluna esquerda – Conteúdo principal (passos) */}
          <div className="rounded-2xl border border-white/15 bg-gradient-to-br from-[#020617] via-[#020617ee] to-[#020617f8] backdrop-blur-xl p-6 md:p-7 space-y-6 shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
            {/* Steps header */}
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                {currentStep === 1
                  ? "Revê o teu pedido"
                  : currentStep === 2
                  ? "Pagamento seguro"
                  : "Bilhete confirmado 🎟️"}
              </h1>
              <p className="text-sm text-white/70 max-w-xl">
                {currentStep === 1 &&
                  "Garante que os detalhes estão corretos antes de ires para o pagamento."}
                {currentStep === 2 &&
                  "Insere os dados de pagamento num ambiente seguro. Assim que for aprovado, o bilhete fica na tua conta ORYA."}
                {currentStep === 3 &&
                  "Pagamento confirmado. O teu bilhete foi emitido e está disponível na tua conta."}
              </p>
            </div>

            {/* Barra de progresso dos passos */}
            <div className="mt-3 flex items-center gap-3 text-[11px]">
              {/* Passo 1 */}
              <div
                className={`flex items-center gap-2 ${
                  currentStep === 1
                    ? "text-white"
                    : currentStep > 1
                    ? "text-[#6BFFFF]"
                    : "text-white/55"
                }`}
              >
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                    currentStep > 1
                      ? "bg-[#6BFFFF] text-black"
                      : currentStep === 1
                      ? "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black"
                      : "border border-white/40"
                  }`}
                >
                  1
                </div>
                <span className="font-semibold">Rever pedido</span>
              </div>

              <div className="h-px flex-1 bg-white/15" />

              {/* Passo 2 */}
              <div
                className={`flex items-center gap-2 ${
                  currentStep === 2
                    ? "text-white"
                    : currentStep > 2
                    ? "text-[#6BFFFF]"
                    : "text-white/55"
                }`}
              >
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                    currentStep > 2
                      ? "bg-[#6BFFFF] text-black"
                      : currentStep === 2
                      ? "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black"
                      : "border border-white/40"
                  }`}
                >
                  2
                </div>
                <span>Pagamento</span>
              </div>

              <div className="h-px flex-1 bg-white/10" />

              {/* Passo 3 */}
              <div
                className={`flex items-center gap-2 ${
                  currentStep === 3 ? "text-white" : "text-white/40"
                }`}
              >
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                    currentStep === 3
                      ? "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black"
                      : "border border-white/25"
                  }`}
                >
                  3
                </div>
                <span>Bilhete disponível</span>
              </div>
            </div>

            {/* Bloco principal, varia com o step */}
            {currentStep === 1 && (
              <StepReview
                eventSlug={eventSlug}
                eventTitle={effectiveEventTitle}
                ticketName={effectiveTicketName}
                qty={qty}
                amount={effectiveAmount}
                currency={effectiveCurrency}
                router={router}
                summary={summary}
              />
            )}

            {currentStep === 2 && clientSecret && stripePromise && (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "night",
                    variables: {
                      colorPrimary: "#FF00C8",
                      colorBackground: "#020617",
                      colorText: "#ffffff",
                      colorTextSecondary: "#94a3b8",
                    },
                  },
                }}
              >
                <StepPayment
                  setCurrentStep={setCurrentStep}
                  setError={setError}
                  hasExpired={hasExpired}
                  reservationId={reservationId}
                  setReservationId={setReservationId}
                />
              </Elements>
            )}

            {currentStep === 3 && (
              <StepConfirmed
                eventSlug={eventSlug}
                router={router}
              />
            )}

            {/* Mensagens de erro / estado gerais */}
            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-200 space-y-1">
                <p className="font-semibold">Não foi possível avançar.</p>
                <p>{error.message}</p>
                {error.code === "RESERVATION_EXPIRED" && eventSlug && (
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 rounded-full border border-red-400/50 px-3 py-1 text-[11px] font-medium text-red-100 hover:bg-red-500/10"
                    onClick={() => router.push(`/eventos/${eventSlug}`)}
                  >
                    Voltar à página do evento
                  </button>
                )}
                {error.code === "NOT_AUTHENTICATED" && (
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/40 px-3 py-1 text-[11px] font-medium text-white hover:bg-white/10"
                    onClick={handleGoToLogin}
                  >
                    Iniciar sessão e continuar checkout
                  </button>
                )}
              </div>
            )}

            {currentStep === 1 && (
              <p className="text-[11px] text-white/45">
                Ao continuar, aceitas os termos do evento definidos pelo
                organizador. Em caso de alteração ou cancelamento, vais receber
                informação diretamente no email associado à tua conta ORYA.
              </p>
            )}
          </div>

          {/* Coluna direita – Resumo / botões de ação principais */}
          <aside className="space-y-4 md:sticky md:top-24">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#030712] via-[#050A17ee] to-[#030712f8] backdrop-blur-2xl p-6 space-y-5 shadow-[0_20px_70px_rgba(0,0,0,0.55)]">
              <h2 className="text-sm font-semibold text-[#6BFFFF] tracking-wide">
                {currentStep === 1
                  ? "Pronto para fechar?"
                  : currentStep === 2
                  ? "Dados de pagamento"
                  : "Tudo tratado!"}
              </h2>

              {currentStep === 1 && (
                <p className="text-xs text-white/65">
                  Quando avançares, vais ver o formulário de pagamento seguro.
                  Assim que o pagamento estiver concluído, o bilhete aparece
                  automaticamente em{" "}
                  <span className="font-medium">
                    A minha conta &gt; Os meus bilhetes
                  </span>
                  .
                </p>
              )}

              {currentStep === 2 && (
                <p className="text-xs text-white/65">
                  Introduz os dados de pagamento com toda a segurança. Se o
                  banco pedir, pode aparecer um desafio de confirmação (3D
                  Secure).
                </p>
              )}

              {currentStep === 3 && (
                <p className="text-xs text-white/65">
                  Pagamento confirmado e bilhete emitido. Podes consultá-lo
                  sempre na área de bilhetes da tua conta ORYA.
                </p>
              )}

              {currentStep === 1 && (
                <button
                  type="button"
                  onClick={handlePreparePayment}
                  disabled={
                    isLoading ||
                    isReserving ||
                    hasExpired ||
                    !hasBasicData
                  }
                  className="block w-full text-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-semibold text-black hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_0_32px_rgba(107,255,255,0.6)] shadow-[0_0_32px_rgba(255,0,200,0.25)] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {hasExpired
                    ? "Reserva expirada"
                    : isReserving
                    ? "A reservar o teu lugar..."
                    : isLoading
                    ? "A preparar o pagamento..."
                    : "Continuar para pagamento seguro"}
                </button>
              )}

              {currentStep === 2 && (
                <p className="text-[11px] text-white/50">
                  O formulário de pagamento está logo ao lado. Depois de
                  confirmares, voltas para aqui automaticamente.
                </p>
              )}

              {currentStep === 3 && (
                <button
                  type="button"
                  onClick={() => router.push("/me/bilhetes")}
                  className="block w-full text-center px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-semibold text-black hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_0_32px_rgba(107,255,255,0.6)]"
                >
                  Ver todos os meus bilhetes
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  eventSlug
                    ? router.push(`/eventos/${eventSlug}`)
                    : router.push("/explorar")
                }
                className="block w-full text-center px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-[11px] font-semibold text-white/85 hover:bg-white/10 transition-colors"
              >
                Voltar aos bilhetes
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-xl p-4 text-[11px] text-white/70 space-y-2 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
              <p className="font-semibold text-white/80">
                Pagamento seguro &amp; transparente
              </p>
              <p>
                Usamos parceiros de pagamento reconhecidos (como Stripe) para
                garantir que os teus dados bancários são tratados com segurança
                a nível mundial.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

/**
 * Step 1 – Review
 */
type StepReviewProps = {
  eventSlug: string;
  eventTitle: string;
  ticketName: string;
  qty: number;
  amount: number;
  currency: string;
  router: ReturnType<typeof useRouter>;
  summary: {
    eventTitle: string;
    ticketName: string;
    amount: number;
    currency: string;
  } | null;
};

function StepReview({
  eventSlug,
  eventTitle,
  ticketName,
  qty,
  amount,
  currency,
  router,
  summary,
}: StepReviewProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#030712] via-[#050A17ee] to-[#030712f8] p-6 space-y-6 text-sm shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-4 pb-2">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.16em] text-[#6BFFFF] font-semibold">
            Detalhes do evento
          </p>
          <p className="text-sm font-medium text-white/90">
            {eventTitle || "Evento ORYA"}
          </p>
          {eventSlug && (
            <button
              className="text-[11px] text-white/60 underline underline-offset-4 hover:text-white/90"
              type="button"
              onClick={() => router.push(`/eventos/${eventSlug}`)}
            >
              Ver detalhes do evento
            </button>
          )}
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-[#FF00C8]/40 via-[#6BFFFF]/40 to-[#1646F5]/40" />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-white/65">Tipo de bilhete</span>
          <span className="font-medium">{ticketName}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/60">Quantidade</span>
          <span className="text-white/90">{qty}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/60">Total</span>
          <span className="text-white font-semibold tracking-wide">
            {summary?.amount
              ? `${summary.amount.toFixed(2)} ${summary.currency}`
              : `--,-- ${summary?.currency ?? currency}`}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Step 2 – Payment (Stripe Payment Element)
 */
type StepPaymentProps = {
  setCurrentStep: (step: Step) => void;
  setError: (error: CheckoutError | null) => void;
  hasExpired: boolean;
  reservationId: string | null;
  setReservationId: (id: string | null) => void;
};

function StepPayment({
  setCurrentStep,
  setError,
  hasExpired,
  reservationId,
  setReservationId,
}: StepPaymentProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hasExpired) {
      setError({
        message: "O tempo da reserva expirou. Volta à página do evento para tentar novamente.",
        code: "RESERVATION_EXPIRED",
      });
      return;
    }
    setError(null);

    if (!stripe || !elements) {
      setError({
        message:
          "O formulário de pagamento ainda não está pronto. Aguarda um pouco e tenta novamente.",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });

      if (error) {
        console.error("[StepPayment] Erro ao confirmar pagamento:", error);
        setError({
          message:
            error.message ||
            "O pagamento foi recusado. Verifica os dados do cartão e tenta novamente.",
          code: error.type || "card_error",
        });
        return;
      }

      if (paymentIntent && paymentIntent.status === "succeeded") {
        // Se existir uma reserva associada, marcamos como concluída e libertamos
        if (reservationId) {
          try {
            await fetch("/api/checkout/reserve/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reservationId }),
            });
          } catch (e) {
            console.error("[StepPayment] Erro ao concluir reserva:", e);
          }
          // Garantir que não voltamos a cancelar esta reserva no unmount
          setReservationId(null);
        }
        setCurrentStep(3);
      } else {
        setError({
          message:
            "Não foi possível confirmar o estado do pagamento. Verifica se o pagamento foi processado junto do teu banco.",
        });
      }
    } catch (err) {
      console.error("[StepPayment] Erro inesperado:", err);
      setError({
        message:
          "Ocorreu um erro inesperado ao processar o pagamento. Verifica a tua ligação e tenta novamente.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-white/12 bg-black/40 p-4 text-sm"
    >
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.16em] text-white/50">
          Pagamento
        </p>
        <p className="text-xs text-white/70">
          Os teus dados são tratados diretamente pela Stripe. ORYA nunca vê o
          número completo do teu cartão.
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/60 p-3">
        <PaymentElement />
      </div>

      <button
        type="submit"
        disabled={!stripe || !elements || isProcessing || hasExpired}
        className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2.5 text-xs font-semibold text-black shadow-[0_0_24px_rgba(107,255,255,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {isProcessing ? "A processar pagamento..." : "Pagar agora"}
      </button>
    </form>
  );
}

/**
 * Step 3 – Confirmed
 */
type StepConfirmedProps = {
  eventSlug: string;
  router: ReturnType<typeof useRouter>;
};

function StepConfirmed({ eventSlug, router }: StepConfirmedProps) {
  return (
    <div className="rounded-3xl border border-[#6BFFFF]/40 bg-gradient-to-br from-[#020617dd] via-[#051021ee] to-[#030712] p-6 md:p-8 space-y-6 shadow-[0_25px_90px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-300 to-emerald-500 text-black text-sm font-bold shadow-[0_0_25px_rgba(16,185,129,0.55)]">
          ✓
        </span>
        <div>
          <p className="text-base font-semibold text-emerald-200">
            Bilhete emitido com sucesso
          </p>
          <p className="text-xs text-emerald-100/80">
            O teu bilhete está agora associado à tua conta ORYA.
          </p>
        </div>
      </div>

      {/* Ticket visual premium */}
      <div className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-[#030712] via-[#050A17] to-[#020617] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.45)] overflow-hidden">
        {/* Simulated QR placeholder */}
        <div className="absolute right-6 top-6 flex h-28 w-28 items-center justify-center rounded-xl bg-white/90">
          <span className="text-black text-[10px] font-semibold">QR CODE</span>
        </div>

        {/* Event Info */}
        <div className="space-y-1 pr-32">
          <p className="text-xs uppercase tracking-[0.2em] text-[#6BFFFF]/80">
            Bilhete ORYA
          </p>
          <p className="text-lg font-semibold text-white leading-snug">
            O teu bilhete foi confirmado
          </p>
          <p className="text-[11px] text-white/60 pt-1">
            Podes consultar este bilhete sempre em{" "}
            <span className="font-medium text-white/80">
              A Minha Conta › Os Meus Bilhetes
            </span>
            .
          </p>
        </div>

        {/* Decorative bottom strip */}
        <div className="mt-6 h-1 w-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] rounded-full" />
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push("/me/bilhetes")}
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-xs font-semibold text-black hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_0_24px_rgba(107,255,255,0.55)]"
        >
          Ver os meus bilhetes
        </button>

        {eventSlug && (
          <button
            type="button"
            onClick={() => router.push(`/eventos/${eventSlug}`)}
            className="inline-flex items-center justify-center rounded-xl border border-white/20 px-4 py-2 text-xs font-semibold text-white/85 hover:bg-white/10 active:scale-95 transition-transform"
          >
            Voltar ao evento
          </button>
        )}
      </div>
    </div>
  );
}