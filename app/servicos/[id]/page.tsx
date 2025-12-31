"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useUser } from "@/app/hooks/useUser";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const pageClass = "min-h-screen w-full text-white";

const cardClass =
  "rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl";

type Service = {
  id: number;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  currency: string;
  policy: {
    id: number;
    name: string;
    policyType: string;
    cancellationWindowMinutes: number | null;
  } | null;
  organizer: {
    id: number;
    publicName: string | null;
    businessName: string | null;
    city: string | null;
    username: string | null;
    brandingAvatarUrl: string | null;
    publicDescription: string | null;
    publicWebsite: string | null;
    publicInstagram: string | null;
  };
};

type Availability = {
  id: number;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  status: string;
};

type CheckoutResponse = {
  ok: boolean;
  booking?: { id: number; status: string };
  policy?: Service["policy"] | null;
  amountCents?: number;
  currency?: string;
  paymentIntentId?: string | null;
  clientSecret?: string | null;
  free?: boolean;
  reused?: boolean;
  error?: string;
  message?: string;
};

type CheckoutStatusResponse = {
  ok: boolean;
  status?: string;
  final?: boolean;
  booking?: {
    id: number;
    status: string;
    startsAt: string;
    durationMinutes: number;
    price: number;
    currency: string;
  };
  policy?: Service["policy"] | null;
  error?: string;
};

type CheckoutState = {
  availabilityId: number;
  bookingId: number;
  amountCents: number;
  currency: string;
  paymentIntentId: string | null;
  clientSecret: string | null;
  policy: Service["policy"] | null;
  status: "READY" | "PROCESSING";
};

type PaymentFormProps = {
  amountCents: number;
  currency: string;
  onConfirmed: (paymentIntentId: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
};

function ServicePaymentForm({
  amountCents,
  currency,
  onConfirmed,
  onError,
  disabled = false,
}: PaymentFormProps) {
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

      if (
        paymentIntent.status === "succeeded" ||
        paymentIntent.status === "processing" ||
        paymentIntent.status === "requires_action"
      ) {
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
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
        <p className="font-semibold text-white">Total</p>
        <p className="text-[12px] text-white/65">
          {(amountCents / 100).toFixed(2)} {currency}
        </p>
      </div>
      <PaymentElement />
      <button
        type="button"
        className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 disabled:opacity-60"
        onClick={handleSubmit}
        disabled={!stripe || !elements || submitting || disabled}
      >
        {submitting ? "A processar..." : "Pagar e confirmar"}
      </button>
    </div>
  );
}

export default function ServicoDetalhePublicoPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const idRaw = params?.id;
  const serviceId = useMemo(() => {
    const value = Array.isArray(idRaw) ? idRaw[0] : idRaw;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }, [idRaw]);

  const { data: serviceData } = useSWR<{ ok: boolean; service: Service }>(
    serviceId ? `/api/servicos/${serviceId}` : null,
    fetcher,
  );
  const { data: availabilityData, mutate: mutateAvailability } = useSWR<{ ok: boolean; items: Availability[] }>(
    serviceId ? `/api/servicos/${serviceId}/disponibilidade` : null,
    fetcher,
  );

  const service = serviceData?.service;
  const availabilities = availabilityData?.items ?? [];

  const stripePromise = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    return key ? loadStripe(key) : null;
  }, []);

  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState<number | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<{
    bookingId: number;
    startsAt: string;
    policyName: string | null;
    policyWindow: number | null;
  } | null>(null);
  const [checkoutState, setCheckoutState] = useState<CheckoutState | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const resumeHandledRef = useRef(false);

  const resumeAvailabilityId = useMemo(() => {
    const raw = searchParams?.get("availabilityId") ?? searchParams?.get("availability") ?? null;
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    resumeHandledRef.current = false;
  }, [resumeAvailabilityId, serviceId]);

  const reserve = async (availabilityId: number) => {
    if (!serviceId) return;
    if (!user) {
      router.push(`/login?redirectTo=/servicos/${serviceId}`);
      return;
    }

    setBookingLoading(availabilityId);
    setBookingError(null);
    setBookingSuccess(null);
    setPaymentError(null);

    try {
      const res = await fetch(`/api/servicos/${serviceId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availabilityId }),
      });
      const json = (await res.json().catch(() => null)) as CheckoutResponse | null;
      if (!res.ok || !json?.ok) {
        const message = json?.error === "SEM_VAGAS" ? "Sem vagas disponíveis." : "Não foi possível reservar.";
        throw new Error(message);
      }
      if (json.free && json.booking) {
        setBookingSuccess({
          bookingId: json.booking.id,
          startsAt: availabilities.find((slot) => slot.id === availabilityId)?.startsAt ?? "",
          policyName: json.policy?.name ?? service?.policy?.name ?? null,
          policyWindow: json.policy?.cancellationWindowMinutes ?? service?.policy?.cancellationWindowMinutes ?? null,
        });
        setCheckoutState(null);
      } else if (json?.booking) {
        setCheckoutState({
          availabilityId,
          bookingId: json.booking.id,
          amountCents: json.amountCents ?? service?.price ?? 0,
          currency: json.currency ?? service?.currency ?? "EUR",
          paymentIntentId: json.paymentIntentId ?? null,
          clientSecret: json.clientSecret ?? null,
          policy: json.policy ?? service?.policy ?? null,
          status: "READY",
        });
      }
      mutateAvailability();
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Não foi possível reservar.");
      setCheckoutState(null);
    } finally {
      setBookingLoading(null);
    }
  };

  useEffect(() => {
    if (!resumeAvailabilityId || !serviceId || !user) return;
    if (resumeHandledRef.current) return;
    if (checkoutState?.availabilityId === resumeAvailabilityId) return;
    resumeHandledRef.current = true;
    reserve(resumeAvailabilityId);
  }, [checkoutState?.availabilityId, resumeAvailabilityId, reserve, serviceId, user]);

  const pollBookingStatus = async (paymentIntentId: string, attempt = 0) => {
    if (!paymentIntentId) return;
    try {
      const res = await fetch(
        `/api/servicos/checkout/status?paymentIntentId=${encodeURIComponent(paymentIntentId)}`,
      );
      const json = (await res.json().catch(() => null)) as CheckoutStatusResponse | null;
      if (res.ok && json?.ok && json.booking) {
        if (json.booking.status === "CONFIRMED") {
          setBookingSuccess({
            bookingId: json.booking.id,
            startsAt: json.booking.startsAt,
            policyName: json.policy?.name ?? service?.policy?.name ?? null,
            policyWindow:
              json.policy?.cancellationWindowMinutes ??
              service?.policy?.cancellationWindowMinutes ??
              null,
          });
          setCheckoutState(null);
          mutateAvailability();
          return;
        }
        if (json.booking.status === "CANCELLED") {
          setBookingError("Reserva cancelada. Contacta o suporte se já pagaste.");
          setCheckoutState(null);
          return;
        }
      }
    } catch (err) {
      console.error("pollBookingStatus error", err);
    }

    if (attempt < 6) {
      pollTimerRef.current = window.setTimeout(() => {
        pollBookingStatus(paymentIntentId, attempt + 1);
      }, 1500);
      return;
    }

    setBookingError("Reserva em confirmação. Atualiza em instantes.");
  };

  const handlePaymentConfirmed = (paymentIntentId: string) => {
    setCheckoutState((prev) =>
      prev
        ? {
            ...prev,
            status: "PROCESSING",
            paymentIntentId: paymentIntentId || prev.paymentIntentId,
          }
        : prev,
    );
    pollBookingStatus(paymentIntentId);
  };

  const elementsOptions = useMemo<StripeElementsOptions | null>(() => {
    if (!checkoutState?.clientSecret) return null;
    return {
      clientSecret: checkoutState.clientSecret,
      appearance: {
        theme: "night",
        variables: {
          colorPrimary: "#6BFFFF",
          colorBackground: "#0B0D0F",
          colorText: "#F8FAFC",
          fontFamily: "inherit",
        },
      },
    };
  }, [checkoutState?.clientSecret]);

  if (!serviceId) {
    return <main className={pageClass}>Serviço inválido.</main>;
  }

  return (
    <main className={pageClass}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Serviço</p>
          <h1 className="text-3xl font-semibold text-white">{service?.name || "Serviço"}</h1>
          <p className="text-sm text-white/65">
            {service
              ? `${service.durationMinutes} min · ${(service.price / 100).toFixed(2)} ${service.currency}`
              : "A carregar detalhes..."}
          </p>
        </div>

        <section className={cardClass}>
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-white">Sobre</h2>
            <p className="text-sm text-white/70">
              {service?.description || "Sem descrição adicional."}
            </p>
          </div>
          {service?.policy && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
              <p className="font-semibold text-white">Política de cancelamento</p>
              <p className="text-[12px] text-white/65">
                {service.policy.name}
                {service.policy.cancellationWindowMinutes
                  ? ` · Cancelamento até ${Math.round(service.policy.cancellationWindowMinutes / 60)}h antes`
                  : ""}
              </p>
            </div>
          )}
          {service?.organizer && (
            <div className="mt-4 border-t border-white/10 pt-4 text-sm text-white/70">
              <p className="font-semibold text-white">
                {service.organizer.publicName || service.organizer.businessName || "Organização"}
              </p>
              <p>{service.organizer.city || "Cidade não definida"}</p>
              {service.organizer.publicWebsite && (
                <a href={service.organizer.publicWebsite} className="text-[#6BFFFF]" target="_blank" rel="noreferrer">
                  Website
                </a>
              )}
            </div>
          )}
        </section>

        <section className={cardClass}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Horários disponíveis</h2>
              <p className="text-sm text-white/65">Escolhe um horário para reservar.</p>
            </div>
          </div>

          {bookingSuccess && (
            <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-50">
              <p className="font-semibold">Reserva confirmada.</p>
              <p className="text-[12px] text-emerald-50/80">
                Horário:{" "}
                {bookingSuccess.startsAt
                  ? new Date(bookingSuccess.startsAt).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })
                  : "a confirmar"}
              </p>
              {bookingSuccess.policyName && (
                <p className="text-[12px] text-emerald-50/80">
                  Política: {bookingSuccess.policyName}
                  {bookingSuccess.policyWindow
                    ? ` · ${Math.round(bookingSuccess.policyWindow / 60)}h`
                    : ""}
                </p>
              )}
              <div className="mt-2">
                <Link
                  href="/me/reservas"
                  className="inline-flex items-center rounded-full border border-emerald-200/40 bg-emerald-400/10 px-3 py-1 text-[12px] text-emerald-50 hover:bg-emerald-400/20"
                >
                  Ver minhas reservas
                </Link>
              </div>
            </div>
          )}

          {bookingError && (
            <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {bookingError}
            </div>
          )}

          {checkoutState && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">Pagamento da reserva</p>
                  <p className="text-[12px] text-white/60">
                    {new Date(
                      availabilities.find((slot) => slot.id === checkoutState.availabilityId)?.startsAt ??
                        new Date().toISOString(),
                    ).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[12px] text-white/70">
                  {(checkoutState.amountCents / 100).toFixed(2)} {checkoutState.currency}
                </span>
              </div>

              {checkoutState.policy && (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/70">
                  Política: {checkoutState.policy.name}
                  {checkoutState.policy.cancellationWindowMinutes
                    ? ` · ${Math.round(checkoutState.policy.cancellationWindowMinutes / 60)}h`
                    : ""}
                </div>
              )}

              {checkoutState.status === "PROCESSING" && (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                  Pagamento confirmado. A finalizar a reserva...
                </div>
              )}

              {paymentError && (
                <div className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                  {paymentError}
                </div>
              )}

              <div className="mt-4">
                {checkoutState.clientSecret && stripePromise && elementsOptions ? (
                  <Elements stripe={stripePromise} options={elementsOptions}>
                    <ServicePaymentForm
                      amountCents={checkoutState.amountCents}
                      currency={checkoutState.currency}
                      onConfirmed={handlePaymentConfirmed}
                      onError={(message) => setPaymentError(message || null)}
                      disabled={checkoutState.status === "PROCESSING"}
                    />
                  </Elements>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                    Pagamento indisponível. Tenta novamente.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {availabilities.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                Sem horários disponíveis.
              </div>
            )}
            {availabilities.map((slot) => {
              const isCheckoutSlot = checkoutState?.availabilityId === slot.id;
              const isDisabled = bookingLoading === slot.id || Boolean(checkoutState && !isCheckoutSlot);
              const label = bookingLoading === slot.id ? "A reservar..." : isCheckoutSlot ? "Continuar pagamento" : "Reservar";
              return (
                <div key={slot.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {new Date(slot.startsAt).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                      <p className="text-[12px] text-white/60">{slot.durationMinutes} min · {slot.capacity} vagas</p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] text-white hover:bg-white/20 disabled:opacity-60"
                      onClick={() => {
                        if (isCheckoutSlot) return;
                        reserve(slot.id);
                      }}
                      disabled={isDisabled}
                    >
                      {label}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
