"use client";

import { useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";

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
  const pairingId = useMemo(() => extractPairingId(payload), [payload]);
  const { data } = useSWR<InviteStatusResponse>(
    pairingId ? `/api/padel/pairings/invite-status?pairingId=${pairingId}` : null,
    fetcher,
  );
  const status = data?.ok ? data : null;
  const statusLabel = status?.statusLabel ?? "Convite pendente";
  const statusHint = status?.statusHint ?? null;
  const blockingMessage = status?.blockingDetails?.message ?? null;
  const participants = status?.participants ?? null;
  const amounts = status?.amounts ?? null;
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
      CATEGORY_GENDER_MISMATCH: "Esta dupla não cumpre os requisitos de género da categoria.",
      GENDER_MISMATCH: "Esta dupla não cumpre os requisitos de género do torneio.",
      PADEL_ONBOARDING_REQUIRED: "Completa o perfil de padel para continuar.",
      PROFILE_INCOMPLETE: "Completa o perfil de padel para continuar.",
      PAIRING_EXPIRED: "Este convite expirou.",
      PAIRING_CANCELLED: "Esta dupla foi cancelada.",
      INVITE_EXPIRED: "Este convite expirou.",
      NO_PENDING_SLOT: "Não existe convite pendente para aceitar.",
      SLOT_ALREADY_PAID: "Este convite já foi pago.",
      PAYMENT_REQUIRED: "Precisas de pagar para aceitar este convite.",
      SWAP_NOT_ALLOWED: "Já não é possível trocar o parceiro.",
      PARTNER_LOCKED: "O parceiro já pagou e a dupla está bloqueada.",
      FORBIDDEN: "Não tens permissões para este convite.",
    };
    return map[code] ?? "Não foi possível concluir a ação.";
  }

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
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Padel · Dupla</p>
          <p className={`${compact ? "text-[12px]" : "text-sm"} font-semibold text-white`}>
            {title || "Convite para dupla"}
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
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Capitão</p>
            <p className="text-sm font-semibold text-white">{participants.captain?.name ?? "Capitão"}</p>
            <p className="text-[11px] text-white/60">
              {participants.captain?.paid ? "Pago" : "Pagamento pendente"}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Parceiro</p>
            <p className="text-sm font-semibold text-white">{participants.partner?.name ?? "Parceiro"}</p>
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

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        {status?.urls?.detailUrl && (
          <Link
            href={status.urls.detailUrl}
            className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] text-white/80"
          >
            Ver bilhete
          </Link>
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
