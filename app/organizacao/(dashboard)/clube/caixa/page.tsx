"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import useSWR from "swr";
import { useSearchParams } from "next/navigation";
import ObjectiveSubnav from "@/app/organizacao/ObjectiveSubnav";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
  DASHBOARD_TITLE,
} from "@/app/organizacao/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type FinanceResponse = {
  ok: boolean;
  bookings: {
    confirmedRevenueCents: number;
    confirmedCount: number;
    pendingCount: number;
    totalCount: number;
    upcomingCount: number;
  };
  recentBookings: Array<{
    id: number;
    startsAt: string;
    status: string;
    price: number;
    currency: string;
    serviceName: string | null;
    courtName: string | null;
    userName: string | null;
  }>;
  error?: string;
};

export default function ClubeCaixaPage() {
  const searchParams = useSearchParams();
  const organizationIdParam = searchParams?.get("organizationId") ?? null;
  const organizationId = organizationIdParam ? Number(organizationIdParam) : null;
  const { data } = useSWR<FinanceResponse>(resolveCanonicalOrgApiPath("/api/org/[orgId]/club/finance/overview"), fetcher);

  const bookings = data?.bookings;
  const recentBookings = data?.recentBookings ?? [];

  const money = (value?: number) => ((value ?? 0) / 100).toFixed(2);

  return (
    <div className="space-y-6">
      <ObjectiveSubnav
        objective="manage"
        activeId="caixa"
        mode="page"
        organizationId={organizationId && Number.isFinite(organizationId) ? organizationId : null}
      />

      <div>
        <p className={DASHBOARD_LABEL}>Clube</p>
        <h1 className={DASHBOARD_TITLE}>Caixa & reservas</h1>
        <p className={DASHBOARD_MUTED}>Resumo rapido do movimento de reservas.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className={cn(DASHBOARD_CARD, "p-4")}> 
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Receita reservas</p>
          <p className="mt-2 text-2xl font-semibold text-white">{money(bookings?.confirmedRevenueCents)} EUR</p>
          <p className={DASHBOARD_MUTED}>{bookings?.confirmedCount ?? 0} confirmadas</p>
        </div>
        <div className={cn(DASHBOARD_CARD, "p-4")}> 
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Pendentes</p>
          <p className="mt-2 text-2xl font-semibold text-white">{bookings?.pendingCount ?? 0}</p>
          <p className={DASHBOARD_MUTED}>{bookings?.totalCount ?? 0} total</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-1">
        <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}> 
          <div>
            <p className="text-sm font-semibold text-white">Proximas reservas</p>
            <p className={DASHBOARD_MUTED}>Agenda confirmada e pendente.</p>
          </div>
          {recentBookings.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/60">
              Sem reservas recentes.
            </div>
          ) : (
            <div className="space-y-2">
              {recentBookings.map((booking) => (
                <div key={booking.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {booking.serviceName || "Reserva"}
                        {booking.courtName ? ` - ${booking.courtName}` : ""}
                      </p>
                      <p className="text-[12px] text-white/60">
                        {new Date(booking.startsAt).toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" })}
                        {booking.userName ? ` - ${booking.userName}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white/70">
                      {(booking.price / 100).toFixed(2)} {booking.currency}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
