

// app/admin/page.tsx

import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function formatCurrencyFromCents(value: number | null | undefined) {
  if (!value || Number.isNaN(value)) return "0,00 €";
  const euros = value / 100;
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros);
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Sem sessão, não há painel de admin
    redirect("/");
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  const roles = Array.isArray(profile?.roles) ? profile?.roles : [];
  const isAdmin = roles?.includes("admin");

  if (!isAdmin) {
    // Utilizador autenticado mas sem role de admin
    redirect("/");
  }

  const [usersCount, organizersCount, eventsCount, ticketsCount, revenueAgg, recentEvents, recentTickets] =
    await Promise.all([
      prisma.profile.count(),
      prisma.organizer.count(),
      prisma.event.count(),
      prisma.ticket.count(),
      prisma.ticket.aggregate({
        _sum: {
          pricePaid: true,
        },
      }),
      prisma.event.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          slug: true,
          startsAt: true,
          status: true,
        },
      }),
      prisma.ticket.findMany({
        orderBy: { purchasedAt: "desc" },
        take: 5,
        select: {
          id: true,
          purchasedAt: true,
          pricePaid: true,
          currency: true,
          event: {
            select: {
              slug: true,
              title: true,
            },
          },
        },
      }),
    ]);

  const totalRevenueCents = revenueAgg._sum.pricePaid ?? 0;

  return (
    <main className="orya-body-bg min-h-screen w-full text-white pb-16">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-extrabold tracking-[0.15em]">
              AD
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                Painel interno
              </p>
              <p className="text-sm text-white/85">Admin ORYA – visão geral da plataforma</p>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pt-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Visão geral
          </h1>
          <p className="mt-1 max-w-xl text-sm text-white/70">
            Aqui consegues ver o estado global da ORYA: utilizadores, organizadores,
            eventos, bilhetes e o volume total processado.
          </p>
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/12 bg-black/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">
              Utilizadores
            </p>
            <p className="mt-2 text-2xl font-semibold">{usersCount}</p>
            <p className="mt-1 text-[11px] text-white/55">
              Contas com perfil criado.
            </p>
          </div>

          <div className="rounded-2xl border border-white/12 bg-black/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">
              Organizadores
            </p>
            <p className="mt-2 text-2xl font-semibold">{organizersCount}</p>
            <p className="mt-1 text-[11px] text-white/55">
              Entidades a criar eventos pagos.
            </p>
          </div>

          <div className="rounded-2xl border border-white/12 bg-black/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">
              Eventos
            </p>
            <p className="mt-2 text-2xl font-semibold">{eventsCount}</p>
            <p className="mt-1 text-[11px] text-white/55">
              Total de eventos registados.
            </p>
          </div>

          <div className="rounded-2xl border border-white/12 bg-black/70 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">
              Volume total
            </p>
            <p className="mt-2 text-xl font-semibold">
              {formatCurrencyFromCents(totalRevenueCents)}
            </p>
            <p className="mt-1 text-[11px] text-white/55">
              Soma dos pagamentos processados.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Últimos eventos criados */}
          <div className="rounded-2xl border border-white/12 bg-black/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/85">
                Últimos eventos criados
              </h2>
            </div>
            {recentEvents.length === 0 ? (
              <p className="text-[11px] text-white/60">
                Ainda não há eventos registados.
              </p>
            ) : (
              <ul className="space-y-2 text-[11px]">
                {recentEvents.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white/90">{ev.title}</span>
                      <span className="text-white/55">{formatDateTime(ev.startsAt)}</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                      {ev.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Últimos bilhetes vendidos */}
          <div className="rounded-2xl border border-white/12 bg-black/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white/85">
                Últimos bilhetes vendidos
              </h2>
            </div>
            {recentTickets.length === 0 ? (
              <p className="text-[11px] text-white/60">
                Ainda não há bilhetes registados.
              </p>
            ) : (
              <ul className="space-y-2 text-[11px]">
                {recentTickets.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white/90">
                        {t.event?.title ?? "Evento ORYA"}
                      </span>
                      <span className="text-white/55">
                        Vendido em {formatDateTime(t.purchasedAt)}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-white/80">
                      {formatCurrencyFromCents(t.pricePaid)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}