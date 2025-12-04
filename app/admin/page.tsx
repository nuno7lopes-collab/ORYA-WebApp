

// app/admin/page.tsx

import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ReactNode } from "react";
import { AdminLayout } from "./components/AdminLayout";

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

type BadgeTone = "neutral" | "positive" | "warning" | "danger";
type StatTone = "magenta" | "cyan" | "emerald" | "indigo";

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  const tones: Record<BadgeTone, string> = {
    neutral: "border-white/15 bg-white/10 text-white/80",
    positive: "border-emerald-300/50 bg-emerald-500/10 text-emerald-100",
    warning: "border-amber-300/60 bg-amber-500/15 text-amber-100",
    danger: "border-rose-300/60 bg-rose-500/15 text-rose-100",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${tones[tone]}`}>
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  helper,
  tone = "magenta",
}: {
  label: string;
  value: ReactNode;
  helper?: string;
  tone?: StatTone;
}) {
  const accents: Record<StatTone, string> = {
    magenta: "from-[#FF00C8]/16 via-[#8b5cf6]/20 to-[#1b1f32]/60",
    cyan: "from-[#6BFFFF]/20 via-[#1fb6ff]/18 to-[#0e1729]/70",
    emerald: "from-emerald-400/14 via-emerald-500/12 to-[#0e1f1a]/80",
    indigo: "from-indigo-400/14 via-indigo-500/12 to-[#0e1226]/80",
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/70 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accents[tone]}`} aria-hidden />
      <div className="relative space-y-1">
        <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">{label}</p>
        <div className="flex items-end gap-2">
          <p className="text-3xl font-semibold leading-tight">{value}</p>
        </div>
        {helper && <p className="text-[11px] text-white/60">{helper}</p>}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/12 bg-black/70 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white/90">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function toneForStatus(status: string | null | undefined): BadgeTone {
  const normalized = (status || "").toUpperCase();
  if (["PUBLISHED", "ACTIVE", "SUCCEEDED", "CONFIRMED"].includes(normalized)) return "positive";
  if (["PENDING", "DRAFT", "PROCESSING"].includes(normalized)) return "warning";
  if (["CANCELLED", "FAILED", "SUSPENDED"].includes(normalized)) return "danger";
  return "neutral";
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

  // prisma.paymentEvent pode não existir se o client não estiver regenerado;
  // fallback defensivo para evitar crash em caso de client antigo.
  const paymentEventQuery = prisma.paymentEvent
    ? prisma.paymentEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          stripePaymentIntentId: true,
          status: true,
          eventId: true,
          amountCents: true,
          platformFeeCents: true,
          errorMessage: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    : Promise.resolve([]);

  const [usersCount, organizersCount, eventsCount, ticketsCount, revenueAgg, recentEvents, recentTickets, recentPaymentEvents] =
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
      paymentEventQuery,
    ]);

  const totalRevenueCents = revenueAgg._sum.pricePaid ?? 0;

  return (
    <AdminLayout
      title="Admin ORYA – visão geral da plataforma"
      subtitle="Monitoriza utilizadores, organizadores, eventos, bilhetes e pagamentos num só ecrã."
    >
      <section className="space-y-8">
        <div className="space-y-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Painel geral
            </h1>
            <p className="max-w-2xl text-sm text-white/70">
              Estado global da ORYA e atalhos para as áreas críticas. Usa os links rápidos abaixo para abrir listas detalhadas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <Link
              href="/admin/organizadores"
              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/80 transition hover:border-white/25 hover:bg-white/10"
            >
              Gerir pedidos de organizador
            </Link>
            <Link
              href="/admin/eventos"
              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/80 transition hover:border-white/25 hover:bg-white/10"
            >
              Ver eventos
            </Link>
            <Link
              href="/admin/payments"
              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/80 transition hover:border-white/25 hover:bg-white/10"
            >
              Pagamentos / intents
            </Link>
            <Link
              href="/admin/tickets"
              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/80 transition hover:border-white/25 hover:bg-white/10"
            >
              Auditoria de bilhetes
            </Link>
            <Link
              href="/admin/settings"
              className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/80 transition hover:border-white/25 hover:bg-white/10"
            >
              Configurações
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Utilizadores"
            value={usersCount}
            helper="Contas com perfil criado."
            tone="magenta"
          />
          <StatCard
            label="Organizadores"
            value={organizersCount}
            helper="Entidades a criar eventos pagos."
            tone="emerald"
          />
          <StatCard
            label="Eventos"
            value={eventsCount}
            helper="Total de eventos registados."
            tone="indigo"
          />
          <StatCard
            label="Bilhetes"
            value={ticketsCount}
            helper="Total de bilhetes emitidos."
            tone="indigo"
          />
          <StatCard
            label="Volume total"
            value={formatCurrencyFromCents(totalRevenueCents)}
            helper="Soma dos pagamentos processados."
            tone="cyan"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard
            title="Últimos eventos criados"
            action={
              <Link href="/admin/eventos" className="text-[12px] text-white/70 hover:text-white">
                Ver todos
              </Link>
            }
          >
            {recentEvents.length === 0 ? (
              <p className="text-[12px] text-white/60">Ainda não há eventos registados.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {recentEvents.map((ev) => (
                  <div key={ev.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-[13px] font-medium text-white/90">{ev.title}</p>
                      <p className="text-[12px] text-white/55">{formatDateTime(ev.startsAt)}</p>
                    </div>
                    <Badge tone={toneForStatus(ev.status)}>{ev.status ?? "—"}</Badge>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Últimos bilhetes vendidos"
            action={
              <Link href="/admin/tickets" className="text-[12px] text-white/70 hover:text-white">
                Abrir auditoria
              </Link>
            }
          >
            {recentTickets.length === 0 ? (
              <p className="text-[12px] text-white/60">Ainda não há bilhetes registados.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {recentTickets.map((t) => (
                  <div key={t.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-[13px] font-medium text-white/90">
                        {t.event?.title ?? "Evento ORYA"}
                      </p>
                      <p className="text-[12px] text-white/55">
                        Vendido em {formatDateTime(t.purchasedAt)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-white/90">
                      {formatCurrencyFromCents(t.pricePaid)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard
          title="Pagamentos / intents recentes"
          action={
            <Link href="/admin/payments" className="text-[12px] text-white/70 hover:text-white">
              Ver pagamentos
            </Link>
          }
        >
          {recentPaymentEvents.length === 0 ? (
            <p className="text-[12px] text-white/60">Sem eventos de pagamento registados.</p>
          ) : (
            <div className="divide-y divide-white/5 text-[13px]">
              {recentPaymentEvents.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-1 items-center gap-3">
                    <Badge tone={toneForStatus(p.status)}>{p.status ?? "—"}</Badge>
                    <div className="space-y-0.5">
                      <p className="font-medium text-white/90">
                        {p.stripePaymentIntentId ?? "Intent"}
                      </p>
                      <p className="text-[12px] text-white/55">
                        Atualizado {formatDateTime(p.updatedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white/90">
                      {formatCurrencyFromCents(p.amountCents ?? 0)}
                    </p>
                    <p className="text-[11px] text-white/55">
                      Fee plataforma {formatCurrencyFromCents(p.platformFeeCents ?? 0)}
                    </p>
                  </div>
                  {p.errorMessage && (
                    <p className="text-[11px] text-rose-200">Erro: {p.errorMessage}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </section>
    </AdminLayout>
  );
}
