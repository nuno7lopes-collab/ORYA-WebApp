"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { resolveLocale, t } from "@/lib/i18n";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { getStripePublishableKey } from "@/lib/stripePublic";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ChargePayload = {
  charge: {
    id: number;
    status: "OPEN" | "PAID" | "CANCELLED";
    kind: string;
    payerKind: string;
    label: string | null;
    amountCents: number;
    currency: string;
    paymentIntentId: string | null;
    paidAt: string | null;
    createdAt: string;
  };
  booking: {
    id: number;
    startsAt: string;
    durationMinutes: number;
    status: string;
    snapshotTimezone: string | null;
    locationFormattedAddress: string | null;
  };
  service: { id: number; title: string | null } | null;
  organization: {
    id: number;
    publicName: string | null;
    businessName: string | null;
    username: string | null;
    brandingAvatarUrl: string | null;
    addressRef?: { formattedAddress?: string | null } | null;
  } | null;
};

function formatDateTime(value: string, locale: string, timeZone?: string | null) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: timeZone || undefined,
    }).format(date);
  } catch {
    return date.toLocaleString(locale, { dateStyle: "full", timeStyle: "short" });
  }
}

function formatMoney(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
}

function ChargePaymentForm({
  amountCents,
  currency,
  onConfirmed,
  onError,
  disabled = false,
}: {
  amountCents: number;
  currency: string;
  onConfirmed: (paymentIntentId: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements || submitting || disabled) return;
    setSubmitting(true);
    onError("");

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
      });

      if (error) {
        onError(error.message || "Não foi possível processar o pagamento.");
        return;
      }

      if (!paymentIntent) {
        onError("Pagamento não confirmado.");
        return;
      }

      if (paymentIntent.status === "succeeded" || paymentIntent.status === "processing") {
        onConfirmed(paymentIntent.id);
        return;
      }

      onError("Pagamento não concluído.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Total</p>
        <p className="mt-1 text-xl font-semibold text-white">{formatMoney(amountCents, currency)}</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <PaymentElement />
      </div>
      <button
        type="button"
        className="group relative flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-[13px] font-semibold text-black shadow-[0_12px_36px_rgba(255,255,255,0.25)] transition hover:translate-y-[-1px] hover:shadow-[0_18px_50px_rgba(255,255,255,0.3)] disabled:opacity-60 disabled:hover:translate-y-0"
        onClick={handleSubmit}
        disabled={!stripe || !elements || submitting || disabled}
      >
        {submitting ? "A processar..." : "Pagar agora"}
      </button>
    </div>
  );
}

export default function ChargeClient({ token }: { token: string }) {
  const searchParams = useSearchParams();
  const locale = resolveLocale(searchParams?.get("lang") ?? (typeof navigator !== "undefined" ? navigator.language : null));
  const { data, isLoading, mutate } = useSWR(token ? `/api/cobrancas/${encodeURIComponent(token)}` : null, fetcher);
  const [checkout, setCheckout] = useState<{ clientSecret: string; amountCents: number; currency: string; paymentIntentId: string } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const payload: ChargePayload | null = data?.ok ? (data.data as ChargePayload) : null;
  const loadError = data && data.ok === false ? data.message || data.error || "Erro ao carregar cobrança" : null;

  const scheduleLabel = useMemo(() => {
    if (!payload?.booking?.startsAt) return null;
    return formatDateTime(payload.booking.startsAt, locale, payload.booking.snapshotTimezone);
  }, [payload?.booking?.startsAt, payload?.booking?.snapshotTimezone, locale]);

  const stripePromise = useMemo(() => {
    if (!checkout?.clientSecret) return null;
    const key = getStripePublishableKey();
    if (!key) return null;
    return loadStripe(key);
  }, [checkout?.clientSecret]);

  const elementsOptions: StripeElementsOptions | null = useMemo(() => {
    if (!checkout?.clientSecret) return null;
    return { clientSecret: checkout.clientSecret };
  }, [checkout?.clientSecret]);

  const startCheckout = async () => {
    if (!token || checkoutLoading) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const res = await fetch(`/api/cobrancas/${encodeURIComponent(token)}/checkout`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Não foi possível iniciar o pagamento.");
      }
      setCheckout({
        clientSecret: json.data.clientSecret,
        amountCents: json.data.amountCents,
        currency: json.data.currency,
        paymentIntentId: json.data.paymentIntentId,
      });
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Não foi possível iniciar o pagamento.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePaymentConfirmed = async () => {
    await mutate();
  };

  return (
    <main className="min-h-screen bg-[#0B0F16] px-4 py-12 text-white">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Cobrança extra</p>
          <h1 className="text-2xl font-semibold text-white">Pagamento adicional</h1>
          <p className="text-sm text-white/65">Conclui o pagamento para confirmar a cobrança extra.</p>
        </div>

        {isLoading && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">A carregar...</div>
        )}
        {!isLoading && loadError && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">{loadError}</div>
        )}

        {payload && (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center gap-3">
                {payload.organization?.brandingAvatarUrl && (
                  <Image
                    src={payload.organization.brandingAvatarUrl}
                    alt="avatar"
                    width={48}
                    height={48}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                )}
                <div>
                  <p className="text-sm text-white">
                    {payload.organization?.publicName || payload.organization?.businessName || "Organização"}
                  </p>
                  {payload.organization?.addressRef?.formattedAddress && (
                    <p className="text-[12px] text-white/60">
                      {payload.organization.addressRef.formattedAddress}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-white/70">
                <p>
                  Serviço: <span className="text-white">{payload.service?.title || "Serviço"}</span>
                </p>
                {scheduleLabel && (
                  <p>
                    Data: <span className="text-white">{scheduleLabel}</span>
                  </p>
                )}
                {payload.booking.locationFormattedAddress && (
                  <p>
                    Local: <span className="text-white">{payload.booking.locationFormattedAddress}</span>
                  </p>
                )}
                {payload.charge.label && (
                  <p>
                    Nota: <span className="text-white">{payload.charge.label}</span>
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
              {payload.charge.status === "PAID" ? (
                <div className="text-sm text-emerald-200">Cobrança paga. Obrigado!</div>
              ) : payload.charge.status === "CANCELLED" ? (
                <div className="text-sm text-red-200">Esta cobrança foi cancelada.</div>
              ) : (
                <>
                  {!checkout && (
                    <button
                      type="button"
                      className="w-full rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] text-white hover:bg-white/20 disabled:opacity-60"
                      onClick={startCheckout}
                      disabled={checkoutLoading}
                    >
                      {checkoutLoading ? "A preparar pagamento..." : "Continuar para pagamento"}
                    </button>
                  )}
                  {checkoutError && <p className="mt-2 text-[12px] text-red-200">{checkoutError}</p>}
                  {checkout && stripePromise && elementsOptions && (
                    <Elements stripe={stripePromise} options={elementsOptions}>
                      <div className="mt-4">
                        <ChargePaymentForm
                          amountCents={checkout.amountCents}
                          currency={checkout.currency}
                          onConfirmed={handlePaymentConfirmed}
                          onError={(msg) => setPaymentError(msg)}
                        />
                        {paymentError && <p className="mt-2 text-[12px] text-red-200">{paymentError}</p>}
                      </div>
                    </Elements>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
