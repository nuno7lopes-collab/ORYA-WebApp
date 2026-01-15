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
};

type Response = {
  ok: boolean;
  items: BookingItem[];
  error?: string;
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
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<
      number,
      { open: boolean; rating: number; comment: string; saving: boolean; error: string | null }
    >
  >({});

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
    const confirmed = window.confirm("Cancelar esta reserva? O reembolso segue a politica da organização.");
    if (!confirmed) return;

    setCancelingId(bookingId);
    try {
      const res = await fetch(`/api/me/reservas/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao cancelar reserva.");
      }
      mutate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao cancelar reserva.";
      alert(message);
    } finally {
      setCancelingId(null);
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
              const isCancelled = ["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"].includes(booking.status);
              const isCompleted = booking.status === "COMPLETED";
              const isPending = ["PENDING_CONFIRMATION", "PENDING"].includes(booking.status);
              const canCancel = booking.cancellation.allowed && !isCancelled && !isCompleted;
              const canChat = booking.status === "CONFIRMED";
              const holdDeadline = isPending ? formatHoldDeadline(booking.pendingExpiresAt, booking.createdAt) : null;
              return (
                <div key={booking.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
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
                      {booking.status === "CONFIRMED" && deadlineLabel && (
                        <p className="mt-1 text-[12px] text-white/50">Cancelamento até {deadlineLabel}.</p>
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
    </main>
  );
}
