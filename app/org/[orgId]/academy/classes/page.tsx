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
} from "@/app/org/_internal/core/dashboardUi";

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

const formatPrice = (cents: number, currency: string) =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: (currency || "EUR").toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);

function resolveVertical(service: ServiceItem) {
  const byVertical = String(service.bookingVertical ?? "").trim().toUpperCase();
  if (byVertical === "COURT" || byVertical === "CLASS" || byVertical === "SERVICE") return byVertical;
  const byKind = String(service.kind ?? "").trim().toUpperCase();
  if (byKind === "COURT") return "COURT";
  if (byKind === "CLASS") return "CLASS";
  return "SERVICE";
}

export default function AcademyClassesPage() {
  const params = useParams();
  const orgIdRaw = Array.isArray(params?.orgId) ? params?.orgId[0] : params?.orgId;
  const organizationId = Number(orgIdRaw);
  const canonicalOrganizationId = Number.isFinite(organizationId) && organizationId > 0 ? organizationId : null;

  const { data, isLoading } = useSWR<{ ok: boolean; items: ServiceItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/academy/classes"),
    fetcher,
  );
  const services = data?.items ?? [];
  const classServices = services.filter((service) => resolveVertical(service) === "CLASS");

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className={DASHBOARD_LABEL}>Academia</p>
          <h1 className="text-xl font-semibold text-white">Aulas</h1>
          <p className={DASHBOARD_MUTED}>Catálogo dedicado a aulas (vertical CLASS).</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={appendOrganizationIdToHref("/org/academy/trainers", canonicalOrganizationId)} className={CTA_SECONDARY}>
            Treinadores
          </Link>
          <Link href={appendOrganizationIdToHref("/org/academy/students", canonicalOrganizationId)} className={CTA_SECONDARY}>
            Alunos
          </Link>
          <Link href={appendOrganizationIdToHref("/org/academy/classes/new", canonicalOrganizationId)} className={CTA_PRIMARY}>
            Nova aula
          </Link>
        </div>
      </header>

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}>
        {isLoading && <p className="text-[12px] text-white/60">A carregar...</p>}
        {!isLoading && classServices.length === 0 && (
          <p className="text-[12px] text-white/50">Ainda não tens aulas. Cria a primeira.</p>
        )}
        <div className="grid gap-2">
          {classServices.map((service) => (
            <Link
              key={service.id}
              href={appendOrganizationIdToHref(`/org/academy/classes/${service.id}`, canonicalOrganizationId)}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition hover:bg-white/10"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12px] font-semibold text-white">{service.title}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/50">
                    {service.durationMinutes} min · Preço: {formatPrice(service.unitPriceCents, service.currency)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px]",
                      service.isActive
                        ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                        : "border-white/15 bg-white/5 text-white/60",
                    )}
                  >
                    {service.isActive ? "Ativa" : "Inativa"}
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
