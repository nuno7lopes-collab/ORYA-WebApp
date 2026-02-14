"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import Link from "next/link";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import {
  CTA_PRIMARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
  DASHBOARD_TITLE,
} from "@/app/org/_shared/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ServiceItem = {
  id: number;
  title: string;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
};

const formatPrice = (cents: number, currency: string) => `${(cents / 100).toFixed(2)} ${currency}`;

export default function ReservasServicosPage() {
  const { data, isLoading } = useSWR<{ ok: boolean; items: ServiceItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/servicos"),
    fetcher,
  );
  const services = data?.items ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className={DASHBOARD_LABEL}>Reservas</p>
          <h1 className={DASHBOARD_TITLE}>Serviços</h1>
          <p className={DASHBOARD_MUTED}>Cria e gere o catálogo de serviços.</p>
        </div>
        <Link href="/organizacao/reservas?create=service" className={CTA_PRIMARY}>
          Novo serviço
        </Link>
      </header>

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}>
        {isLoading && <p className="text-[12px] text-white/60">A carregar...</p>}
        {!isLoading && services.length === 0 && (
          <p className="text-[12px] text-white/50">Ainda não tens serviços. Cria o primeiro.</p>
        )}
        <div className="grid gap-2">
          {services.map((service) => (
            <Link
              key={service.id}
              href={`/organizacao/reservas/${service.id}`}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition hover:bg-white/10"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12px] font-semibold text-white">{service.title}</p>
                <span className="text-[11px] text-white/50">
                  {service.durationMinutes} min · {formatPrice(service.unitPriceCents, service.currency)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
