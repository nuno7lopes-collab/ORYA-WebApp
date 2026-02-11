"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { resolveLocale, t } from "@/lib/i18n";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { getStripePublishableKey } from "@/lib/stripePublic";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type InvitePayload = {
  invite: {
    id: number;
    token: string;
    targetName: string | null;
    targetContact: string | null;
    message: string | null;
    status: "PENDING" | "ACCEPTED" | "DECLINED";
    respondedAt: string | null;
  };
  booking: {
    id: number;
    startsAt: string;
    durationMinutes: number;
    status: string;
    locationFormattedAddress: string | null;
    snapshotTimezone: string | null;
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
  split: {
    id: number;
    status: "OPEN" | "COMPLETED" | "EXPIRED" | "CANCELLED";
    pricingMode: "FIXED" | "DYNAMIC";
    currency: string;
    totalCents: number;
    shareCents: number | null;
    deadlineAt: string | null;
    participant: {
      id: number;
      status: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED";
      baseShareCents: number;
      shareCents: number;
      platformFeeCents: number;
      paidAt: string | null;
    } | null;
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
  } catch (err) {
    return date.toLocaleString(locale, { dateStyle: "full", timeStyle: "short" });
  }
}

function formatTime(value: Date, locale: string, timeZone?: string | null) {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timeZone || undefined,
    }).format(value);
  } catch (err) {
    return value.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
}

function formatInviteStatus(status: string, locale: string) {
  if (status === "ACCEPTED") return t("serviceInviteStatusAccepted", locale);
  if (status === "DECLINED") return t("serviceInviteStatusDeclined", locale);
  return t("serviceInviteStatusPending", locale);
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

function InvitePaymentForm({
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

export default function InviteClient({ token }: { token: string }) {
  const searchParams = useSearchParams();
  const locale = resolveLocale(searchParams?.get("lang") ?? (typeof navigator !== "undefined" ? navigator.language : null));
  const { data, isLoading, mutate } = useSWR(token ? `/api/convites/${encodeURIComponent(token)}` : null, fetcher);
  const [actionLoading, setActionLoading] = useState<"accept" | "decline" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"mbway" | "card">("mbway");
  const [checkout, setCheckout] = useState<{ clientSecret: string; amountCents: number; currency: string; paymentIntentId: string } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const payload: InvitePayload | null = data?.ok ? (data.data as InvitePayload) : null;
  const loadError = data && data.ok === false ? data.message || data.error || t("serviceInviteLoadError", locale) : null;

  const schedule = useMemo(() => {
    if (!payload?.booking?.startsAt || !payload.booking.durationMinutes) return null;
    const start = new Date(payload.booking.startsAt);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + payload.booking.durationMinutes * 60 * 1000);
    return {
      start,
      end,
      timeZone: payload.booking.snapshotTimezone,
    };
  }, [payload?.booking]);

  const handleResponse = async (response: "accept" | "decline") => {
    if (actionLoading) return;
    setActionLoading(response);
    setActionError(null);
    try {
      const res = await fetch(`/api/convites/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || t("serviceInviteRespondError", locale));
      }
      await mutate();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("serviceInviteRespondError", locale);
      setActionError(message);
    } finally {
      setActionLoading(null);
    }
  };

  const startCheckout = async () => {
    if (!token || checkoutLoading) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const res = await fetch(`/api/convites/${encodeURIComponent(token)}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Não foi possível iniciar pagamento.");
      }
      setCheckout({
        clientSecret: json.clientSecret,
        amountCents: json.amountCents,
        currency: json.currency,
        paymentIntentId: json.paymentIntentId,
      });
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Não foi possível iniciar pagamento.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const status = payload?.invite?.status ?? null;
  const bookingStatus = payload?.booking?.status ?? null;
  const splitOpen = payload?.split?.status === "OPEN";
  const canRespond = status === "PENDING" && (bookingStatus === "CONFIRMED" || splitOpen);
  const statusLabel = status ? formatInviteStatus(status, locale) : null;
  const orgName =
    payload?.organization?.publicName || payload?.organization?.businessName || t("serviceInviteOrgFallback", locale);
  const serviceName = payload?.service?.title || t("serviceInviteServiceFallback", locale);
  const splitParticipant = payload?.split?.participant ?? null;
  const canPay =
    splitOpen &&
    splitParticipant &&
    splitParticipant.status === "PENDING" &&
    status !== "DECLINED";

  const stripePromise = useMemo(() => {
    try {
      return loadStripe(getStripePublishableKey());
    } catch {
      return null;
    }
  }, []);

  const elementsOptions = useMemo<StripeElementsOptions | null>(() => {
    if (!checkout?.clientSecret) return null;
    return {
      clientSecret: checkout.clientSecret,
      appearance: {
        theme: "night",
        variables: {
          colorPrimary: "#6BFFFF",
          colorBackground: "#0B0F18",
          colorText: "#F7F9FF",
          colorDanger: "#FF5C7A",
          fontFamily: "SF Pro Text, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          borderRadius: "14px",
        },
      },
    };
  }, [checkout?.clientSecret]);

  useEffect(() => {
    setCheckout(null);
    setCheckoutError(null);
  }, [paymentMethod]);

  return (
    <main className="min-h-screen w-full bg-[linear-gradient(180deg,#0b1014_0%,#0d1320_50%,#101826_100%)] text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">{t("serviceInviteKicker", locale)}</p>
          <h1 className="text-3xl font-semibold text-white">{serviceName}</h1>
          <p className="text-sm text-white/65">{t("serviceInviteSubtitle", locale)}</p>
        </div>

        <section className="rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          {isLoading && <div className="h-40 rounded-xl border border-white/10 orya-skeleton-surface animate-pulse" />}

          {!isLoading && loadError && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {loadError}
            </div>
          )}

          {!isLoading && !loadError && payload && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-white/10">
                  {payload.organization?.brandingAvatarUrl ? (
                    <Image
                      src={payload.organization.brandingAvatarUrl}
                      alt={orgName}
                      width={40}
                      height={40}
                      sizes="40px"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{orgName}</p>
                  {payload.organization?.addressRef?.formattedAddress && (
                    <p className="text-[12px] text-white/60">
                      {payload.organization.addressRef.formattedAddress}
                    </p>
                  )}
                </div>
                {statusLabel && (
                  <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/70">
                    {statusLabel}
                  </span>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                <p className="text-sm font-semibold text-white">{serviceName}</p>
                {schedule && (
                  <p className="text-[12px] text-white/70">
                    {formatDateTime(schedule.start.toISOString(), locale, schedule.timeZone)}
                    <span className="text-white/50">
                      {" "}
                      · {formatTime(schedule.start, locale, schedule.timeZone)} - {formatTime(schedule.end, locale, schedule.timeZone)}
                    </span>
                  </p>
                )}
                {payload.booking.locationFormattedAddress && (
                  <p className="text-[12px] text-white/60">{payload.booking.locationFormattedAddress}</p>
                )}
              </div>

              {payload.invite.message && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                  {payload.invite.message}
                </div>
              )}

              {actionError && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                  {actionError}
                </div>
              )}

              {bookingStatus !== "CONFIRMED" && !splitOpen && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  {t("serviceInviteNotConfirmed", locale)}
                </div>
              )}

              {payload.split && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70 space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Pagamento dividido</p>
                  {splitParticipant ? (
                    <div className="space-y-1">
                      <p className="text-white">
                        A tua parte:{" "}
                        <span className="font-semibold">
                          {formatMoney(splitParticipant.shareCents ?? splitParticipant.baseShareCents, payload.split.currency)}
                        </span>
                      </p>
                      {payload.split.deadlineAt && (
                        <p className="text-[12px] text-white/60">
                          Prazo: {formatDateTime(payload.split.deadlineAt, locale, payload.booking.snapshotTimezone)}
                        </p>
                      )}
                      {splitParticipant.status === "PAID" && splitParticipant.paidAt && (
                        <p className="text-[12px] text-emerald-200">
                          Pago em {formatDateTime(splitParticipant.paidAt, locale, payload.booking.snapshotTimezone)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[12px] text-white/60">Sem quota atribuída.</p>
                  )}
                </div>
              )}

              {checkoutError && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                  {checkoutError}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-[12px] text-emerald-100 hover:bg-emerald-400/15 disabled:opacity-60"
                  onClick={() => handleResponse("accept")}
                  disabled={!canRespond || actionLoading !== null}
                >
                  {actionLoading === "accept" ? t("serviceInviteAccepting", locale) : t("serviceInviteAccept", locale)}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-red-400/40 bg-red-500/10 px-4 py-2 text-[12px] text-red-100 hover:bg-red-500/20 disabled:opacity-60"
                  onClick={() => handleResponse("decline")}
                  disabled={!canRespond || actionLoading !== null}
                >
                  {actionLoading === "decline" ? t("serviceInviteDeclining", locale) : t("serviceInviteDecline", locale)}
                </button>
                {payload.organization?.username && (
                  <Link
                    href={`/${payload.organization.username}`}
                    className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] text-white/70 hover:border-white/40"
                  >
                    {t("serviceInviteViewOrg", locale)}
                  </Link>
                )}
              </div>

              {canPay && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`rounded-full border px-3 py-1 text-[12px] ${
                        paymentMethod === "mbway"
                          ? "border-white/40 bg-white/10 text-white"
                          : "border-white/15 bg-white/5 text-white/60 hover:border-white/30"
                      }`}
                      onClick={() => setPaymentMethod("mbway")}
                    >
                      MB WAY
                    </button>
                    <button
                      type="button"
                      className={`rounded-full border px-3 py-1 text-[12px] ${
                        paymentMethod === "card"
                          ? "border-white/40 bg-white/10 text-white"
                          : "border-white/15 bg-white/5 text-white/60 hover:border-white/30"
                      }`}
                      onClick={() => setPaymentMethod("card")}
                    >
                      Cartão
                    </button>
                  </div>

                  {!checkout && (
                    <button
                      type="button"
                      className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] text-white/80 hover:border-white/40 disabled:opacity-60"
                      onClick={startCheckout}
                      disabled={checkoutLoading}
                    >
                      {checkoutLoading ? "A preparar..." : "Pagar a minha parte"}
                    </button>
                  )}

                  {checkout && stripePromise && elementsOptions && (
                    <Elements stripe={stripePromise} options={elementsOptions}>
                      <InvitePaymentForm
                        amountCents={checkout.amountCents}
                        currency={checkout.currency}
                        onConfirmed={() => mutate()}
                        onError={setCheckoutError}
                      />
                    </Elements>
                  )}
                  {!stripePromise && (
                    <p className="text-[12px] text-red-200">Pagamentos indisponíveis neste momento.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
