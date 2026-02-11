"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import TicketLiveQr from "@/app/components/tickets/TicketLiveQr";
import useSWR from "swr";
import { resolveLocale, t } from "@/lib/i18n";

type TicketDetail = {
  entitlementId: string;
  status: string;
  type: string;
  snapshot: {
    title: string;
    coverUrl?: string | null;
    venueName?: string | null;
    startAt?: string | null;
    timezone?: string | null;
  };
  actions: {
    canShowQr?: boolean;
    canCheckIn?: boolean;
    canClaim?: boolean;
  };
  qrToken?: string | null;
  pairing?: {
    id: number;
    paymentMode: string;
    pairingStatus: string;
    lifecycleStatus: string;
    createdByUserId?: string | null;
    slots: Array<{ slotRole: string; slotStatus: string; paymentStatus: string }>;
  } | null;
  pairingActions?: {
    canAccept: boolean;
    canDecline: boolean;
    canPay: boolean;
    userSlotRole: string | null;
  } | null;
  payment?: {
    totalPaidCents: number;
    platformFeeCents: number;
    cardPlatformFeeCents: number;
    stripeFeeCents: number;
    feesTotalCents: number;
    netCents: number;
    currency: string;
    status: string | null;
    feeMode: string | null;
    paymentMethod: string | null;
  } | null;
  refund?: {
    baseAmountCents: number;
    feesExcludedCents: number;
    refundedAt: string | null;
    reason: string | null;
  } | null;
  event?: {
    id: number;
    slug: string;
    organizationName?: string | null;
    organizationUsername?: string | null;
  } | null;
  audit?: {
    updatedAt?: string | null;
    createdAt?: string | null;
  };
};

type InviteStatus = {
  ok: boolean;
  pairingId: number;
  state:
    | "AWAITING_PAYMENT"
    | "AWAITING_ACCEPT"
    | "CONFIRMED"
    | "EXPIRED"
    | "CANCELLED"
    | "ACTION_REQUIRED";
  statusLabel: string;
  statusHint?: string | null;
  requiredAction?: "PAY" | "ACCEPT" | "ONBOARD" | "WAIT_PARTNER" | "SUPPORT" | "NONE";
  blockingReason?: string | null;
  blockingDetails?: {
    reason: string;
    message: string;
    captainGender?: string | null;
    partnerGender?: string | null;
    eligibilityType?: string | null;
    categoryRestriction?: string | null;
  } | null;
  viewerRole?: "INVITED" | "CAPTAIN";
  paymentMode?: string | null;
  deadlineAt?: string | null;
  actions: {
    canPay: boolean;
    canAccept: boolean;
    canDecline: boolean;
    canSwap?: boolean;
    canCancel?: boolean;
    canReinvite?: boolean;
    canMatchmake?: boolean;
    canRefreshInvite?: boolean;
  };
  urls: {
    payUrl?: string | null;
    acceptUrl?: string | null;
    declineUrl?: string | null;
    inviteUrl?: string | null;
    inviteRefreshUrl?: string | null;
    onboardingUrl?: string | null;
    swapUrl?: string | null;
    cancelUrl?: string | null;
    reopenUrl?: string | null;
  };
  participants?: {
    captain?: { name?: string | null; paid?: boolean; slotStatus?: string | null };
    partner?: { name?: string | null; invitedContact?: string | null; paid?: boolean; slotStatus?: string | null };
  };
  amounts?: { unitPriceCents?: number | null; amountDueCents?: number | null; currency?: string | null };
};

type Props = {
  entitlementId: string;
};

function formatDateTime(iso: string | null | undefined, locale: string) {
  if (!iso) return t("dateTbd", locale);
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return t("dateTbd", locale);
  return date.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

function formatMoney(cents: number | null | undefined, currency: string | null | undefined, locale: string) {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "—";
  return (cents / 100).toLocaleString(locale, {
    style: "currency",
    currency: currency ?? "EUR",
  });
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function TicketDetailClient({ entitlementId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = resolveLocale(searchParams?.get("lang") ?? (typeof navigator !== "undefined" ? navigator.language : null));
  const { user } = useUser();
  const { openModal: openAuthModal } = useAuthModal();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [pairingActionError, setPairingActionError] = useState<string | null>(null);
  const [pairingActionMessage, setPairingActionMessage] = useState<string | null>(null);
  const [pairingBusy, setPairingBusy] = useState(false);

  const fetchTicket = async () => {
    setLoading(true);
    setErrorMsg(null);
    setAuthRequired(false);
    try {
      const res = await fetch(`/api/me/wallet/${encodeURIComponent(entitlementId)}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 401) {
          setAuthRequired(true);
          throw new Error(t("ticketAuthRequiredError", locale));
        }
        throw new Error(text || t("ticketLoadErrorDefault", locale));
      }
      const data = (await res.json()) as TicketDetail;
      setTicket(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t("ticketLoadErrorGeneric", locale));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
  }, [entitlementId]);

  const pairingId = ticket?.pairing?.id ?? null;
  const { data: pairingStatus, mutate: mutatePairing } = useSWR<InviteStatus>(
    pairingId ? `/api/padel/pairings/invite-status?pairingId=${pairingId}` : null,
    fetcher,
  );
  const pairingState = pairingStatus?.ok ? pairingStatus : null;
  const payLabel =
    pairingState?.viewerRole === "CAPTAIN"
      ? pairingState.paymentMode === "FULL"
        ? t("pairingPayRegistration", locale)
        : t("pairingPayPartner", locale)
      : t("pairingPayInvite", locale);

  const pairingPayUrl = useMemo(() => {
    if (!ticket?.pairing || !ticket?.event?.slug) return null;
    return `/eventos/${ticket.event.slug}?pairingId=${ticket.pairing.id}`;
  }, [ticket?.pairing, ticket?.event?.slug]);

  function resolvePairingError(raw: string) {
    try {
      const parsed = JSON.parse(raw) as { error?: string } | null;
      if (parsed?.error) return resolvePairingError(parsed.error);
    } catch {
      // ignore
    }
    const code = raw.replace(/[^\w_]/g, "").trim();
    const map: Record<string, string> = {
      PAYMENT_REQUIRED: t("pairingErrorPaymentRequired", locale),
      CATEGORY_GENDER_MISMATCH: t("pairingErrorCategoryGenderMismatch", locale),
      CATEGORY_LEVEL_MISMATCH: t("pairingErrorCategoryLevelMismatch", locale),
      GENDER_MISMATCH: t("pairingErrorGenderMismatch", locale),
      PADEL_ONBOARDING_REQUIRED: t("pairingErrorOnboardingRequired", locale),
      PROFILE_INCOMPLETE: t("pairingErrorProfileIncomplete", locale),
      PAIRING_EXPIRED: t("pairingErrorPairingExpired", locale),
      PAIRING_CANCELLED: t("pairingErrorPairingCancelled", locale),
      INVITE_EXPIRED: t("pairingErrorInviteExpired", locale),
      NO_PENDING_SLOT: t("pairingErrorNoPendingSlot", locale),
      SLOT_ALREADY_PAID: t("pairingErrorSlotAlreadyPaid", locale),
      SWAP_NOT_ALLOWED: t("pairingErrorSwapNotAllowed", locale),
      PARTNER_LOCKED: t("pairingErrorPartnerLocked", locale),
      FORBIDDEN: t("pairingErrorForbidden", locale),
    };
    return map[code] ?? t("pairingErrorDefault", locale);
  }

  const handlePairingAction = async (
    url?: string | null,
    options?: { redirectTo?: string; body?: Record<string, unknown> },
  ) => {
    if (!url) return;
    setPairingBusy(true);
    setPairingActionError(null);
    setPairingActionMessage(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: options?.body ? { "Content-Type": "application/json" } : undefined,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(resolvePairingError(text || ""));
      }
      await mutatePairing();
      await fetchTicket();
      if (options?.redirectTo) {
        router.replace(options.redirectTo);
      }
    } catch (err) {
      setPairingActionError(err instanceof Error ? err.message : t("pairingActionError", locale));
    } finally {
      setPairingBusy(false);
    }
  };

  const handleCopyInvite = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setPairingActionMessage(t("pairingCopySuccess", locale));
      setPairingActionError(null);
    } catch {
      setPairingActionError(t("pairingCopyError", locale));
    }
  };

  if (!user || authRequired) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#0b1014_0%,#0d1320_50%,#101826_100%)] text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.4em] text-white/55">{t("ticketAuthKicker", locale)}</p>
          <h1 className="mt-4 text-3xl font-semibold">{t("ticketAuthTitle", locale)}</h1>
          <p className="mt-3 text-sm text-white/70">{t("ticketAuthBody", locale)}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() =>
                openAuthModal({ mode: "login", redirectTo: `/me/bilhetes/${entitlementId}`, showGoogle: true })
              }
              className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black"
            >
              {t("ticketAuthLogin", locale)}
            </button>
            <button
              type="button"
              onClick={() =>
                openAuthModal({ mode: "signup", redirectTo: `/me/bilhetes/${entitlementId}`, showGoogle: true })
              }
              className="rounded-full border border-white/30 px-6 py-2 text-sm text-white"
            >
              {t("ticketAuthSignup", locale)}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#0b1014_0%,#0d1320_50%,#101826_100%)] text-white">
      <div className="mx-auto w-full max-w-5xl px-6 pb-16 pt-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/55">{t("ticketHeaderLabel", locale)}</p>
            <h1 className="text-2xl font-semibold">{ticket?.snapshot?.title ?? t("ticketTitleFallback", locale)}</h1>
            <p className="text-sm text-white/65">{ticket?.snapshot?.venueName ?? t("ticketVenueTbd", locale)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/me/carteira"
              className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/75 hover:bg-white/10"
            >
              {t("ticketBackWallet", locale)}
            </Link>
            {ticket?.event?.slug && (
              <Link
                href={`/eventos/${ticket.event.slug}`}
                className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/75 hover:bg-white/10"
              >
                {t("ticketViewEvent", locale)}
              </Link>
            )}
          </div>
        </header>

        {loading && <p className="mt-6 text-sm text-white/70">{t("ticketLoading", locale)}</p>}
        {errorMsg && !loading && (
          <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
            {errorMsg}
          </div>
        )}

        {!loading && ticket && (
          <>
            <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_55px_rgba(0,0,0,0.5)]">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">{t("ticketSectionSummary", locale)}</p>
                <h2 className="mt-2 text-lg font-semibold">{t("ticketSectionDetails", locale)}</h2>
                <div className="mt-4 space-y-2 text-sm text-white/75">
                  <p>
                    <span className="text-white/50">{t("ticketLabelDate", locale)}</span> · {formatDateTime(ticket.snapshot?.startAt, locale)}
                  </p>
                  <p>
                    <span className="text-white/50">{t("ticketLabelStatus", locale)}</span> · {ticket.status}
                  </p>
                  <p>
                    <span className="text-white/50">{t("ticketLabelType", locale)}</span> · {ticket.type}
                  </p>
                  {ticket.event?.organizationName && (
                    <p>
                      <span className="text-white/50">{t("ticketLabelOrganizer", locale)}</span> · {ticket.event.organizationName}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/60">
                  <span className="rounded-full border border-white/20 px-3 py-1">ID {ticket.entitlementId}</span>
                  {ticket.audit?.updatedAt && (
                    <span className="rounded-full border border-white/20 px-3 py-1">
                      {t("ticketUpdatedPrefix", locale)} {formatDateTime(ticket.audit.updatedAt, locale)}
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-center">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">{t("ticketCheckinTitle", locale)}</p>
                <h2 className="mt-2 text-lg font-semibold">{t("ticketQrTitle", locale)}</h2>
                <div className="mt-4 flex items-center justify-center">
                  {ticket.actions?.canShowQr && ticket.qrToken ? (
                    <TicketLiveQr qrToken={ticket.qrToken} />
                  ) : (
                    <div className="rounded-2xl border border-white/15 bg-black/30 px-6 py-8 text-sm text-white/65">
                      {t("ticketQrUnavailable", locale)}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {ticket.payment && (
              <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">{t("ticketPaymentTitle", locale)}</p>
                    <h2 className="text-lg font-semibold">{t("ticketPaymentSubtitle", locale)}</h2>
                  </div>
                  {ticket.payment.status && (
                    <span className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/70">
                      {ticket.payment.status}
                    </span>
                  )}
                </div>
                <div className="mt-4 grid gap-3 text-[12px] text-white/75 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">{t("ticketPaymentPaid", locale)}</p>
                    <p className="text-sm font-semibold text-white/90">
                      {formatMoney(ticket.payment.totalPaidCents, ticket.payment.currency, locale)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">{t("ticketPaymentNet", locale)}</p>
                    <p className="text-sm font-semibold text-white/90">
                      {formatMoney(ticket.payment.netCents, ticket.payment.currency, locale)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 text-[12px] text-white/70 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">{t("ticketPaymentPlatformFee", locale)}</p>
                    <p className="text-sm font-semibold text-white/90">
                      {formatMoney(ticket.payment.platformFeeCents, ticket.payment.currency, locale)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">{t("ticketPaymentCardFee", locale)}</p>
                    <p className="text-sm font-semibold text-white/90">
                      {formatMoney(ticket.payment.cardPlatformFeeCents, ticket.payment.currency, locale)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">{t("ticketPaymentProcessingFee", locale)}</p>
                    <p className="text-sm font-semibold text-white/90">
                      {formatMoney(ticket.payment.stripeFeeCents, ticket.payment.currency, locale)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 text-[12px] text-white/70">
                  {t("ticketPaymentFeesTotal", locale)}:{" "}
                  <span className="text-white">
                    {formatMoney(ticket.payment.feesTotalCents, ticket.payment.currency, locale)}
                  </span>
                </div>

                {ticket.refund && (
                  <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-[12px] text-emerald-50">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-200">{t("ticketRefundTitle", locale)}</p>
                    <p className="mt-1">
                      {t("ticketRefundAmount", locale)}:{" "}
                      <span className="font-semibold">
                        {formatMoney(ticket.refund.baseAmountCents, ticket.payment.currency, locale)}
                      </span>
                    </p>
                    <p>
                      {t("ticketRefundFeesExcluded", locale)}:{" "}
                      <span className="font-semibold">
                        {formatMoney(ticket.refund.feesExcludedCents, ticket.payment.currency, locale)}
                      </span>
                    </p>
                    {ticket.refund.refundedAt && (
                      <p className="text-[11px] text-emerald-100/80">
                        {t("ticketRefundProcessed", locale)} {formatDateTime(ticket.refund.refundedAt, locale)}
                      </p>
                    )}
                  </div>
                )}
              </section>
            )}

            {ticket.pairing && (
              <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">{t("pairingSectionTitle", locale)}</p>
                    <h2 className="text-lg font-semibold">{t("pairingSectionSubtitle", locale)}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-white/60">
                    <span className="rounded-full border border-white/20 px-3 py-1">
                      {pairingState?.statusLabel ?? ticket.pairing.pairingStatus}
                    </span>
                    <span className="rounded-full border border-white/20 px-3 py-1">
                      {ticket.pairing.lifecycleStatus}
                    </span>
                    <span className="rounded-full border border-white/20 px-3 py-1">
                      {ticket.pairing.paymentMode}
                    </span>
                  </div>
                </div>

                {pairingState?.statusHint && (
                  <p className="mt-2 text-[12px] text-white/65">{pairingState.statusHint}</p>
                )}
                {!pairingState?.statusHint && pairingState?.blockingDetails?.message && (
                  <p className="mt-2 text-[12px] text-white/65">{pairingState.blockingDetails.message}</p>
                )}

                {pairingState?.participants ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">{t("pairingRoleCaptain", locale)}</p>
                      <p className="text-sm font-semibold text-white/90">
                        {pairingState.participants.captain?.name ?? t("pairingRoleCaptain", locale)}
                      </p>
                      <p className="text-[12px] text-white/60">
                        {pairingState.participants.captain?.paid
                          ? t("pairingPaidLabel", locale)
                          : t("pairingPaymentPendingLabel", locale)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">{t("pairingRolePartner", locale)}</p>
                      <p className="text-sm font-semibold text-white/90">
                        {pairingState.participants.partner?.name ?? t("pairingRolePartner", locale)}
                      </p>
                      <p className="text-[12px] text-white/60">
                        {pairingState.participants.partner?.paid
                          ? t("pairingPaidLabel", locale)
                          : t("pairingPaymentPendingLabel", locale)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {ticket.pairing.slots.map((slot, idx) => (
                      <div
                        key={`${slot.slotRole}-${idx}`}
                        className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75"
                      >
                        <p className="text-sm font-semibold text-white/90">{slot.slotRole}</p>
                        <p className="text-[12px] text-white/60">
                          {t("ticketSlotStatusLabel", locale)}: {slot.slotStatus}
                        </p>
                        <p className="text-[12px] text-white/60">
                          {t("ticketSlotPaymentLabel", locale)}: {slot.paymentStatus}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {pairingState?.amounts?.amountDueCents !== null &&
                  pairingState?.amounts?.amountDueCents !== undefined && (
                    <p className="mt-3 text-[12px] text-white/70">
                      {t("pairingPendingAmountLabel", locale)}:{" "}
                      <span className="text-white">
                        {(pairingState.amounts.amountDueCents / 100).toLocaleString(locale, {
                          style: "currency",
                          currency: pairingState.amounts.currency ?? "EUR",
                        })}
                      </span>
                    </p>
                  )}

                {pairingState?.deadlineAt && (
                  <p className="mt-2 text-[11px] text-white/55">
                    {t("pairingPaymentDeadlineLabel", locale)}: {formatDateTime(pairingState.deadlineAt, locale)}
                  </p>
                )}

                {pairingActionError && (
                  <p className="mt-3 rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-[12px] text-rose-100">
                    {pairingActionError}
                  </p>
                )}
                {pairingActionMessage && !pairingActionError && (
                  <p className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-[12px] text-emerald-100">
                    {pairingActionMessage}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {pairingState?.requiredAction === "ONBOARD" && pairingState.urls?.onboardingUrl && (
                    <Link
                      href={pairingState.urls.onboardingUrl}
                      className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black"
                    >
                      {t("pairingActionCompleteProfile", locale)}
                    </Link>
                  )}
                  {pairingState?.requiredAction === "PAY" && (pairingState.urls?.payUrl || pairingPayUrl) && (
                    <Link
                      href={pairingState.urls?.payUrl ?? pairingPayUrl ?? "#"}
                      className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black"
                    >
                      {payLabel}
                    </Link>
                  )}
                  {pairingState?.actions?.canPay &&
                    pairingState?.requiredAction !== "PAY" &&
                    (pairingState.urls?.payUrl || pairingPayUrl) && (
                      <Link
                        href={pairingState.urls?.payUrl ?? pairingPayUrl ?? "#"}
                        className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black"
                      >
                        {payLabel}
                      </Link>
                    )}
                  {pairingState?.requiredAction === "SUPPORT" && (
                    <span className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/70">
                      {t("pairingActionSupportRequired", locale)}
                    </span>
                  )}
                  {pairingState?.actions?.canAccept && (
                    <button
                      type="button"
                      onClick={() => handlePairingAction(pairingState.urls?.acceptUrl)}
                      disabled={pairingBusy}
                      className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-black disabled:opacity-60"
                    >
                      {t("pairingActionAccept", locale)}
                    </button>
                  )}
                  {pairingState?.actions?.canDecline && (
                    <button
                      type="button"
                      onClick={() => handlePairingAction(pairingState.urls?.declineUrl, { redirectTo: "/me/carteira" })}
                      disabled={pairingBusy}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 disabled:opacity-60"
                    >
                      {t("pairingActionDecline", locale)}
                    </button>
                  )}
                  {pairingState?.actions?.canSwap && (
                    <button
                      type="button"
                      onClick={() => handlePairingAction(pairingState.urls?.swapUrl)}
                      disabled={pairingBusy}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 disabled:opacity-60"
                    >
                      {t("pairingActionSwap", locale)}
                    </button>
                  )}
                  {pairingState?.actions?.canCancel && (
                    <button
                      type="button"
                      onClick={() => handlePairingAction(pairingState.urls?.cancelUrl, { redirectTo: "/me/carteira" })}
                      disabled={pairingBusy}
                      className="rounded-full border border-rose-300/30 bg-rose-400/10 px-4 py-2 text-xs text-rose-100 disabled:opacity-60"
                    >
                      {t("pairingActionCancel", locale)}
                    </button>
                  )}
                  {pairingState?.actions?.canReinvite && pairingState.urls?.reopenUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        handlePairingAction(pairingState.urls?.reopenUrl, {
                          body: { mode: "INVITE_PARTNER" },
                        })
                      }
                      disabled={pairingBusy}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 disabled:opacity-60"
                    >
                      {t("pairingActionReinvite", locale)}
                    </button>
                  )}
                  {pairingState?.actions?.canMatchmake && pairingState.urls?.reopenUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        handlePairingAction(pairingState.urls?.reopenUrl, {
                          body: { mode: "LOOKING_FOR_PARTNER" },
                        })
                      }
                      disabled={pairingBusy}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 disabled:opacity-60"
                    >
                      {t("pairingActionMatchmake", locale)}
                    </button>
                  )}
                  {pairingState?.actions?.canRefreshInvite && pairingState.urls?.inviteRefreshUrl && (
                    <button
                      type="button"
                      onClick={() => handlePairingAction(pairingState.urls?.inviteRefreshUrl)}
                      disabled={pairingBusy}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 disabled:opacity-60"
                    >
                      {t("pairingActionRefreshInvite", locale)}
                    </button>
                  )}
                  {pairingState?.urls?.inviteUrl && pairingState.viewerRole === "CAPTAIN" && (
                    <button
                      type="button"
                      onClick={() => handleCopyInvite(pairingState.urls?.inviteUrl ?? "")}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/80"
                    >
                      {t("pairingActionCopyInvite", locale)}
                    </button>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
