

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Link from "next/link";
import { useUser } from "@/app/hooks/useUser";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Falha ao carregar eventos de staff.");
  }
  return res.json();
};

type StaffEvent = {
  id: number;
  slug: string;
  title: string;
  startsAt: string;
  locationName: string | null;
  locationCity: string | null;
  organizerName: string | null;
};

type Invitation = {
  id: number;
  scope: "GLOBAL" | "EVENT";
  eventId: number | null;
  createdAt: string;
  event: {
    id: number;
    title: string;
    startsAt: string;
    locationName: string | null;
    locationCity: string | null;
  } | null;
  organizer: {
    id: number;
    publicName: string | null;
  } | null;
};

export default function StaffEventsPage() {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();

  const {
    data,
    error,
    isLoading: isEventsLoading,
  } = useSWR<{ ok: boolean; events: StaffEvent[] }>(
    user ? "/api/staff/events" : null,
    fetcher
  );

  const {
    data: invitationsData,
    mutate: mutateInvites,
    isLoading: isInvitesLoading,
  } = useSWR<{ ok: boolean; invitations: Invitation[] }>(
    user ? "/api/staff/invitations" : null,
    fetcher
  );

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace("/staff/login");
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p>A carregar a tua conta…</p>
      </div>
    );
  }

  if (!user) {
    // Enquanto o redirect não acontece, mostramos um fallback simples
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p>Redirecionar para a área de login de staff…</p>
      </div>
    );
  }

  const events = data?.events ?? [];
  const invitations = invitationsData?.invitations ?? [];

  const acceptInvite = async (id: number) => {
    await fetch("/api/staff/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId: id }),
    });
    mutateInvites();
  };

  const rejectInvite = async (id: number) => {
    await fetch("/api/staff/invitations/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId: id }),
    });
    mutateInvites();
  };

  const getBadgeLabel = (startsAt: string) => {
    if (!startsAt) return "";
    const now = new Date();
    const start = new Date(startsAt);

    const sameDay =
      start.getFullYear() === now.getFullYear() &&
      start.getMonth() === now.getMonth() &&
      start.getDate() === now.getDate();

    if (sameDay) return "Hoje";
    if (start < now) return "Já aconteceu";
    return "Próximo";
  };

  const formatDateTime = (startsAt: string) => {
    if (!startsAt) return "Data por definir";
    const d = new Date(startsAt);
    return d.toLocaleString("pt-PT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Eventos para check-in</h1>
        <p className="text-sm text-white/70">
          Aqui vês os eventos onde tens permissões de staff para fazer check-in
          de participantes.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Convites pendentes</h2>
        {isInvitesLoading && <p className="text-sm text-white/70">A carregar convites…</p>}
        {!isInvitesLoading && invitations.length === 0 && (
          <p className="text-sm text-white/50">Nenhum convite pendente.</p>
        )}
        {invitations.length > 0 && (
          <div className="space-y-2">
            {invitations.map((inv) => {
              const event = inv.event;
              const dateLabel = event?.startsAt
                ? new Date(event.startsAt).toLocaleString("pt-PT", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Data a anunciar";
              return (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {event?.title ?? "Evento"}
                    </p>
                    <p className="text-xs text-white/60">
                      {dateLabel} · {event?.locationName ?? event?.locationCity ?? "Local a definir"}
                    </p>
                    <p className="text-[11px] text-white/50">
                      Organizador: {inv.organizer?.publicName ?? "ORYA"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => acceptInvite(inv.id)}
                      className="rounded-md border border-emerald-400/60 px-3 py-1.5 text-xs font-medium text-emerald-100 hover:bg-emerald-500/10"
                    >
                      Aceitar
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectInvite(inv.id)}
                      className="rounded-md border border-red-400/60 px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-500/10"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {isEventsLoading && (
        <p>A carregar eventos onde tens acesso como staff…</p>
      )}

      {error && (
        <p className="text-sm text-red-400">
          Ocorreu um erro ao carregar os eventos de staff.
        </p>
      )}

      {!isEventsLoading && !error && events.length === 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm">
          <p>
            Neste momento não tens nenhum evento atribuído como staff. Pede ao
            organizador para te adicionar.
          </p>
        </div>
      )}

      {events.length > 0 && (
        <div className="space-y-3">
          {events.map((event) => {
            const badge = getBadgeLabel(event.startsAt);
            const dateLabel = formatDateTime(event.startsAt);
            const locationLabel = event.locationCity
              ? `${event.locationCity}${
                  event.locationName ? ` – ${event.locationName}` : ""
                }`
              : event.locationName ?? "Local a definir";

            return (
              <div
                key={event.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {event.title || "Evento sem título"}
                    </p>
                    {badge && (
                      <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                        {badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-white/60">{dateLabel}</p>
                  <p className="mt-1 text-xs text-white/60">{locationLabel}</p>
                  {event.organizerName && (
                    <p className="mt-1 text-[11px] text-white/50">
                      Organizador: {event.organizerName}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/staff/scan?eventId=${event.id}`)}
                  className="shrink-0 rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium hover:bg-white/10"
                >
                  Abrir scanner
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
