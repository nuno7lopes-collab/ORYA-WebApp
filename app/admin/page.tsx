

// app/admin/page.tsx

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ReactNode } from "react";
import { AdminLayout } from "./components/AdminLayout";
import AdminDataPurgeTools from "@/app/admin/components/AdminDataPurgeTools";

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
type StatTone = "slate" | "teal" | "amber" | "indigo";

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
  tone = "slate",
}: {
  label: string;
  value: ReactNode;
  helper?: string;
  tone?: StatTone;
}) {
  const accents: Record<StatTone, string> = {
    slate: "from-white/10 via-white/5 to-transparent",
    teal: "from-teal-400/20 via-emerald-400/10 to-transparent",
    amber: "from-amber-400/20 via-orange-400/10 to-transparent",
    indigo: "from-indigo-400/18 via-sky-400/10 to-transparent",
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[rgba(10,14,22,0.9)] p-5 shadow-[0_24px_60px_rgba(2,6,14,0.45)]">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accents[tone]}`} aria-hidden />
      <div className="relative space-y-2">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">{label}</p>
        <div className="flex items-end gap-2">
          <p className="text-3xl font-semibold leading-tight text-white/95">{value}</p>
        </div>
        {helper && <p className="text-[12px] text-white/60">{helper}</p>}
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
    <div className="rounded-2xl border border-white/10 bg-[rgba(9,13,22,0.88)] p-5 shadow-[0_24px_60px_rgba(2,6,14,0.45)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Admin</p>
          <h2 className="text-sm font-semibold text-white/90">{title}</h2>
        </div>
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
  const paymentEventQuery = prisma.paymentEvent.findMany({
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
  });

  const [usersCount, organizationsCount, eventsCount, ticketsCount, revenueAgg, recentEvents, recentTickets, recentPaymentEvents, payoutCounts] =
    await Promise.all([
      prisma.profile.count(),
      prisma.organization.count(),
      prisma.event.count(),
      prisma.ticket.count(),
      prisma.saleSummary.aggregate({
        _sum: {
          totalCents: true,
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
      prisma.pendingPayout.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

  const totalRevenueCents = revenueAgg._sum.totalCents ?? 0;
  const payoutCountMap = new Map(payoutCounts.map((row) => [row.status, row._count._all]));
  const heldCount = payoutCountMap.get("HELD") ?? 0;
  const blockedCount = payoutCountMap.get("BLOCKED") ?? 0;
  const releasingCount = payoutCountMap.get("RELEASING") ?? 0;
  const releasedCount = payoutCountMap.get("RELEASED") ?? 0;
  return (
    <AdminLayout
      title="Admin ORYA – visão geral da plataforma"
      subtitle="Monitoriza utilizadores, organizações, eventos, bilhetes e pagamentos num só ecrã."
    >
      <section className="space-y-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/50">Visão geral</p>
            <h1 className="text-3xl font-semibold tracking-tight text-white/95 md:text-4xl">Painel geral</h1>
            <p className="max-w-2xl text-sm text-white/65">
              Estado global da ORYA, métricas críticas e atividade recente para decisão rápida.
            </p>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Utilizadores" value={usersCount} helper="Contas com perfil criado." tone="slate" />
          <StatCard label="Organizações" value={organizationsCount} helper="Entidades com atividade." tone="teal" />
          <StatCard label="Eventos" value={eventsCount} helper="Eventos registados." tone="indigo" />
          <StatCard label="Volume total" value={formatCurrencyFromCents(totalRevenueCents)} helper="Receita processada." tone="amber" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.6fr]">
          <SectionCard title="Payouts e bloqueios">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">HELD</p>
                <p className="text-2xl font-semibold text-white/90">{heldCount}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">BLOCKED</p>
                <p className="text-2xl font-semibold text-white/90">{blockedCount}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">RELEASING</p>
                <p className="text-2xl font-semibold text-white/90">{releasingCount}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">RELEASED</p>
                <p className="text-2xl font-semibold text-white/90">{releasedCount}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
              <Badge tone="warning">HELD</Badge>
              <Badge tone="warning">BLOCKED</Badge>
              <Badge tone="neutral">RELEASING</Badge>
              <Badge tone="positive">RELEASED</Badge>
            </div>
          </SectionCard>

          <SectionCard
            title="Pagamentos recentes"
            action={
              <Link href="/admin/finance#pagamentos" className="text-[12px] text-white/70 hover:text-white">
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

        <SectionCard title="Limpeza de dados">
          <AdminDataPurgeTools />
        </SectionCard>
      </section>
    </AdminLayout>
  );
}
