"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";

import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import {
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
} from "@/app/org/_shared/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ServiceItem = {
  id: number;
  title: string;
  kind?: "GENERAL" | "COURT" | "CLASS" | string | null;
  bookingVertical?: "COURT" | "CLASS" | "SERVICE" | string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  isActive: boolean;
};

const formatPrice = (cents: number, currency: string) => `${(cents / 100).toFixed(2)} ${currency}`;

export default function ReservasServicosPage() {
  const params = useParams();
  const orgIdRaw = Array.isArray(params?.orgId) ? params?.orgId[0] : params?.orgId;
  const organizationId = Number(orgIdRaw);
  const canonicalOrganizationId = Number.isFinite(organizationId) && organizationId > 0 ? organizationId : null;

  const { data, isLoading } = useSWR<{ ok: boolean; items: ServiceItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/servicos"),
    fetcher,
  );
  const services = data?.items ?? [];
  const resolveVertical = (service: ServiceItem) => {
    const byVertical = String(service.bookingVertical ?? "").trim().toUpperCase();
    if (byVertical === "COURT" || byVertical === "CLASS" || byVertical === "SERVICE") return byVertical;
    const byKind = String(service.kind ?? "").trim().toUpperCase();
    if (byKind === "COURT") return "COURT";
    if (byKind === "CLASS") return "CLASS";
    return "SERVICE";
  };
  const generalServices = services.filter((service) => resolveVertical(service) === "SERVICE");

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className={DASHBOARD_LABEL}>Reservas</p>
          <h1 className="text-xl font-semibold text-white">Serviços</h1>
          <p className={DASHBOARD_MUTED}>Catálogo geral (apenas vertical SERVICE).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={appendOrganizationIdToHref("/org/bookings/courts", canonicalOrganizationId)} className={CTA_SECONDARY}>
            Campos
          </Link>
          <Link href={appendOrganizationIdToHref("/org/bookings/classes", canonicalOrganizationId)} className={CTA_SECONDARY}>
            Aulas
          </Link>
          <Link href={appendOrganizationIdToHref("/org/bookings/operations", canonicalOrganizationId)} className={CTA_SECONDARY}>
            Operações
          </Link>
          <Link href={appendOrganizationIdToHref("/org/bookings/new", canonicalOrganizationId)} className={CTA_PRIMARY}>
            Novo serviço
          </Link>
        </div>
      </header>

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}>
        {isLoading && <p className="text-[12px] text-white/60">A carregar...</p>}
        {!isLoading && generalServices.length === 0 && (
          <p className="text-[12px] text-white/50">Ainda não tens serviços gerais. Cria o primeiro.</p>
        )}
        <div className="grid gap-2">
          {generalServices.map((service) => (
            <Link
              key={service.id}
              href={appendOrganizationIdToHref(`/org/bookings/${service.id}`, canonicalOrganizationId)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition hover:bg-white/10"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12px] font-semibold text-white">{service.title}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/50">
                    {service.durationMinutes} min · {formatPrice(service.unitPriceCents, service.currency)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px]",
                      service.isActive
                        ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                        : "border-white/15 bg-white/5 text-white/60",
                    )}
                  >
                    {service.isActive ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
