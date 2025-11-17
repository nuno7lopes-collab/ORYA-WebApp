// app/dashboard/events/page.tsx
import { prisma } from "@/lib/prisma";
import type { Event, Ticket, TicketPurchase } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabaseServer";

type EventWithDetails = Event & {
  tickets: Ticket[];
  purchases: TicketPurchase[];
};

function formatDateRange(start: Date, end: Date) {
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  const startStr = start.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const endStr = end.toLocaleString("pt-PT", {
    day: sameDay ? undefined : "2-digit",
    month: sameDay ? undefined : "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (sameDay) {
    return `${startStr} — ${endStr}`;
  }

  return `${startStr} → ${endStr}`;
}

function classifyEvent(start: Date, end: Date): "past" | "live" | "upcoming" {
  const now = new Date();
  if (end < now) return "past";
  if (start > now) return "upcoming";
  return "live";
}

export default async function DashboardEventsPage() {
  // 🔐 Garantir que só utilizadores autenticados acedem ao painel
  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    redirect("/login?redirect=/dashboard/events");
  }

  // ⚠️ Neste momento ainda não temos um campo "ownerId" no Event,
  // por isso mostramos TODOS os eventos como painel global.
  // Quando adicionarmos ownerId, filtramos por esse id.
  const events = (await prisma.event.findMany({
    orderBy: { startDate: "desc" },
    include: {
      tickets: true,
      purchases: true,
    },
  })) as EventWithDetails[];

  if (!events.length) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1a1030_0,_#050509_45%,_#02020a_100%)] text-white">
        <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-extrabold tracking-[0.15em]">
                OR
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                  Painel de eventos
                </p>
                <p className="text-sm text-white/80">
                  Acompanhar vendas e waves dos teus eventos.
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="max-w-3xl mx-auto px-6 md:px-10 py-12 text-center">
          <div className="inline-flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-8 backdrop-blur-xl">
            <span className="text-3xl">🕊️</span>
            <h1 className="text-xl font-semibold">Ainda não há eventos</h1>
            <p className="text-sm text-white/65 max-w-sm">
              Assim que começares a criar eventos na ORYA, vais vê-los aqui com
              resumo de vendas, waves e receita.
            </p>
            <Link
              href="/eventos/novo"
              className="mt-2 inline-flex items-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2.5 text-xs font-semibold text-black shadow-[0_0_28px_rgba(107,255,255,0.6)] hover:scale-[1.02] active:scale-95 transition-transform"
            >
              + Criar primeiro evento
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1a1030_0,_#050509_45%,_#02020a_100%)] text-white">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-extrabold tracking-[0.15em]">
              OR
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                Painel de eventos
              </p>
              <p className="text-sm text-white/80">
                Visão rápida de vendas, waves e performance.
              </p>
            </div>
          </div>

          <Link
            href="/eventos/novo"
            className="hidden sm:inline-flex items-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-[11px] font-semibold text-black shadow-[0_0_20px_rgba(107,255,255,0.55)] hover:scale-[1.02] active:scale-95 transition-transform"
          >
            + Criar evento
          </Link>
        </div>
      </header>

      {/* Conteúdo principal */}
      <section className="max-w-6xl mx-auto px-6 md:px-10 py-10 md:py-14 space-y-6">
        {/* Resumo global */}
        <GlobalSummary events={events} />

        {/* Lista de eventos */}
        <div className="space-y-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>
    </main>
  );
}

function GlobalSummary({ events }: { events: EventWithDetails[] }) {
  const totalEvents = events.length;

  const totalTicketsSold = events.reduce((sum, ev) => {
    return (
      sum +
      ev.tickets.reduce((s, t) => s + (t.soldQuantity ?? 0), 0)
    );
  }, 0);

  const totalRevenue = events.reduce((sum, ev) => {
    return sum + ev.purchases.reduce((s, p) => s + p.pricePaid, 0);
  }, 0);

  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.03] backdrop-blur-xl px-5 py-4 md:px-6 md:py-5 shadow-[0_20px_60px_rgba(0,0,0,0.65)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            Os teus eventos na ORYA
          </h1>
          <p className="mt-1 text-xs text-white/65 max-w-md">
            Esta área dá-te uma visão rápida das waves, vendas e receita dos
            eventos que estão a viver (ou viveram) na plataforma.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl border border-white/12 bg-black/40 px-3 py-2.5">
            <p className="text-[10px] text-white/55">Eventos</p>
            <p className="mt-1 text-lg font-semibold">{totalEvents}</p>
          </div>
          <div className="rounded-xl border border-[#6BFFFF]/40 bg-[#02040b]/80 px-3 py-2.5">
            <p className="text-[10px] text-[#CFFFFF]">Bilhetes vendidos</p>
            <p className="mt-1 text-lg font-semibold">{totalTicketsSold}</p>
          </div>
          <div className="rounded-xl border border-[#FF00C8]/40 bg-[#210015]/80 px-3 py-2.5">
            <p className="text-[10px] text-[#FFD6F6]">Receita total</p>
            <p className="mt-1 text-lg font-semibold">
              {totalRevenue.toFixed(2)} €
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventCard({ event }: { event: EventWithDetails }) {
  const status = classifyEvent(event.startDate, event.endDate);

  let statusLabel: string;
  let statusClasses: string;

  switch (status) {
    case "live":
      statusLabel = "A decorrer";
      statusClasses =
        "bg-emerald-500/15 border-emerald-400/60 text-emerald-100";
      break;
    case "upcoming":
      statusLabel = "Próximo";
      statusClasses =
        "bg-[#6BFFFF]/12 border-[#6BFFFF]/60 text-[#E5FEFF]";
      break;
    case "past":
    default:
      statusLabel = "Concluído";
      statusClasses =
        "bg-white/6 border-white/25 text-white/65";
      break;
  }

  const totalTicketsSold = event.tickets.reduce(
    (sum, t) => sum + (t.soldQuantity ?? 0),
    0,
  );

  const totalRevenue = event.purchases.reduce(
    (sum, p) => sum + p.pricePaid,
    0,
  );

  const cheapestTicket = event.tickets.length
    ? event.tickets.reduce((min, t) =>
        t.price < min.price ? t : min,
      )
    : null;

  return (
    <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/[0.03] via-black/80 to-black/95 px-4 py-4 md:px-5 md:py-5 space-y-3">
      {/* Linha de topo: título + estado + ações */}
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/eventos/${event.slug}`}
              className="text-sm md:text-base font-semibold text-white hover:text-[#6BFFFF] transition-colors"
            >
              {event.title}
            </Link>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${statusClasses}`}
            >
              {statusLabel}
            </span>
          </div>
          <p className="text-[11px] text-white/55">
            {event.locationName} •{" "}
            {formatDateRange(event.startDate, event.endDate)}
          </p>
          {event.organizerName && (
            <p className="text-[10px] text-white/40">
              Organizado por {event.organizerName}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <Link
            href={`/eventos/${event.slug}`}
            className="rounded-full border border-white/18 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 hover:bg-white/10 transition-colors"
          >
            Ver página pública
          </Link>
        </div>
      </div>

      {/* Linha de métricas rápidas */}
      <div className="grid grid-cols-3 gap-3 text-[11px]">
        <div className="rounded-xl border border-white/12 bg-black/50 px-3 py-2">
          <p className="text-[10px] text-white/55">Bilhetes vendidos</p>
          <p className="mt-1 text-base font-semibold">{totalTicketsSold}</p>
        </div>
        <div className="rounded-xl border border-[#6BFFFF]/40 bg-[#02040b]/80 px-3 py-2">
          <p className="text-[10px] text-[#CFFFFF]">Receita</p>
          <p className="mt-1 text-base font-semibold">
            {totalRevenue.toFixed(2)} €
          </p>
        </div>
        <div className="rounded-xl border border-white/12 bg-black/60 px-3 py-2">
          <p className="text-[10px] text-white/55">A partir de</p>
          <p className="mt-1 text-base font-semibold">
            {cheapestTicket
              ? `${cheapestTicket.price.toFixed(2)} ${cheapestTicket.currency}`
              : event.isFree
                ? "Grátis"
                : "–"}
          </p>
        </div>
      </div>

      {/* Waves / bilhetes por evento */}
      {event.tickets.length > 0 && (
        <div className="mt-2 rounded-xl border border-white/10 bg-black/50 px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-medium text-white/80">
              Waves &amp; bilhetes
            </p>
            <p className="text-[10px] text-white/45">
              {event.tickets.length} wave(s)
            </p>
          </div>

          <div className="space-y-1.5">
            {event.tickets
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((ticket, idx) => {
                const total = ticket.totalQuantity;
                const sold = ticket.soldQuantity ?? 0;
                const remaining =
                  total === null || total === undefined
                    ? null
                    : Math.max(total - sold, 0);

                let stockLabel: string;
                if (remaining === null) {
                  stockLabel = "Stock ilimitado";
                } else if (remaining <= 0) {
                  stockLabel = "Esgotado";
                } else {
                  stockLabel = `${remaining} restante(s)`;
                }

                return (
                  <div
                    key={ticket.id}
                    className="flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] text-white/70">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-white/90">
                        {ticket.name}
                      </span>
                      {!ticket.available && (
                        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] text-white/55">
                          Inativo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-white/60">
                      <span>
                        {ticket.price.toFixed(2)} {ticket.currency}
                      </span>
                      <span>
                        Vendidos:{" "}
                        <span className="text-white/90 font-medium">
                          {sold}
                        </span>
                      </span>
                      <span className="text-white/45">{stockLabel}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}