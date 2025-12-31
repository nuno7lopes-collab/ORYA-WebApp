"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const pageClass = "min-h-screen w-full text-white";

const cardClass =
  "rounded-3xl border border-white/12 bg-white/5 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl";

type BookingItem = {
  id: number;
  startsAt: string;
  durationMinutes: number;
  status: string;
  price: number;
  currency: string;
  createdAt: string;
  availabilityId: number | null;
  service: { id: number; name: string | null } | null;
  organizer: {
    id: number;
    publicName: string | null;
    businessName: string | null;
    city: string | null;
    username: string | null;
    brandingAvatarUrl: string | null;
  } | null;
  policy: {
    id: number;
    name: string;
    policyType: string;
    cancellationWindowMinutes: number | null;
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

function formatPolicy(policy: BookingItem["policy"]) {
  if (!policy) return "Sem política associada";
  if (policy.cancellationWindowMinutes == null) return `${policy.name} · Cancelamento indisponível`;
  return `${policy.name} · Cancelamento até ${Math.round(policy.cancellationWindowMinutes / 60)}h antes`;
}

function formatDeadline(deadline: string | null) {
  if (!deadline) return null;
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" });
}

export default function MinhasReservasPage() {
  const { data, isLoading, mutate } = useSWR<Response>("/api/me/reservas", fetcher);
  const [cancelingId, setCancelingId] = useState<number | null>(null);

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
    const confirmed = window.confirm("Cancelar esta reserva? Esta ação não devolve pagamentos automaticamente.");
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
            <Link href="/explorar?world=reservas" className="text-[12px] text-[#6BFFFF]">
              Explorar serviços
            </Link>
          </div>

          {isLoading && (
            <div className="mt-4 space-y-2">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="h-20 rounded-xl border border-white/10 bg-white/5 animate-pulse" />
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
              const canCancel = booking.cancellation.allowed && booking.status !== "CANCELLED";
              return (
                <div key={booking.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {booking.service?.name || "Serviço"}
                      </p>
                      <p className="text-[12px] text-white/60">
                        {new Date(booking.startsAt).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}
                        {booking.organizer?.publicName || booking.organizer?.businessName
                          ? ` · ${booking.organizer.publicName || booking.organizer.businessName}`
                          : ""}
                      </p>
                      {booking.policy && (
                        <p className="mt-1 text-[12px] text-white/50">
                          {formatPolicy(booking.policy)}
                          {deadlineLabel ? ` · até ${deadlineLabel}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/70">
                        {booking.status === "CONFIRMED"
                          ? "Confirmada"
                          : booking.status === "PENDING"
                            ? "Pendente"
                            : "Cancelada"}
                      </span>
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
                      {booking.service?.name || "Serviço"}
                    </p>
                    <p className="text-[12px] text-white/60">
                      {new Date(booking.startsAt).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/70">
                    {booking.status === "CANCELLED" ? "Cancelada" : "Concluída"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
