"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import ChatThread from "@/components/chat/ChatThread";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const pageClass = "min-h-screen w-full text-white";

const cardClass =
  "rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl";

const BOOKING_HOLD_MINUTES = 10;

type BookingItem = {
  id: number;
  startsAt: string;
  durationMinutes: number;
  status: string;
  price: number;
  currency: string;
  createdAt: string;
  estimatedStartsAt?: string | null;
  delayMinutes?: number | null;
  delayReason?: string | null;
  availabilityId: number | null;
  pendingExpiresAt: string | null;
  reviewId: number | null;
  assignmentMode?: string | null;
  partySize?: number | null;
  professional?: { id: number; name: string; avatarUrl: string | null } | null;
  resource?: { id: number; label: string; capacity: number } | null;
  service: { id: number; title: string | null } | null;
  court: { id: number; name: string | null } | null;
  organization: {
    id: number;
    publicName: string | null;
    businessName: string | null;
    city: string | null;
    username: string | null;
    brandingAvatarUrl: string | null;
  } | null;
  cancellation: {
    allowed: boolean;
    reason: string | null;
    deadline: string | null;
  };
  reschedule: {
    allowed: boolean;
    reason: string | null;
    deadline: string | null;
  };
};

type Response = {
  ok: boolean;
  items: BookingItem[];
  error?: string;
};

type BookingInviteItem = {
  id: number;
  token: string;
  targetName: string | null;
  targetContact: string | null;
  message: string | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  respondedAt: string | null;
  createdAt: string;
};

function formatDeadline(deadline: string | null) {
  if (!deadline) return null;
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" });
}

function formatBookingStatus(status: string) {
  if (status === "CONFIRMED") return "Confirmada";
  if (status === "PENDING_CONFIRMATION" || status === "PENDING") return "Pendente";
  if (status === "COMPLETED") return "Concluída";
  if (status === "DISPUTED") return "Em disputa";
  if (status === "NO_SHOW") return "No-show";
  return "Cancelada";
}

function formatInviteStatus(status: string) {
  if (status === "ACCEPTED") return "Aceite";
  if (status === "DECLINED") return "Recusado";
  return "Pendente";
}

function formatHoldDeadline(pendingExpiresAt: string | null, createdAt: string) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  const pending = pendingExpiresAt ? new Date(pendingExpiresAt) : null;
  const expiresAt =
    pending && !Number.isNaN(pending.getTime())
      ? pending
      : new Date(created.getTime() + BOOKING_HOLD_MINUTES * 60 * 1000);
  if (Number.isNaN(expiresAt.getTime())) return null;
  return expiresAt.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

export default function MinhasReservasPage() {
  const { data, isLoading, mutate } = useSWR<Response>("/api/me/reservas", fetcher);
  const [cancelingId, setCancelingId] = useState<number | null>(null);
  const [openChatId, setOpenChatId] = useState<number | null>(null);
  const [cancelPreview, setCancelPreview] = useState<{
    bookingId: number;
    loading: boolean;
    saving: boolean;
    error: string | null;
    allowed: boolean | null;
    deadline: string | null;
    refund: null | {
      currency: string;
      totalCents: number;
      penaltyCents: number;
      refundCents: number;
      feesRetainedCents?: number;
      rule: string;
    };
  } | null>(null);
  const [rescheduleState, setRescheduleState] = useState<{
    bookingId: number;
    day: string;
    loading: boolean;
    saving: boolean;
    error: string | null;
    slots: Array<{ startsAt: string }>;
    selectedStartsAt: string | null;
  } | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<
      number,
      { open: boolean; rating: number; comment: string; saving: boolean; error: string | null }
    >
  >({});
  const [inviteState, setInviteState] = useState<{
    bookingId: number;
    loading: boolean;
    saving: boolean;
    error: string | null;
    notice: string | null;
    items: BookingInviteItem[];
    contact: string;
    name: string;
    message: string;
    copiedToken: string | null;
    resendingId: number | null;
  } | null>(null);

  const items = data?.items ?? [];
  const loadError = data && data.ok === false ? data.error ?? "Erro ao carregar reservas." : null;

  const grouped = useMemo(() => {
    const upcoming: BookingItem[] = [];
    const past: BookingItem[] = [];
    const now = Date.now();
    items.forEach((item) => {
      const startAt = new Date(item.startsAt).getTime();
      if (!Number.isNaN(startAt) && startAt >= now) {
        upcoming.push(item);
      } else {
        past.push(item);
      }
    });
    return { upcoming, past };
  }, [items]);

  const handleCancel = async (bookingId: number) => {
    if (cancelingId) return;
    setCancelPreview({
      bookingId,
      loading: true,
      saving: false,
      error: null,
      allowed: null,
      deadline: null,
      refund: null,
    });
    try {
      const res = await fetch(`/api/me/reservas/${bookingId}/cancel/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao preparar cancelamento.");
      }
      setCancelPreview((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              allowed: Boolean(json.allowed),
              deadline: typeof json.deadline === "string" ? json.deadline : null,
              refund: json.refund ?? null,
            }
          : prev,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao preparar cancelamento.";
      setCancelPreview((prev) => (prev ? { ...prev, loading: false, error: message } : prev));
    }
  };

  const closeCancelPreview = () => setCancelPreview(null);

  const confirmCancel = async () => {
    if (!cancelPreview || cancelPreview.saving) return;
    setCancelPreview({ ...cancelPreview, saving: true, error: null });
    setCancelingId(cancelPreview.bookingId);
    try {
      const res = await fetch(`/api/me/reservas/${cancelPreview.bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao cancelar reserva.");
      }
      closeCancelPreview();
      mutate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao cancelar reserva.";
      setCancelPreview((prev) => (prev ? { ...prev, saving: false, error: message } : prev));
    } finally {
      setCancelingId(null);
    }
  };

  const openReschedule = async (booking: BookingItem) => {
    if (!booking.service) return;
    const day = new Date(booking.startsAt).toISOString().slice(0, 10);
    setRescheduleState({
      bookingId: booking.id,
      day,
      loading: true,
      saving: false,
      error: null,
      slots: [],
      selectedStartsAt: null,
    });
    try {
      const qs = new URLSearchParams({ day });
      if (booking.assignmentMode === "PROFESSIONAL" && booking.professional?.id) {
        qs.set("professionalId", String(booking.professional.id));
      }
      if (booking.assignmentMode === "RESOURCE" && booking.partySize) {
        qs.set("partySize", String(booking.partySize));
      }
      if (booking.durationMinutes) {
        qs.set("durationMinutes", String(booking.durationMinutes));
      }
      const res = await fetch(`/api/servicos/${booking.service.id}/slots?${qs.toString()}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao carregar horários.");
      }
      const slots = Array.isArray(json?.items)
        ? json.items
            .filter((item: any) => typeof item?.startsAt === "string")
            .map((item: any) => ({ startsAt: item.startsAt as string }))
        : [];
      setRescheduleState((prev) =>
        prev ? { ...prev, slots, loading: false } : prev,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar horários.";
      setRescheduleState((prev) => (prev ? { ...prev, loading: false, error: message } : prev));
    }
  };

  const closeReschedule = () => setRescheduleState(null);

  const setRescheduleDay = async (booking: BookingItem, day: string) => {
    if (!booking.service) return;
    setRescheduleState((prev) =>
      prev ? { ...prev, day, loading: true, error: null, slots: [], selectedStartsAt: null } : prev,
    );
    try {
      const qs = new URLSearchParams({ day });
      if (booking.assignmentMode === "PROFESSIONAL" && booking.professional?.id) {
        qs.set("professionalId", String(booking.professional.id));
      }
      if (booking.assignmentMode === "RESOURCE" && booking.partySize) {
        qs.set("partySize", String(booking.partySize));
      }
      if (booking.durationMinutes) {
        qs.set("durationMinutes", String(booking.durationMinutes));
      }
      const res = await fetch(`/api/servicos/${booking.service.id}/slots?${qs.toString()}`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao carregar horários.");
      }
      const slots = Array.isArray(json?.items)
        ? json.items
            .filter((item: any) => typeof item?.startsAt === "string")
            .map((item: any) => ({ startsAt: item.startsAt as string }))
        : [];
      setRescheduleState((prev) => (prev ? { ...prev, slots, loading: false } : prev));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar horários.";
      setRescheduleState((prev) => (prev ? { ...prev, loading: false, error: message } : prev));
    }
  };

  const submitReschedule = async () => {
    if (!rescheduleState || rescheduleState.saving) return;
    if (!rescheduleState.selectedStartsAt) {
      setRescheduleState((prev) => (prev ? { ...prev, error: "Escolhe um horário." } : prev));
      return;
    }
    setRescheduleState((prev) => (prev ? { ...prev, saving: true, error: null } : prev));
    try {
      const res = await fetch(`/api/me/reservas/${rescheduleState.bookingId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: rescheduleState.selectedStartsAt }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao reagendar.");
      }
      closeReschedule();
      mutate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao reagendar.";
      setRescheduleState((prev) => (prev ? { ...prev, saving: false, error: message } : prev));
    }
  };

  const openReview = (bookingId: number) => {
    setReviewDrafts((prev) => {
      const current = prev[bookingId];
      return {
        ...prev,
        [bookingId]: {
          open: true,
          rating: current?.rating ?? 5,
          comment: current?.comment ?? "",
          saving: false,
          error: null,
        },
      };
    });
  };

  const closeReview = (bookingId: number) => {
    setReviewDrafts((prev) => {
      const current = prev[bookingId];
      if (!current) return prev;
      return { ...prev, [bookingId]: { ...current, open: false, error: null } };
    });
  };

  const updateReviewDraft = (bookingId: number, patch: Partial<{ rating: number; comment: string }>) => {
    setReviewDrafts((prev) => {
      const current = prev[bookingId] ?? { open: true, rating: 5, comment: "", saving: false, error: null };
      return { ...prev, [bookingId]: { ...current, ...patch } };
    });
  };

  const submitReview = async (bookingId: number) => {
    const draft = reviewDrafts[bookingId] ?? { rating: 5, comment: "", open: true, saving: false, error: null };
    setReviewDrafts((prev) => ({
      ...prev,
      [bookingId]: { ...draft, open: true, saving: true, error: null },
    }));
    try {
      const res = await fetch(`/api/me/reservas/${bookingId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: draft.rating, comment: draft.comment }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao submeter review.");
      }
      setReviewDrafts((prev) => {
        const current = prev[bookingId];
        if (!current) return prev;
        return { ...prev, [bookingId]: { ...current, open: false, saving: false, error: null } };
      });
      mutate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao submeter review.";
      setReviewDrafts((prev) => {
        const current = prev[bookingId] ?? { open: true, rating: 5, comment: "", saving: false, error: null };
        return { ...prev, [bookingId]: { ...current, open: true, saving: false, error: message } };
      });
    }
  };

  const toggleChat = (bookingId: number) => {
    setOpenChatId((prev) => (prev === bookingId ? null : bookingId));
  };

  const openInvites = async (bookingId: number) => {
    setInviteState({
      bookingId,
      loading: true,
      saving: false,
      error: null,
      notice: null,
      items: [],
      contact: "",
      name: "",
      message: "",
      copiedToken: null,
      resendingId: null,
    });
    try {
      const res = await fetch(`/api/me/reservas/${bookingId}/invites`);
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao carregar convites.");
      }
      const items = Array.isArray(json?.data?.items)
        ? json.data.items.map((invite: any) => ({
            id: invite.id,
            token: invite.token,
            targetName: invite.targetName ?? null,
            targetContact: invite.targetContact ?? null,
            message: invite.message ?? null,
            status: invite.status,
            respondedAt: invite.respondedAt ?? null,
            createdAt: invite.createdAt,
          }))
        : [];
      setInviteState((prev) => (prev ? { ...prev, loading: false, items } : prev));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar convites.";
      setInviteState((prev) => (prev ? { ...prev, loading: false, error: message } : prev));
    }
  };

  const closeInvites = () => setInviteState(null);

  const submitInvite = async () => {
    if (!inviteState || inviteState.saving) return;
    const contact = inviteState.contact.trim();
    if (!contact) {
      setInviteState((prev) =>
        prev ? { ...prev, error: "Indica email ou contacto do convidado.", notice: null } : prev,
      );
      return;
    }
    setInviteState((prev) => (prev ? { ...prev, saving: true, error: null, notice: null } : prev));
    try {
      const res = await fetch(`/api/me/reservas/${inviteState.bookingId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invites: [
            {
              contact,
              name: inviteState.name.trim() || undefined,
              message: inviteState.message.trim() || undefined,
            },
          ],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao enviar convite.");
      }
      const created = Array.isArray(json?.data?.items) ? json.data.items : [];
      if (created.length === 0) {
        setInviteState((prev) =>
          prev ? { ...prev, saving: false, error: "Esse convidado já existe.", notice: null } : prev,
        );
        return;
      }
      setInviteState((prev) =>
        prev
          ? {
              ...prev,
              saving: false,
              error: null,
              notice: "Convite enviado.",
              contact: "",
              name: "",
              message: "",
              items: [
                ...created.map((invite: any) => ({
                  id: invite.id,
                  token: invite.token,
                  targetName: invite.targetName ?? null,
                  targetContact: invite.targetContact ?? null,
                  message: invite.message ?? null,
                  status: invite.status,
                  respondedAt: invite.respondedAt ?? null,
                  createdAt: invite.createdAt,
                })),
                ...prev.items,
              ],
            }
          : prev,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao enviar convite.";
      setInviteState((prev) => (prev ? { ...prev, saving: false, error: message, notice: null } : prev));
    }
  };

  const resendInvite = async (inviteId: number) => {
    if (!inviteState || inviteState.resendingId) return;
    setInviteState((prev) =>
      prev ? { ...prev, resendingId: inviteId, error: null, notice: null } : prev,
    );
    try {
      const res = await fetch(`/api/me/reservas/${inviteState.bookingId}/invites/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao reenviar convite.");
      }
      setInviteState((prev) =>
        prev ? { ...prev, resendingId: null, notice: "Convite reenviado." } : prev,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao reenviar convite.";
      setInviteState((prev) =>
        prev ? { ...prev, resendingId: null, error: message, notice: null } : prev,
      );
    }
  };

  const copyInviteLink = async (token: string) => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${baseUrl}/convites/${token}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        throw new Error("Clipboard not available");
      }
      setInviteState((prev) =>
        prev ? { ...prev, copiedToken: token, notice: "Link copiado.", error: null } : prev,
      );
    } catch (err) {
      setInviteState((prev) =>
        prev ? { ...prev, error: "Não foi possível copiar o link.", notice: null } : prev,
      );
    }
  };

  return (
    <main className={pageClass}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Reservas</p>
          <h1 className="text-3xl font-semibold text-white">As tuas reservas</h1>
          <p className="text-sm text-white/65">
            Confirmações, horários e cancelamentos num só lugar.
          </p>
        </div>

        <section className={cardClass}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Próximas</h2>
              <p className="text-sm text-white/65">Reservas futuras e pendentes.</p>
            </div>
            <Link href="/explorar/reservas" className="text-[12px] text-[#6BFFFF]">
              Explorar serviços
            </Link>
          </div>

          {isLoading && (
            <div className="mt-4 space-y-2">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="h-20 rounded-xl border border-white/10 orya-skeleton-surface animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && loadError && (
            <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {loadError}
            </div>
          )}

          {!isLoading && !loadError && items.length === 0 && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              Ainda não fizeste reservas.
            </div>
          )}

          <div className="mt-4 space-y-3">
            {grouped.upcoming.map((booking) => {
              const deadlineLabel = formatDeadline(booking.cancellation.deadline);
              const rescheduleDeadlineLabel = formatDeadline(booking.reschedule.deadline);
              const isCancelled = ["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"].includes(booking.status);
              const isCompleted = booking.status === "COMPLETED";
              const isPending = ["PENDING_CONFIRMATION", "PENDING"].includes(booking.status);
              const canCancel = booking.cancellation.allowed && !isCancelled && !isCompleted;
              const canReschedule = booking.reschedule.allowed && !isCancelled && !isCompleted;
              const canChat = booking.status === "CONFIRMED";
              const canInvite = booking.status === "CONFIRMED";
              const holdDeadline = isPending ? formatHoldDeadline(booking.pendingExpiresAt, booking.createdAt) : null;
              const estimatedStart = booking.estimatedStartsAt ? new Date(booking.estimatedStartsAt) : null;
              const originalStart = new Date(booking.startsAt);
              const showEstimate =
                estimatedStart && !Number.isNaN(estimatedStart.getTime()) && estimatedStart.getTime() !== originalStart.getTime();
              return (
                <div key={booking.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {booking.service?.title || "Serviço"}
                      </p>
                      <p className="text-[12px] text-white/60">
                        {originalStart.toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}
                        {booking.organization?.publicName || booking.organization?.businessName
                          ? ` · ${booking.organization.publicName || booking.organization.businessName}`
                          : ""}
                        {booking.court?.name ? ` · ${booking.court.name}` : ""}
                        {booking.professional?.name ? ` · ${booking.professional.name}` : ""}
                        {booking.resource?.label ? ` · ${booking.resource.label}` : ""}
                        {booking.partySize ? ` · ${booking.partySize} pax` : ""}
                      </p>
                      {booking.status === "CONFIRMED" && deadlineLabel && (
                        <p className="mt-1 text-[12px] text-white/50">Cancelamento até {deadlineLabel}.</p>
                      )}
                      {booking.status === "CONFIRMED" && rescheduleDeadlineLabel && (
                        <p className="mt-1 text-[12px] text-white/50">Reagendamento até {rescheduleDeadlineLabel}.</p>
                      )}
                      {showEstimate && (
                        <p className="mt-1 text-[12px] text-amber-100/80">
                          Hora estimada: {estimatedStart.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                          {booking.delayMinutes ? ` (+${booking.delayMinutes} min)` : ""}
                        </p>
                      )}
                      {isPending && (
                        <p className="mt-1 text-[12px] text-amber-100/80">
                          Pré-reserva pendente
                          {holdDeadline ? ` · expira às ${holdDeadline}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/70">
                        {formatBookingStatus(booking.status)}
                      </span>
                      {canChat && (
                        <button
                          type="button"
                          className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:border-white/40"
                          onClick={() => toggleChat(booking.id)}
                        >
                          {openChatId === booking.id ? "Fechar chat" : "Falar"}
                        </button>
                      )}
                      {canInvite && (
                        <button
                          type="button"
                          className="rounded-full border border-sky-300/40 bg-sky-400/10 px-2.5 py-1 text-[11px] text-sky-100 hover:bg-sky-400/15"
                          onClick={() => openInvites(booking.id)}
                        >
                          Convites
                        </button>
                      )}
                      {canReschedule && (
                        <button
                          type="button"
                          className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-100 hover:bg-emerald-400/15"
                          onClick={() => openReschedule(booking)}
                        >
                          Reagendar
                        </button>
                      )}
                      {canCancel && (
                        <button
                          type="button"
                          className="rounded-full border border-red-400/40 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-100 hover:bg-red-500/20 disabled:opacity-60"
                          onClick={() => handleCancel(booking.id)}
                          disabled={cancelingId === booking.id}
                        >
                          {cancelingId === booking.id ? "A cancelar..." : "Cancelar"}
                        </button>
                      )}
                    </div>
                  </div>
                  {openChatId === booking.id && (
                    <div className="mt-3">
                      <ChatThread entityType="BOOKING" entityId={booking.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className={cardClass}>
          <div>
            <h2 className="text-base font-semibold text-white">Histórico</h2>
            <p className="text-sm text-white/65">Reservas já concluídas ou canceladas.</p>
          </div>

          <div className="mt-4 space-y-2">
            {grouped.past.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                Ainda não tens histórico de reservas.
              </div>
            )}
            {grouped.past.map((booking) => (
              <div key={booking.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {booking.service?.title || "Serviço"}
                    </p>
                    <p className="text-[12px] text-white/60">
                      {new Date(booking.startsAt).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}
                      {booking.organization?.publicName || booking.organization?.businessName
                        ? ` · ${booking.organization.publicName || booking.organization.businessName}`
                        : ""}
                      {booking.court?.name ? ` · ${booking.court.name}` : ""}
                      {booking.professional?.name ? ` · ${booking.professional.name}` : ""}
                      {booking.resource?.label ? ` · ${booking.resource.label}` : ""}
                      {booking.partySize ? ` · ${booking.partySize} pax` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/70">
                      {formatBookingStatus(booking.status)}
                    </span>
                    {["CONFIRMED", "COMPLETED"].includes(booking.status) && (
                      <button
                        type="button"
                        className="rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/70 hover:border-white/40"
                        onClick={() => toggleChat(booking.id)}
                      >
                        {openChatId === booking.id ? "Fechar chat" : "Falar"}
                      </button>
                    )}
                  </div>
                </div>
                {openChatId === booking.id && (
                  <div className="mt-3">
                    <ChatThread entityType="BOOKING" entityId={booking.id} />
                  </div>
                )}
                {booking.status === "COMPLETED" && !booking.reviewId && (
                  <div className="mt-3 space-y-2">
                    {!reviewDrafts[booking.id]?.open ? (
                      <button
                        type="button"
                        className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-100"
                        onClick={() => openReview(booking.id)}
                      >
                        Avaliar serviço
                      </button>
                    ) : (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[12px] text-white/70">Rating</p>
                          <div className="flex gap-1">
                            {Array.from({ length: 5 }, (_, idx) => idx + 1).map((value) => {
                              const active = (reviewDrafts[booking.id]?.rating ?? 5) >= value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  className={`h-7 w-7 rounded-full border text-[11px] ${
                                    active
                                      ? "border-amber-300/60 bg-amber-400/20 text-amber-100"
                                      : "border-white/15 bg-white/5 text-white/60"
                                  }`}
                                  onClick={() => updateReviewDraft(booking.id, { rating: value })}
                                >
                                  {value}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <textarea
                          rows={2}
                          className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                          placeholder="Comentário (opcional)"
                          value={reviewDrafts[booking.id]?.comment ?? ""}
                          onChange={(e) => updateReviewDraft(booking.id, { comment: e.target.value })}
                        />
                        {reviewDrafts[booking.id]?.error && (
                          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                            {reviewDrafts[booking.id]?.error}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] text-white/70 hover:bg-white/20 disabled:opacity-60"
                            onClick={() => submitReview(booking.id)}
                            disabled={reviewDrafts[booking.id]?.saving}
                          >
                            {reviewDrafts[booking.id]?.saving ? "A guardar..." : "Enviar review"}
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/60 hover:bg-white/10"
                            onClick={() => closeReview(booking.id)}
                            disabled={reviewDrafts[booking.id]?.saving}
                          >
                            Fechar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {rescheduleState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-white/12 bg-[#0b0f1d] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.7)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">Reagendar</p>
                <p className="mt-1 text-sm text-white/80">
                  Escolhe um novo horário. A confirmação mantém o mesmo pagamento.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:bg-white/10"
                onClick={closeReschedule}
                disabled={rescheduleState.saving}
              >
                Fechar
              </button>
            </div>

            {(() => {
              const booking = items.find((b) => b.id === rescheduleState.bookingId) ?? null;
              if (!booking) return null;
              return (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-[12px] text-white/70">
                      Dia
                      <input
                        type="date"
                        className="ml-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                        value={rescheduleState.day}
                        onChange={(e) => setRescheduleDay(booking, e.target.value)}
                        disabled={rescheduleState.loading || rescheduleState.saving}
                      />
                    </label>
                    <p className="text-[12px] text-white/60">
                      Atual:{" "}
                      {new Date(booking.startsAt).toLocaleString("pt-PT", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>

                  {rescheduleState.error && (
                    <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                      {rescheduleState.error}
                    </div>
                  )}

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    {rescheduleState.loading ? (
                      <div className="h-20 rounded-xl border border-white/10 orya-skeleton-surface animate-pulse" />
                    ) : rescheduleState.slots.length === 0 ? (
                      <p className="text-sm text-white/70">Sem horários disponíveis neste dia.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {rescheduleState.slots.map((slot) => {
                          const selected = rescheduleState.selectedStartsAt === slot.startsAt;
                          const label = new Date(slot.startsAt).toLocaleTimeString("pt-PT", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                          return (
                            <button
                              key={slot.startsAt}
                              type="button"
                              className={`rounded-full border px-3 py-1 text-[12px] ${
                                selected
                                  ? "border-emerald-300/60 bg-emerald-400/20 text-emerald-100"
                                  : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                              }`}
                              onClick={() =>
                                setRescheduleState((prev) =>
                                  prev ? { ...prev, selectedStartsAt: slot.startsAt, error: null } : prev,
                                )
                              }
                              disabled={rescheduleState.saving}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2 text-[12px] text-emerald-100 hover:bg-emerald-400/15 disabled:opacity-60"
                      onClick={submitReschedule}
                      disabled={rescheduleState.saving || rescheduleState.loading}
                    >
                      {rescheduleState.saving ? "A reagendar..." : "Confirmar reagendamento"}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[12px] text-white/70 hover:bg-white/10 disabled:opacity-60"
                      onClick={closeReschedule}
                      disabled={rescheduleState.saving}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {cancelPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-white/12 bg-[#0b0f1d] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.7)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">Cancelar</p>
                <p className="mt-1 text-sm text-white/80">Confirma os detalhes antes de cancelar.</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:bg-white/10"
                onClick={closeCancelPreview}
                disabled={cancelPreview.saving}
              >
                Fechar
              </button>
            </div>

            {cancelPreview.loading ? (
              <div className="mt-4 h-24 rounded-xl border border-white/10 orya-skeleton-surface animate-pulse" />
            ) : (
              <div className="mt-4 space-y-3">
                {cancelPreview.error && (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                    {cancelPreview.error}
                  </div>
                )}

                {cancelPreview.allowed === false && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                    <p>O prazo de cancelamento já passou.</p>
                    {cancelPreview.deadline && (
                      <p className="mt-2 text-[12px] text-white/50">
                        Deadline: {formatDeadline(cancelPreview.deadline)}
                      </p>
                    )}
                  </div>
                )}

                {cancelPreview.allowed !== false && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70 space-y-2">
                    {cancelPreview.deadline && (
                      <p className="text-[12px] text-white/50">
                        Podes cancelar até {formatDeadline(cancelPreview.deadline)}.
                      </p>
                    )}
                    {cancelPreview.refund ? (
                      <>
                        <p className="text-white/90">
                          Vais receber{" "}
                          <span className="font-semibold text-white">
                            {(cancelPreview.refund.refundCents / 100).toFixed(2)} {cancelPreview.refund.currency}
                          </span>
                        </p>
                        <div className="grid gap-2 md:grid-cols-3 text-[12px] text-white/60">
                          <div>
                            Total pago: {(cancelPreview.refund.totalCents / 100).toFixed(2)} {cancelPreview.refund.currency}
                          </div>
                          <div>
                            Fees retidas:{" "}
                            {((cancelPreview.refund.feesRetainedCents ?? 0) / 100).toFixed(2)} {cancelPreview.refund.currency}
                          </div>
                          <div>
                            Penalização: {(cancelPreview.refund.penaltyCents / 100).toFixed(2)} {cancelPreview.refund.currency}
                          </div>
                        </div>
                        <p className="text-[12px] text-white/50">
                          Nota: as fees de processamento e da plataforma não são devolvidas no cancelamento do cliente.
                        </p>
                      </>
                    ) : (
                      <p>O reembolso será calculado pela política da organização.</p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-red-400/40 bg-red-500/10 px-4 py-2 text-[12px] text-red-100 hover:bg-red-500/20 disabled:opacity-60"
                    onClick={confirmCancel}
                    disabled={cancelPreview.saving || cancelPreview.loading || cancelPreview.allowed === false}
                  >
                    {cancelPreview.saving ? "A cancelar..." : "Confirmar cancelamento"}
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[12px] text-white/70 hover:bg-white/10 disabled:opacity-60"
                    onClick={closeCancelPreview}
                    disabled={cancelPreview.saving}
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {inviteState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/12 bg-[#0b0f1d] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.7)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">Convites</p>
                <p className="mt-1 text-sm text-white/80">
                  Partilha o convite com os convidados. Eles podem responder pelo link.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:bg-white/10"
                onClick={closeInvites}
                disabled={inviteState.saving}
              >
                Fechar
              </button>
            </div>

            {(() => {
              const booking = items.find((b) => b.id === inviteState.bookingId) ?? null;
              return (
                <div className="mt-4 space-y-4">
                  {booking && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/70">
                      <p className="text-sm font-semibold text-white">
                        {booking.service?.title || "Serviço"}
                      </p>
                      <p>
                        {new Date(booking.startsAt).toLocaleString("pt-PT", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      {booking.organization?.publicName || booking.organization?.businessName ? (
                        <p className="text-white/60">
                          {booking.organization.publicName || booking.organization.businessName}
                        </p>
                      ) : null}
                    </div>
                  )}

                  {inviteState.loading ? (
                    <div className="h-24 rounded-xl border border-white/10 orya-skeleton-surface animate-pulse" />
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3">
                        <p className="text-[12px] text-white/60">Novo convite</p>
                        <div className="grid gap-2 md:grid-cols-2">
                          <input
                            type="text"
                            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                            placeholder="Nome (opcional)"
                            value={inviteState.name}
                            onChange={(e) =>
                              setInviteState((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                            }
                            disabled={inviteState.saving}
                          />
                          <input
                            type="text"
                            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                            placeholder="Email ou telemóvel"
                            value={inviteState.contact}
                            onChange={(e) =>
                              setInviteState((prev) => (prev ? { ...prev, contact: e.target.value } : prev))
                            }
                            disabled={inviteState.saving}
                          />
                        </div>
                        <textarea
                          rows={2}
                          className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                          placeholder="Mensagem (opcional)"
                          value={inviteState.message}
                          onChange={(e) =>
                            setInviteState((prev) => (prev ? { ...prev, message: e.target.value } : prev))
                          }
                          disabled={inviteState.saving}
                        />
                        {inviteState.error && (
                          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                            {inviteState.error}
                          </div>
                        )}
                        {inviteState.notice && (
                          <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
                            {inviteState.notice}
                          </div>
                        )}
                        <button
                          type="button"
                          className="rounded-full border border-sky-300/40 bg-sky-400/10 px-4 py-2 text-[12px] text-sky-100 hover:bg-sky-400/15 disabled:opacity-60"
                          onClick={submitInvite}
                          disabled={inviteState.saving}
                        >
                          {inviteState.saving ? "A enviar..." : "Enviar convite"}
                        </button>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3">
                        <p className="text-[12px] text-white/60">Convites enviados</p>
                        {inviteState.items.length === 0 ? (
                          <p className="text-sm text-white/70">Ainda não enviaste convites.</p>
                        ) : (
                          <div className="space-y-2">
                            {inviteState.items.map((invite) => {
                              const label = invite.targetName || invite.targetContact || "Convidado";
                              const respondedAt = invite.respondedAt
                                ? new Date(invite.respondedAt).toLocaleString("pt-PT", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })
                                : null;
                              const statusLabel = formatInviteStatus(invite.status);
                              const statusClass =
                                invite.status === "ACCEPTED"
                                  ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                                  : invite.status === "DECLINED"
                                    ? "border-red-400/40 bg-red-500/10 text-red-100"
                                    : "border-white/15 bg-white/10 text-white/70";
                              const inviteHref = `/convites/${invite.token}`;
                              const canResend =
                                invite.status === "PENDING" && Boolean(invite.targetContact?.includes("@"));
                              return (
                                <div key={invite.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-semibold text-white">{label}</p>
                                      {invite.targetContact && (
                                        <p className="text-[12px] text-white/60">{invite.targetContact}</p>
                                      )}
                                      {respondedAt && (
                                        <p className="text-[12px] text-white/50">Respondido em {respondedAt}</p>
                                      )}
                                    </div>
                                    <span className={`rounded-full border px-2 py-1 text-[11px] ${statusClass}`}>
                                      {statusLabel}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <Link
                                      href={inviteHref}
                                      target="_blank"
                                      className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:border-white/40"
                                    >
                                      Abrir convite
                                    </Link>
                                    <button
                                      type="button"
                                      className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:border-white/40"
                                      onClick={() => copyInviteLink(invite.token)}
                                    >
                                      {inviteState.copiedToken === invite.token ? "Copiado" : "Copiar link"}
                                    </button>
                                    {canResend && (
                                      <button
                                        type="button"
                                        className="rounded-full border border-sky-300/40 bg-sky-400/10 px-3 py-1 text-[11px] text-sky-100 hover:bg-sky-400/15 disabled:opacity-60"
                                        onClick={() => resendInvite(invite.id)}
                                        disabled={inviteState.resendingId === invite.id}
                                      >
                                        {inviteState.resendingId === invite.id ? "A reenviar..." : "Reenviar email"}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </main>
  );
}
