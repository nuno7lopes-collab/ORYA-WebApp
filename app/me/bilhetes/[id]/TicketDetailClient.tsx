"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import TicketLiveQr from "@/app/components/tickets/TicketLiveQr";
import useSWR from "swr";

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

function formatDateTime(iso?: string | null) {
  if (!iso) return "Data a anunciar";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Data a anunciar";
  return date.toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" });
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function TicketDetailClient({ entitlementId }: Props) {
  const router = useRouter();
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
          throw new Error("Precisas de iniciar sessão para ver este bilhete.");
        }
        throw new Error(text || "Não foi possível carregar o bilhete.");
      }
      const data = (await res.json()) as TicketDetail;
      setTicket(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao carregar bilhete.");
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
        ? "Pagar inscrição"
        : "Pagar pelo parceiro"
      : "Pagar convite";

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
      PAYMENT_REQUIRED: "Precisas de pagar para concluir este convite.",
      CATEGORY_GENDER_MISMATCH: "Esta dupla não cumpre os requisitos de género da categoria.",
      CATEGORY_LEVEL_MISMATCH: "Esta dupla não cumpre os requisitos de nível da categoria.",
      GENDER_MISMATCH: "Esta dupla não cumpre os requisitos de género do torneio.",
      PADEL_ONBOARDING_REQUIRED: "Completa o perfil de padel para continuar.",
      PROFILE_INCOMPLETE: "Completa o perfil de padel para continuar.",
      PAIRING_EXPIRED: "Este convite expirou.",
      PAIRING_CANCELLED: "Esta dupla foi cancelada.",
      INVITE_EXPIRED: "Este convite expirou.",
      NO_PENDING_SLOT: "Não existe convite pendente para aceitar.",
      SLOT_ALREADY_PAID: "Este convite já foi pago.",
      SWAP_NOT_ALLOWED: "Já não é possível trocar o parceiro.",
      PARTNER_LOCKED: "O parceiro já pagou e a dupla está bloqueada.",
      FORBIDDEN: "Não tens permissões para este convite.",
    };
    return map[code] ?? "Não foi possível concluir a ação.";
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
      setPairingActionError(err instanceof Error ? err.message : "Erro ao atualizar a dupla.");
    } finally {
      setPairingBusy(false);
    }
  };

  const handleCopyInvite = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setPairingActionMessage("Link de convite copiado.");
      setPairingActionError(null);
    } catch {
      setPairingActionError("Não foi possível copiar o link.");
    }
  };

  if (!user || authRequired) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_12%_12%,rgba(120,160,255,0.16),transparent_55%),radial-gradient(circle_at_88%_18%,rgba(120,255,214,0.12),transparent_60%),linear-gradient(160deg,#090d1c,#0b0f1f)] text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.4em] text-white/55">Bilhetes ORYA</p>
          <h1 className="mt-4 text-3xl font-semibold">Entra para veres o teu bilhete</h1>
          <p className="mt-3 text-sm text-white/70">
            Precisas de iniciar sessão para aceder ao detalhe do bilhete.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() =>
                openAuthModal({ mode: "login", redirectTo: `/me/bilhetes/${entitlementId}`, showGoogle: true })
              }
              className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black"
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() =>
                openAuthModal({ mode: "signup", redirectTo: `/me/bilhetes/${entitlementId}`, showGoogle: true })
              }
              className="rounded-full border border-white/30 px-6 py-2 text-sm text-white"
            >
              Criar conta
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_20%,rgba(120,160,255,0.18),transparent_55%),radial-gradient(circle_at_85%_12%,rgba(120,255,214,0.14),transparent_60%),linear-gradient(160deg,#080b18,#0c1124)] text-white">
      <div className="mx-auto w-full max-w-5xl px-6 pb-16 pt-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/55">Bilhete</p>
            <h1 className="text-2xl font-semibold">{ticket?.snapshot?.title ?? "Detalhe do bilhete"}</h1>
            <p className="text-sm text-white/65">{ticket?.snapshot?.venueName ?? "Local a anunciar"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/me/carteira"
              className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/75 hover:bg-white/10"
            >
              Voltar a carteira
            </Link>
            {ticket?.event?.slug && (
              <Link
                href={`/eventos/${ticket.event.slug}`}
                className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/75 hover:bg-white/10"
              >
                Ver evento
              </Link>
            )}
          </div>
        </header>

        {loading && <p className="mt-6 text-sm text-white/70">A carregar bilhete...</p>}
        {errorMsg && !loading && (
          <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
            {errorMsg}
          </div>
        )}

        {!loading && ticket && (
          <>
            <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_20px_55px_rgba(0,0,0,0.5)]">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Resumo</p>
                <h2 className="mt-2 text-lg font-semibold">Detalhes do acesso</h2>
                <div className="mt-4 space-y-2 text-sm text-white/75">
                  <p>
                    <span className="text-white/50">Data</span> · {formatDateTime(ticket.snapshot?.startAt)}
                  </p>
                  <p>
                    <span className="text-white/50">Estado</span> · {ticket.status}
                  </p>
                  <p>
                    <span className="text-white/50">Tipo</span> · {ticket.type}
                  </p>
                  {ticket.event?.organizationName && (
                    <p>
                      <span className="text-white/50">Organizador</span> · {ticket.event.organizationName}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/60">
                  <span className="rounded-full border border-white/20 px-3 py-1">ID {ticket.entitlementId}</span>
                  {ticket.audit?.updatedAt && (
                    <span className="rounded-full border border-white/20 px-3 py-1">
                      Atualizado {formatDateTime(ticket.audit.updatedAt)}
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-center">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Check-in</p>
                <h2 className="mt-2 text-lg font-semibold">QR do bilhete</h2>
                <div className="mt-4 flex items-center justify-center">
                  {ticket.actions?.canShowQr && ticket.qrToken ? (
                    <TicketLiveQr qrToken={ticket.qrToken} />
                  ) : (
                    <div className="rounded-2xl border border-white/15 bg-black/30 px-6 py-8 text-sm text-white/65">
                      O QR vai ficar disponivel quando o check-in abrir.
                    </div>
                  )}
                </div>
              </div>
            </section>

            {ticket.pairing && (
              <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/60">Dupla</p>
                    <h2 className="text-lg font-semibold">Estado e pagamentos</h2>
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
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">Capitão</p>
                      <p className="text-sm font-semibold text-white/90">
                        {pairingState.participants.captain?.name ?? "Capitão"}
                      </p>
                      <p className="text-[12px] text-white/60">
                        {pairingState.participants.captain?.paid ? "Pago" : "Pagamento pendente"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">Parceiro</p>
                      <p className="text-sm font-semibold text-white/90">
                        {pairingState.participants.partner?.name ?? "Parceiro"}
                      </p>
                      <p className="text-[12px] text-white/60">
                        {pairingState.participants.partner?.paid ? "Pago" : "Pagamento pendente"}
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
                        <p className="text-[12px] text-white/60">Estado: {slot.slotStatus}</p>
                        <p className="text-[12px] text-white/60">Pagamento: {slot.paymentStatus}</p>
                      </div>
                    ))}
                  </div>
                )}

                {pairingState?.amounts?.amountDueCents !== null &&
                  pairingState?.amounts?.amountDueCents !== undefined && (
                    <p className="mt-3 text-[12px] text-white/70">
                      Valor pendente:{" "}
                      <span className="text-white">
                        {(pairingState.amounts.amountDueCents / 100).toLocaleString("pt-PT", {
                          style: "currency",
                          currency: pairingState.amounts.currency ?? "EUR",
                        })}
                      </span>
                    </p>
                  )}

                {pairingState?.deadlineAt && (
                  <p className="mt-2 text-[11px] text-white/55">
                    Prazo de pagamento: {formatDateTime(pairingState.deadlineAt)}
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
                      Completar perfil
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
                      Requer suporte
                    </span>
                  )}
                  {pairingState?.actions?.canAccept && (
                    <button
                      type="button"
                      onClick={() => handlePairingAction(pairingState.urls?.acceptUrl)}
                      disabled={pairingBusy}
                      className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-black disabled:opacity-60"
                    >
                      Confirmar presença
                    </button>
                  )}
                  {pairingState?.actions?.canDecline && (
                    <button
                      type="button"
                      onClick={() => handlePairingAction(pairingState.urls?.declineUrl, { redirectTo: "/me/carteira" })}
                      disabled={pairingBusy}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 disabled:opacity-60"
                    >
                      Recusar convite
                    </button>
                  )}
                  {pairingState?.actions?.canSwap && (
                    <button
                      type="button"
                      onClick={() => handlePairingAction(pairingState.urls?.swapUrl)}
                      disabled={pairingBusy}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 disabled:opacity-60"
                    >
                      Mudar parceiro
                    </button>
                  )}
                  {pairingState?.actions?.canCancel && (
                    <button
                      type="button"
                      onClick={() => handlePairingAction(pairingState.urls?.cancelUrl, { redirectTo: "/me/carteira" })}
                      disabled={pairingBusy}
                      className="rounded-full border border-rose-300/30 bg-rose-400/10 px-4 py-2 text-xs text-rose-100 disabled:opacity-60"
                    >
                      Cancelar dupla
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
                      Criar novo convite
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
                      Entrar em matchmaking
                    </button>
                  )}
                  {pairingState?.actions?.canRefreshInvite && pairingState.urls?.inviteRefreshUrl && (
                    <button
                      type="button"
                      onClick={() => handlePairingAction(pairingState.urls?.inviteRefreshUrl)}
                      disabled={pairingBusy}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 disabled:opacity-60"
                    >
                      Gerar novo convite
                    </button>
                  )}
                  {pairingState?.urls?.inviteUrl && pairingState.viewerRole === "CAPTAIN" && (
                    <button
                      type="button"
                      onClick={() => handleCopyInvite(pairingState.urls?.inviteUrl ?? "")}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/80"
                    >
                      Copiar convite
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
