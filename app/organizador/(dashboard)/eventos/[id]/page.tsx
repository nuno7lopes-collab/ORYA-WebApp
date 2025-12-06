// app/organizador/eventos/[id]/page.tsx
/* eslint-disable @next/next/no-html-link-for-pages */
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { notFound, redirect } from "next/navigation";
import type { Event, TicketType } from "@prisma/client";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type EventWithTickets = Event & {
  ticketTypes: TicketType[];
};

export default async function OrganizerEventDetailPage({ params }: PageProps) {
  const resolved = await params;

  // 1) Garante auth
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login");
  }

  const userId = data.user.id;

  const organizer = await prisma.organizer.findFirst({
    where: { userId },
  });

  if (!organizer) {
    redirect("/organizador");
  }

  const eventId = Number.parseInt(resolved.id, 10);
  if (!Number.isFinite(eventId)) {
    notFound();
  }

  // 2) Buscar evento + tipos de bilhete (waves)
  const event = (await prisma.event.findFirst({
    where: {
      id: eventId,
      organizerId: organizer.id,
    },
    include: {
      ticketTypes: {
        orderBy: {
          sortOrder: "asc",
        },
      },
    },
  })) as EventWithTickets | null;

  if (!event) {
    notFound();
  }

  const now = new Date();

  // 3) Métricas agregadas
  const totalWaves = event.ticketTypes.length;
  const totalTicketsSold = event.ticketTypes.reduce(
    (sum, t) => sum + t.soldQuantity,
    0,
  );
  const totalStock = event.ticketTypes.reduce(
    (sum, t) =>
      sum +
      (t.totalQuantity !== null && t.totalQuantity !== undefined
        ? t.totalQuantity
        : 0),
    0,
  );
  const overallOccupancy =
    totalStock > 0
      ? Math.min(100, Math.round((totalTicketsSold / totalStock) * 100))
      : null;

  const totalRevenueCents = event.ticketTypes.reduce(
    (sum, t) => sum + t.soldQuantity * (t.price ?? 0),
    0,
  );
  const totalRevenue = (totalRevenueCents / 100).toFixed(2);

  const cheapestWave = event.ticketTypes.length
    ? event.ticketTypes.reduce((min, t) =>
        ((t.price ?? 0) < (min.price ?? 0) ? t : min)
      )
    : null;

  const formatDateTime = (d: Date | null | undefined) => {
    if (!d) return null;
    return new Date(d).toLocaleString("pt-PT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatMoney = (cents: number) =>
    `${(cents / 100).toFixed(2)} €`.replace(".", ",");

  const startDateFormatted = formatDateTime(event.startsAt);
  const endDateFormatted = formatDateTime(event.endsAt);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 lg:px-8 space-y-7 text-white">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Gestão de evento</p>
          <h1 className="text-2xl font-semibold tracking-tight">Detalhes &amp; waves</h1>
          <p className="text-sm text-white/70 line-clamp-2">{event.title}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <a
            href="/organizador/eventos"
            className="px-3 py-1.5 rounded-xl border border-white/20 bg-white/5 text-white/80 hover:bg-white/10 transition"
          >
            ← Voltar à lista
          </a>
          <a
            href={`/eventos/${event.slug}`}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] font-semibold text-black hover:scale-[1.03] active:scale-95 transition-transform shadow-[0_0_22px_rgba(107,255,255,0.7)]"
          >
            Ver página pública
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)]">
        <div className="rounded-2xl border border-white/14 bg-black/45 backdrop-blur-xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                {event.title}
              </h2>
              <p className="mt-1 text-[11px] text-white/65">
                {startDateFormatted}
                {endDateFormatted ? ` — ${endDateFormatted}` : ""} •{" "}
                {event.locationName}
              </p>
              {event.address && (
                <p className="text-[11px] text-white/45">
                  {event.address}
                </p>
              )}
            </div>
            {event.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.coverImageUrl}
                alt={event.title}
                className="hidden md:block w-28 h-20 rounded-xl object-cover border border-white/20"
              />
            )}
          </div>

          {cheapestWave && (
            <p className="mt-1 text-[11px] text-white/70">
              Preço a partir de{" "}
              <span className="font-semibold">
                {formatMoney(cheapestWave.price ?? 0)}
              </span>{" "}
              ({totalWaves} wave{totalWaves !== 1 ? "s" : ""})
            </p>
          )}

          <p className="mt-1 text-[11px] text-white/60 line-clamp-3">
            {event.description}
          </p>

          <p className="mt-2 text-[10px] text-white/40 font-mono">
            ID: {event.id} • Slug: {event.slug}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#6BFFFF]/40 bg-[#02040b]/95 backdrop-blur-xl px-4 py-3.5">
            <p className="text-[11px] text-[#6BFFFF]/80">
              Bilhetes vendidos
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {totalTicketsSold}
            </p>
            {overallOccupancy !== null && (
              <p className="mt-1 text-[11px] text-white/65">
                {overallOccupancy}% de ocupação (stock total {totalStock})
              </p>
            )}

            {overallOccupancy !== null && (
              <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#6BFFFF] to-[#FF00C8]"
                  style={{ width: `${overallOccupancy}%` }}
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/14 bg-white/5 backdrop-blur-xl px-4 py-3.5">
            <p className="text-[11px] text-white/65">Receita bruta</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {totalRevenue.replace(".", ",")} €
            </p>
            <p className="mt-1 text-[11px] text-white/55">
              Calculado com base em preço × bilhetes vendidos, por wave.
            </p>
            <p className="mt-1 text-[10px] text-white/40">
              Nota: valores em modo de teste — integrar com relatórios reais
              mais tarde.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-white/12 bg-black/40 backdrop-blur-xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white/90">
              Waves &amp; bilhetes
            </h2>
            <p className="text-[11px] text-white/65">
              Visão por wave: estado, stock, vendas e receita individual.
            </p>
          </div>
        </div>

        {event.ticketTypes.length === 0 && (
          <div className="mt-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-4 text-[11px] text-white/70">
            Este evento ainda não tem waves configuradas. Usa o criador de
            eventos para adicionar bilhetes.
          </div>
        )}

        {event.ticketTypes.length > 0 && (
          <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
            {event.ticketTypes.map((ticket) => {
              const remaining =
                ticket.totalQuantity !== null &&
                ticket.totalQuantity !== undefined
                  ? ticket.totalQuantity - ticket.soldQuantity
                  : null;

              const occupancy =
                ticket.totalQuantity && ticket.totalQuantity > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (ticket.soldQuantity / ticket.totalQuantity) * 100,
                      ),
                    )
                  : null;

              // Determinar estado da wave
              let statusLabel = "A vender";
              let statusBadgeClass =
                "bg-emerald-500/10 border-emerald-400/70 text-emerald-100";
              const nowTime = now.getTime();
              const startsAtTime = ticket.startsAt
                ? new Date(ticket.startsAt).getTime()
                : null;
              const endsAtTime = ticket.endsAt
                ? new Date(ticket.endsAt).getTime()
                : null;

              if (
                ticket.totalQuantity !== null &&
                ticket.totalQuantity !== undefined &&
                ticket.soldQuantity >= ticket.totalQuantity
              ) {
                statusLabel = "Esgotado";
                statusBadgeClass =
                  "bg-red-500/10 border-red-400/70 text-red-100";
              } else if (startsAtTime && nowTime < startsAtTime) {
                statusLabel = "Em breve";
                statusBadgeClass =
                  "bg-amber-500/10 border-amber-400/70 text-amber-100";
              } else if (endsAtTime && nowTime > endsAtTime) {
                statusLabel = "Encerrado";
                statusBadgeClass =
                  "bg-white/8 border-white/30 text-white/75";
              }

              const startsAtLabel = formatDateTime(ticket.startsAt);
              const endsAtLabel = formatDateTime(ticket.endsAt);

              const revenueCents =
                ticket.soldQuantity * (ticket.price ?? 0);
              const revenue = (revenueCents / 100).toFixed(2);

              return (
                <article
                  key={ticket.id}
                  className="rounded-xl border border-white/14 bg-gradient-to-br from-white/5 via-black/80 to-black/95 px-4 py-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white/95">
                        {ticket.name}
                      </h3>
                      {ticket.description && (
                        <p className="mt-0.5 text-[11px] text-white/60 line-clamp-2">
                          {ticket.description}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-white/45 font-mono">
                        ID: {ticket.id}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-2 py-1 rounded-full border text-[10px] ${statusBadgeClass}`}
                      >
                        {statusLabel}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/20 text-[10px] text-white/80">
                        {formatMoney(ticket.price ?? 0)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-white/65">
                    {startsAtLabel && (
                      <span>
                        ⏱ Abre:{" "}
                        <span className="text-white/85">
                          {startsAtLabel}
                        </span>
                      </span>
                    )}
                    {endsAtLabel && (
                      <span>
                        Fecha:{" "}
                        <span className="text-white/85">{endsAtLabel}</span>
                      </span>
                    )}
                    {!startsAtLabel && !endsAtLabel && (
                      <span>Sem janela definida (sempre ativo).</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/80">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white/60">
                          Vendidos / stock:
                        </span>
                        <span className="font-semibold">
                          {ticket.soldQuantity}
                          {ticket.totalQuantity
                            ? ` / ${ticket.totalQuantity}`
                            : " / ∞"}
                        </span>
                        {remaining !== null && remaining >= 0 && (
                          <span className="text-[10px] text-white/55">
                            ({remaining} restantes)
                          </span>
                        )}
                      </div>

                      {occupancy !== null && (
                        <div className="h-1.5 w-40 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#6BFFFF] to-[#FF00C8]"
                            style={{ width: `${occupancy}%` }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1 text-right">
                      <span className="text-[10px] text-white/60">
                        Receita estimada
                      </span>
                      <span className="text-sm font-semibold">
                        {revenue.replace(".", ",")} €
                      </span>
                    </div>
                  </div>

                  <p className="mt-1 text-[10px] text-white/40">
                    Funcionalidades avançadas como lista de compras por
                    utilizador, links de promotores e tracking detalhado por
                    wave podem ser geridas na área de gestão avançada do
                    evento.
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
