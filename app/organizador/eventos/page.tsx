// app/organizador/eventos/page.tsx
/* eslint-disable @next/next/no-html-link-for-pages */

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { TicketStatus } from "@prisma/client";

export default async function OrganizerEventsPage() {
  // 1) Garante que só entra quem está autenticado
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login?redirectTo=/organizador/eventos");
  }

  const userId = data.user.id;

  // 2) Encontrar o organizer associado a este utilizador
  const organizer = await prisma.organizer.findFirst({
    where: { userId },
  });

  if (!organizer) {
    // Ainda não é organizador → envia para a home do painel do organizador
    redirect("/organizador");
  }

  // 3) Buscar eventos deste organizer
  const events = await prisma.event.findMany({
    where: { organizerId: organizer.id },
    orderBy: {
      startsAt: "asc",
    },
    select: {
      id: true,
      slug: true,
      title: true,
      startsAt: true,
      endsAt: true,
      locationName: true,
      locationCity: true,
      status: true,
      organizerId: true,
    },
  });

  const ticketStats = await prisma.ticket.groupBy({
    by: ["eventId"],
    where: {
      status: { in: [TicketStatus.ACTIVE, TicketStatus.USED] },
      event: { organizerId: organizer.id },
    },
    _count: { _all: true },
    _sum: { pricePaid: true, totalPaidCents: true, platformFeeCents: true },
  });

  const statsMap = new Map<number, { tickets: number; revenueCents: number; totalPaidCents: number; platformFeeCents: number }>();
  ticketStats.forEach((stat) => {
    statsMap.set(stat.eventId, {
      tickets: stat._count._all,
      revenueCents: stat._sum.pricePaid ?? 0,
      totalPaidCents: stat._sum.totalPaidCents ?? 0,
      platformFeeCents: stat._sum.platformFeeCents ?? 0,
    });
  });

  const now = new Date();
  const totalEvents = events.length;
  const upcomingEvents = events.filter((e) => e.startsAt > now).length;
  const totalTickets = ticketStats.reduce((sum, s) => sum + s._count._all, 0);
  const totalRevenueCents = ticketStats.reduce((sum, s) => sum + (s._sum.pricePaid ?? 0), 0);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1a1030_0,_#050509_45%,_#02020a_100%)] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-extrabold tracking-[0.15em]">
              OR
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                Painel do organizador
              </p>
              <p className="text-sm text-white/85">
                Visão geral dos eventos criados na ORYA.
              </p>
            </div>
          </div>

          <a
            href="/organizador/eventos/novo"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-[11px] font-semibold text-black hover:scale-[1.03] active:scale-95 transition-transform shadow-[0_0_24px_rgba(107,255,255,0.6)]"
          >
            Criar novo evento
          </a>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-5 py-8 md:py-10 space-y-6">
        {/* Métricas principais (simples) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/14 bg-white/5 backdrop-blur-xl px-4 py-3.5">
            <p className="text-[11px] text-white/60">Eventos totais</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {totalEvents}
            </p>
            <p className="mt-1 text-[11px] text-white/55">
              Todos os eventos que já criaste como organizador.
            </p>
          </div>

          <div className="rounded-2xl border border-white/14 bg-white/5 backdrop-blur-xl px-4 py-3.5">
            <p className="text-[11px] text-white/60">Próximos eventos</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {upcomingEvents}
            </p>
            <p className="mt-1 text-[11px] text-white/55">
              Eventos com data ainda por acontecer.
            </p>
          </div>

          <div className="rounded-2xl border border-white/14 bg-white/5 backdrop-blur-xl px-4 py-3.5">
            <p className="text-[11px] text-white/60">Bilhetes vendidos</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {totalTickets}
            </p>
            <p className="mt-1 text-[11px] text-white/55">
              Contam apenas bilhetes ativos/usados.
            </p>
          </div>

          <div className="rounded-2xl border border-white/14 bg-white/5 backdrop-blur-xl px-4 py-3.5">
            <p className="text-[11px] text-white/60">Receita bruta</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {(totalRevenueCents / 100).toFixed(2)} €
            </p>
            <p className="mt-1 text-[11px] text-white/55">
              Soma do preço de bilhete recebido (antes de taxas Stripe).
            </p>
          </div>
        </div>

        {/* Lista de eventos */}
        <section className="rounded-2xl border border-white/12 bg-black/40 backdrop-blur-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white/90">
                Meus eventos
              </h2>
              <p className="text-[11px] text-white/65">
                Lista de eventos criados por ti como organizador.
              </p>
            </div>
          </div>

          {events.length === 0 && (
            <div className="mt-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-4 text-[11px] text-white/70 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="font-medium text-white/85">
                  Ainda não tens eventos criados.
                </p>
                <p className="mt-1 text-white/60">
                  Cria o teu primeiro evento para começares a vender bilhetes e
                  testar o fluxo completo da ORYA.
                </p>
              </div>
              <a
                href="/organizador/eventos/novo"
                className="inline-flex px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-[11px] font-semibold text-black hover:scale-[1.03] active:scale-95 transition-transform shadow-[0_0_24px_rgba(107,255,255,0.6)]"
              >
                Criar evento
              </a>
            </div>
          )}

          {events.length > 0 && (
            <div className="mt-3 space-y-3">
              {events.map((event) => {
                const stats = statsMap.get(event.id);
                const ticketsSold = stats?.tickets ?? 0;
                const revenueEuro = ((stats?.revenueCents ?? 0) / 100).toFixed(2);

                const isPast = event.startsAt < now;
                const statusLabel = isPast
                  ? "Terminado"
                  : event.status === "PUBLISHED"
                  ? "Publicado"
                  : event.status === "DRAFT"
                  ? "Rascunho"
                  : event.status;
                const statusClasses = isPast
                  ? "bg-white/8 border-white/30 text-white/80"
                  : "bg-emerald-500/10 border-emerald-400/60 text-emerald-100";

                const dateFormatted = event.startsAt.toLocaleString("pt-PT", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <article
                    key={event.id}
                    className="rounded-xl border border-white/14 bg-gradient-to-br from-white/5 via-black/80 to-black/95 px-4 py-3.5 flex flex-col gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white/95">
                          {event.title}
                        </h3>
                        <p className="mt-0.5 text-[11px] text-white/60">
                          {dateFormatted}
                          {event.locationName ? ` • ${event.locationName}` : ""}
                          {event.locationCity ? `, ${event.locationCity}` : ""}
                        </p>
                        <p className="mt-1 text-[11px] text-white/65">
                          {ticketsSold} bilhetes · {revenueEuro} €
                        </p>
                        <p className="mt-1 text-[10px] text-white/55">
                          Slug:{" "}
                          <span className="font-mono text-[10px] text-white/75">
                            {event.slug}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`px-2 py-1 rounded-full border text-[10px] ${statusClasses}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-[10px]">
                      <div className="flex items-center gap-2 text-white/60">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/8 border border-white/15">
                          🎟️
                        </span>
                        <span>
                          Gere bilhetes, detalhes e estatísticas na página de
                          gestão do evento.
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={`/eventos/${event.slug}`}
                          className="px-3 py-1.5 rounded-xl border border-white/25 bg-white/5 text-[10px] text-white/85 hover:bg-white/10 transition"
                        >
                          Ver página pública
                        </a>
                        <a
                          href={`/organizador/eventos/${event.id}`}
                          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-[10px] font-semibold text-black hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_0_20px_rgba(107,255,255,0.6)]"
                        >
                          Detalhes &amp; gestão
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
