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
import { CTA_PRIMARY } from "@/app/org/_shared/dashboardUi";
import { useCheckout, type CheckoutBreakdown } from "./contextoCheckout";
import OrderSummaryPanel from "./OrderSummaryPanel";
import { getStripePublishableKey } from "@/lib/stripePublic";

type StripePaymentSectionProps = {
  loading: boolean;
  error: string | null;
  clientSecret: string | null;
  total: number | null;
  discount?: number;
  breakdown?: CheckoutBreakdown | null;
  onLoadError?: () => void;
  onRetry?: () => void;
};

export default function StripePaymentSection({
  loading,
  error,
  clientSecret,
  total,
  discount = 0,
  breakdown,
  onLoadError,
  onRetry,
}: StripePaymentSectionProps) {
  const stripePromise = useMemo(() => {
    try {
      const key = getStripePublishableKey();
      return loadStripe(key);
    } catch {
      return null;
    }
  }, []);

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
      }
    : undefined;

  if (!stripePromise) {
    return (
      <div className="flex-1 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-6 text-sm text-red-100 shadow-[0_0_30px_rgba(255,0,0,0.35)]">
        <p className="font-semibold mb-1 flex items-center gap-2">
          <span className="text-lg">⚠️</span> Pagamentos indisponíveis
        </p>
        <p className="text-[12px] mb-4 leading-relaxed">
          Configuração de pagamentos em falta. Tenta novamente mais tarde.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-white text-red-700 px-5 py-1.5 text-[11px] font-semibold shadow hover:bg-white/90 transition"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-6 text-sm text-red-100 shadow-[0_0_30px_rgba(255,0,0,0.35)]">
        <p className="font-semibold mb-1 flex items-center gap-2">
          <span className="text-lg">⚠️</span> Ocorreu um problema
        </p>
        <p className="text-[12px] mb-4 leading-relaxed">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-white text-red-700 px-5 py-1.5 text-[11px] font-semibold shadow hover:bg-white/90 transition"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (loading || (!clientSecret && options === undefined)) {
    return (
      <div className="flex-1 rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-12 flex flex-col justify-center items-center text-center shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl">
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
    );
  }

  return (
    <div className="flex-1 rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-6 shadow-[0_0_60px_rgba(0,0,0,0.6)] backdrop-blur-xl space-y-4">
      <OrderSummaryPanel total={total} discount={discount} breakdown={breakdown} />
      <Elements stripe={stripePromise} options={options}>
        <PaymentForm
          total={total}
          discount={discount}
          breakdown={breakdown ?? undefined}
          clientSecret={clientSecret}
          onLoadError={onLoadError}
          onRetry={onRetry}
        />
      </Elements>
    </div>
  );
}

type PaymentFormProps = {
  total: number | null;
  discount?: number;
  breakdown?: CheckoutBreakdown;
  clientSecret: string | null;
  onLoadError?: () => void;
  onRetry?: () => void;
};

function PaymentForm({
  total,
  discount = 0,
  breakdown,
  clientSecret,
  onLoadError,
  onRetry,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { irParaPasso, atualizarDados, dados } = useCheckout();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elementReady, setElementReady] = useState(false);
  const statusCheckDoneRef = useRef<Set<string>>(new Set());
  const loadErrorNotifiedRef = useRef<Set<string>>(new Set());
  const currency = breakdown?.currency ?? "EUR";
  const discountCents = Math.max(0, Math.round(discount * 100));
  const promoApplied = discountCents > 0;

  const notifyLoadErrorOnce = (
    secret: string | null,
    message: string,
    extra?: Record<string, unknown>,
  ) => {
    setError(message);
    if (!secret) {
      onLoadError?.();
      return;
    }
    if (loadErrorNotifiedRef.current.has(secret)) return;
    loadErrorNotifiedRef.current.add(secret);
    if (process.env.NODE_ENV === "development") {
      console.debug("[PaymentForm] load_error_once", { secret, ...extra });
    }
    onLoadError?.();
  };

  useEffect(() => {
    setElementReady(false);
  }, [clientSecret]);

  useEffect(() => {
    if (!stripe || !clientSecret) return;
    if (statusCheckDoneRef.current.has(clientSecret)) return;
    statusCheckDoneRef.current.add(clientSecret);
    let cancelled = false;
    (async () => {
      try {
        const pi = await stripe.retrievePaymentIntent(clientSecret);
        if (cancelled) return;
        const status = pi.paymentIntent?.status;
        if (status && !["requires_payment_method", "requires_action", "requires_confirmation"].includes(status)) {
          notifyLoadErrorOnce(
            clientSecret,
            "Sessão de pagamento expirou. Vamos criar um novo intento.",
            { source: "status-check", status },
          );
        }
      } catch (err) {
        if (cancelled) return;
        notifyLoadErrorOnce(clientSecret, "Falha ao validar estado do pagamento. Tenta novamente.", {
          source: "status-check",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stripe, clientSecret]);

  useEffect(() => {
    if (!stripe) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const clientSecretFromUrl = params.get("payment_intent_client_secret");

    if (!clientSecretFromUrl) return;

    let cancelled = false;

    (async () => {
      try {
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

        setError("O pagamento não ficou concluído. Tenta novamente.");
      } catch (err) {
        console.error("[PaymentForm] Erro a recuperar PaymentIntent do redirect:", err);
        if (!cancelled) setError("Não foi possível confirmar o estado do pagamento.");
      } finally {
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
            onClick={onRetry ?? (() => window.location.reload())}
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
            key={clientSecret ?? "payment-element"}
            options={{}}
            onReady={() => setElementReady(true)}
            onLoadError={(err) => {
              console.error("[PaymentElement] loaderror", err);
              setElementReady(false);
              notifyLoadErrorOnce(
                clientSecret,
                err?.error?.message ?? "Não foi possível carregar o formulário de pagamento. Tenta novamente.",
                { source: "payment-element" },
              );
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
