"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import {
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
  DASHBOARD_TITLE,
} from "@/app/organizacao/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ServiceItem = {
  id: number;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  currency: string;
  isActive: boolean;
  _count?: { bookings: number; availabilities: number };
};

type BookingItem = {
  id: number;
  startsAt: string;
  durationMinutes: number;
  status: string;
  price: number;
  currency: string;
  createdAt: string;
  service: { id: number; name: string | null } | null;
  user: { id: string; fullName: string | null; username: string | null; avatarUrl: string | null } | null;
};

export default function ReservasDashboardPage() {
  const { data: servicesData, isLoading: servicesLoading } = useSWR<{ ok: boolean; items: ServiceItem[] }>(
    "/api/organizacao/servicos",
    fetcher,
  );
  const { data: bookingsData, isLoading: bookingsLoading, mutate: mutateBookings } = useSWR<
    { ok: boolean; items: BookingItem[] }
  >("/api/organizacao/reservas", fetcher);
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  const services = servicesData?.items ?? [];
  const bookings = bookingsData?.items ?? [];

  const handleCancel = async (bookingId: number) => {
    if (cancelingId) return;
    const confirmed = window.confirm("Cancelar esta reserva? Esta ação não devolve pagamentos automaticamente.");
    if (!confirmed) return;

    setCancelingId(bookingId);
    try {
      const res = await fetch(`/api/organizacao/reservas/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao cancelar reserva.");
      }
      mutateBookings();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao cancelar reserva.";
      alert(message);
    } finally {
      setCancelingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={DASHBOARD_LABEL}>Reservas</p>
          <h1 className={DASHBOARD_TITLE}>Serviços e marcações</h1>
          <p className={DASHBOARD_MUTED}>Cria serviços, abre horários e acompanha reservas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/organizacao/reservas/politicas" className={CTA_SECONDARY}>
            Políticas
          </Link>
          <Link href="/organizacao/reservas/novo" className={CTA_PRIMARY}>
            Criar serviço
          </Link>
        </div>
      </div>

      <section className={cn(DASHBOARD_CARD, "p-5")}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Serviços</h2>
            <p className={DASHBOARD_MUTED}>Catálogo ativo da tua organização.</p>
          </div>
          <Link href="/organizacao/reservas/novo" className={CTA_SECONDARY}>
            Novo serviço
          </Link>
        </div>

        {servicesLoading && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, idx) => (
              <div key={idx} className="h-24 rounded-xl border border-white/10 bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {!servicesLoading && services.length === 0 && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            Ainda não tens serviços criados.
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {services.map((service) => (
            <Link
              key={service.id}
              href={`/organizacao/reservas/${service.id}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/25 hover:bg-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-white">{service.name}</p>
                  <p className="text-[12px] text-white/60">
                    {service.durationMinutes} min · {(service.price / 100).toFixed(2)} {service.currency}
                  </p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/70">
                  {service.isActive ? "Ativo" : "Inativo"}
                </span>
              </div>
              {service.description && (
                <p className="mt-2 text-[12px] text-white/65 line-clamp-2">{service.description}</p>
              )}
              <div className="mt-3 flex gap-2 text-[11px] text-white/60">
                <span>{service._count?.availabilities ?? 0} horários</span>
                <span>·</span>
                <span>{service._count?.bookings ?? 0} reservas</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className={cn(DASHBOARD_CARD, "p-5")}>
        <div>
          <h2 className="text-base font-semibold text-white">Próximas reservas</h2>
          <p className={DASHBOARD_MUTED}>Marcações confirmadas para os próximos dias.</p>
        </div>

        {bookingsLoading && (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="h-16 rounded-xl border border-white/10 bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {!bookingsLoading && bookings.length === 0 && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            Sem reservas por enquanto.
          </div>
        )}

        <div className="mt-4 space-y-2">
          {bookings.map((booking) => (
            <div key={booking.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {booking.service?.name || "Serviço"}
                  </p>
                  <p className="text-[12px] text-white/60">
                    {new Date(booking.startsAt).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}
                    {booking.user?.fullName || booking.user?.username
                      ? ` · ${booking.user.fullName || `@${booking.user.username}`}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/70">
                    {booking.status === "CONFIRMED"
                      ? "Confirmada"
                      : booking.status === "PENDING"
                        ? "Pendente"
                        : "Cancelada"}
                  </span>
                  {booking.status !== "CANCELLED" && (
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
          ))}
        </div>
      </section>
    </div>
  );
}
