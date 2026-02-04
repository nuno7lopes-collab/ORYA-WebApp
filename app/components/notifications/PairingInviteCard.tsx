"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import { resolveLocale, t } from "@/lib/i18n";

type NotificationPayload = Record<string, unknown> | null | undefined;

type InviteStatusResponse = {
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
  pairingJoinMode?: string | null;
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
    detailUrl?: string | null;
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

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function extractPairingId(payload: NotificationPayload): number | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = (payload as Record<string, unknown>).pairingId;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() && Number.isFinite(Number(raw))) return Number(raw);
  return null;
}

type Props = {
  title: string;
  body?: string | null;
  payload?: NotificationPayload;
  fallbackUrl?: string | null;
  fallbackLabel?: string | null;
  compact?: boolean;
};

export default function PairingInviteCard({
  title,
  body,
  payload,
  fallbackUrl,
  fallbackLabel,
  compact = false,
}: Props) {
  const searchParams = useSearchParams();
  const locale = resolveLocale(searchParams?.get("lang") ?? (typeof navigator !== "undefined" ? navigator.language : null));
  const pairingId = useMemo(() => extractPairingId(payload), [payload]);
  const { data, mutate } = useSWR<InviteStatusResponse>(
    pairingId ? `/api/padel/pairings/invite-status?pairingId=${pairingId}` : null,
    fetcher,
  );
  const status = data?.ok ? data : null;
  const statusLabel = status?.statusLabel ?? t("pairingStatusPending", locale);
  const statusHint = status?.statusHint ?? null;
  const blockingMessage = status?.blockingDetails?.message ?? null;
  const participants = status?.participants ?? null;
  const amounts = status?.amounts ?? null;
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  function resolveErrorMessage(raw: string) {
    try {
      const parsed = JSON.parse(raw) as { error?: string } | null;
      if (parsed?.error) {
        return resolveErrorMessage(parsed.error);
      }
    } catch {
      // ignore
    }
    const code = raw.replace(/[^\w_]/g, "").trim();
    const map: Record<string, string> = {
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
      PAYMENT_REQUIRED: t("pairingErrorPaymentRequired", locale),
      PARTNER_ACCEPT_REQUIRED: t("pairingErrorPaymentRequired", locale),
      SWAP_NOT_ALLOWED: t("pairingErrorSwapNotAllowed", locale),
      PARTNER_LOCKED: t("pairingErrorPartnerLocked", locale),
      FORBIDDEN: t("pairingErrorForbidden", locale),
    };
    return map[code] ?? t("pairingErrorDefault", locale);
  }

  const handleAction = async (
    url?: string | null,
    options?: { redirectTo?: string; body?: Record<string, unknown> },
  ) => {
    if (!url) return;
    setActionBusy(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: options?.body ? { "Content-Type": "application/json" } : undefined,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(resolveErrorMessage(text || ""));
      }
      await mutate();
      setActionMessage(t("pairingActionUpdated", locale));
      if (options?.redirectTo) {
        window.location.href = options.redirectTo;
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("pairingActionError", locale));
    } finally {
      setActionBusy(false);
    }
  };

  const handleCopyInvite = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setActionMessage(t("pairingCopySuccess", locale));
      setActionError(null);
    } catch {
      setActionError(t("pairingCopyError", locale));
    }
  };

  const payLabel =
    status?.viewerRole === "CAPTAIN"
      ? status.paymentMode === "FULL"
        ? t("pairingPayRegistration", locale)
        : t("pairingPayPartner", locale)
      : t("pairingPayInvite", locale);

  const payUrl = status?.urls?.payUrl ?? null;

  const resolvedBody = useMemo(() => {
    if (!body) return null;
    try {
      const parsed = JSON.parse(body) as { error?: string } | null;
      if (parsed?.error) return resolveErrorMessage(parsed.error);
    } catch {
      // ignore
    }
    const upper = body.trim();
    if (/^[A-Z0-9_]+$/.test(upper)) {
      return resolveErrorMessage(upper);
    }
    return body;
  }, [body]);

  return (
    <div
      className={`rounded-2xl border border-white/12 bg-white/5 ${compact ? "px-3 py-2" : "px-4 py-3"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">{t("pairingInviteKicker", locale)}</p>
          <p className={`${compact ? "text-[12px]" : "text-sm"} font-semibold text-white`}>
            {title || t("pairingInviteTitleFallback", locale)}
          </p>
          {resolvedBody && !compact && !statusHint && (
            <p className="mt-1 text-[12px] text-white/70">{resolvedBody}</p>
          )}
        </div>
        <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-2.5 py-1 text-[10px] text-emerald-100">
          {statusLabel}
        </span>
      </div>

      {statusHint && (
        <p className="mt-2 text-[11px] text-white/60">{statusHint}</p>
      )}
      {!statusHint && blockingMessage && (
        <p className="mt-2 text-[11px] text-white/60">{blockingMessage}</p>
      )}
      {participants && !compact && (
        <div className="mt-3 grid gap-2 text-[11px] text-white/70 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">{t("pairingRoleCaptain", locale)}</p>
            <p className="text-sm font-semibold text-white">
              {participants.captain?.name ?? t("pairingRoleCaptain", locale)}
            </p>
            <p className="text-[11px] text-white/60">
              {participants.captain?.paid ? "Pago" : "Pagamento pendente"}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">{t("pairingRolePartner", locale)}</p>
            <p className="text-sm font-semibold text-white">
              {participants.partner?.name ?? t("pairingRolePartner", locale)}
            </p>
            <p className="text-[11px] text-white/60">
              {participants.partner?.paid ? "Pago" : "Pagamento pendente"}
            </p>
          </div>
        </div>
      )}
      {amounts?.amountDueCents !== null && amounts?.amountDueCents !== undefined && (
        <p className="mt-2 text-[11px] text-white/70">
          Valor pendente:{" "}
          <span className="text-white">
            {(amounts.amountDueCents / 100).toLocaleString("pt-PT", {
              style: "currency",
              currency: amounts.currency ?? "EUR",
            })}
          </span>
        </p>
      )}
      {status?.deadlineAt && (
        <p className="mt-1 text-[11px] text-white/55">
          Prazo:{" "}
          {new Date(status.deadlineAt).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      )}

      {actionError && (
        <p className="mt-2 rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-[11px] text-rose-100">
          {actionError}
        </p>
      )}
      {actionMessage && !actionError && (
        <p className="mt-2 rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-3 py-2 text-[11px] text-emerald-100">
          {actionMessage}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        {status?.urls?.detailUrl && (
          <Link
            href={status.urls.detailUrl}
            className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] text-white/80"
          >
            Ver inscrição
          </Link>
        )}
        {status?.requiredAction === "ONBOARD" && status?.urls?.onboardingUrl && (
          <Link
            href={status.urls.onboardingUrl}
            className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-black"
          >
            Completar perfil
          </Link>
        )}
        {(status?.requiredAction === "PAY" || status?.actions?.canPay) && payUrl && (
          <Link
            href={payUrl}
            className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-black"
          >
            {payLabel}
          </Link>
        )}
        {status?.actions?.canAccept && (
          <button
            type="button"
            onClick={() => handleAction(status.urls?.acceptUrl)}
            disabled={actionBusy}
            className="rounded-full bg-emerald-400 px-3 py-1.5 text-[11px] font-semibold text-black disabled:opacity-60"
          >
            {t("pairingActionAccept", locale)}
          </button>
        )}
        {status?.actions?.canDecline && (
          <button
            type="button"
            onClick={() => handleAction(status.urls?.declineUrl)}
            disabled={actionBusy}
            className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] text-white/80 disabled:opacity-60"
          >
            {t("pairingActionDecline", locale)}
          </button>
        )}
        {status?.actions?.canSwap && (
          <button
            type="button"
            onClick={() => handleAction(status.urls?.swapUrl)}
            disabled={actionBusy}
            className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] text-white/80 disabled:opacity-60"
          >
            {t("pairingActionSwap", locale)}
          </button>
        )}
        {status?.actions?.canCancel && (
          <button
            type="button"
            onClick={() => handleAction(status.urls?.cancelUrl)}
            disabled={actionBusy}
            className="rounded-full border border-rose-300/30 bg-rose-400/10 px-3 py-1.5 text-[11px] text-rose-100 disabled:opacity-60"
          >
            {t("pairingActionCancel", locale)}
          </button>
        )}
        {status?.actions?.canReinvite && status.urls?.reopenUrl && (
          <button
            type="button"
            onClick={() =>
              handleAction(status.urls?.reopenUrl, {
                body: { mode: "INVITE_PARTNER" },
              })
            }
            disabled={actionBusy}
            className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] text-white/80 disabled:opacity-60"
          >
            {t("pairingActionReinvite", locale)}
          </button>
        )}
        {status?.actions?.canMatchmake && status.urls?.reopenUrl && (
          <button
            type="button"
            onClick={() =>
              handleAction(status.urls?.reopenUrl, {
                body: { mode: "LOOKING_FOR_PARTNER" },
              })
            }
            disabled={actionBusy}
            className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] text-white/80 disabled:opacity-60"
          >
            {t("pairingActionMatchmake", locale)}
          </button>
        )}
        {status?.actions?.canRefreshInvite && status.urls?.inviteRefreshUrl && (
          <button
            type="button"
            onClick={() => handleAction(status.urls?.inviteRefreshUrl)}
            disabled={actionBusy}
            className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] text-white/80 disabled:opacity-60"
          >
            {t("pairingActionRefreshInvite", locale)}
          </button>
        )}
        {status?.urls?.inviteUrl && status.viewerRole === "CAPTAIN" && (
          <button
            type="button"
            onClick={() => handleCopyInvite(status.urls?.inviteUrl ?? "")}
            className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] text-white/80"
          >
            {t("pairingActionCopyInvite", locale)}
          </button>
        )}
        {!status && fallbackUrl && fallbackLabel && (
          <Link
            href={fallbackUrl}
            className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] text-white/80"
          >
            {fallbackLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
