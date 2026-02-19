"use client";

import Link from "next/link";
import { useMemo } from "react";
import useSWR from "swr";
import AvailabilityEditor from "@/app/org/_internal/core/(dashboard)/reservas/_components/AvailabilityEditor";
import { CTA_PRIMARY, DASHBOARD_CARD, DASHBOARD_LABEL, DASHBOARD_MUTED } from "@/app/org/_internal/core/dashboardUi";
import { buildOrgHref, parseOrgIdFromPathnameStrict } from "@/lib/organizationIdUtils";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type ProfessionalItem = {
  id: number;
  name: string;
  isActive: boolean;
};

type ResourceItem = {
  id: number;
  label: string;
  isActive: boolean;
};

type ScopeType = "ORGANIZATION" | "PROFESSIONAL" | "RESOURCE";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CHIP_BASE =
  "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/75 transition hover:border-white/20 hover:bg-white/10 hover:text-white";
const CHIP_ACTIVE =
  "border-[#6BFFFF]/40 bg-[linear-gradient(120deg,rgba(107,255,255,0.22),rgba(106,123,255,0.18))] text-white shadow-[0_10px_28px_rgba(34,211,238,0.22)]";

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function OrgBookingsAvailabilityPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const organizationId = parseOrgIdFromPathnameStrict(pathname);

  const scopeTypeParam = (searchParams.get("scopeType") || "").trim().toUpperCase();
  const scopeIdParam = parsePositiveInt(searchParams.get("scopeId"));
  const professionalIdParam = parsePositiveInt(searchParams.get("professionalId"));
  const resourceIdParam = parsePositiveInt(searchParams.get("resourceId"));

  const professionalsKey = organizationId ? `/api/org/${organizationId}/reservas/profissionais` : null;
  const resourcesKey = organizationId ? `/api/org/${organizationId}/reservas/recursos?includeCourts=1` : null;

  const { data: professionalsData } = useSWR<{ ok: boolean; items?: ProfessionalItem[] }>(professionalsKey, fetcher);
  const { data: resourcesData } = useSWR<{ ok: boolean; items?: ResourceItem[] }>(resourcesKey, fetcher);

  const professionals = useMemo(
    () => (professionalsData?.items ?? []).filter((item) => item.isActive !== false),
    [professionalsData?.items],
  );
  const resources = useMemo(
    () => (resourcesData?.items ?? []).filter((item) => item.isActive !== false),
    [resourcesData?.items],
  );

  const resolvedScope = useMemo(() => {
    if (scopeTypeParam === "PROFESSIONAL" && scopeIdParam) {
      return { scopeType: "PROFESSIONAL" as const, scopeId: scopeIdParam };
    }
    if (scopeTypeParam === "RESOURCE" && scopeIdParam) {
      return { scopeType: "RESOURCE" as const, scopeId: scopeIdParam };
    }
    if (professionalIdParam) {
      return { scopeType: "PROFESSIONAL" as const, scopeId: professionalIdParam };
    }
    if (resourceIdParam) {
      return { scopeType: "RESOURCE" as const, scopeId: resourceIdParam };
    }
    return { scopeType: "ORGANIZATION" as const, scopeId: null };
  }, [professionalIdParam, resourceIdParam, scopeIdParam, scopeTypeParam]);

  const selectedProfessional = professionals.find(
    (item) => resolvedScope.scopeType === "PROFESSIONAL" && item.id === resolvedScope.scopeId,
  );
  const selectedResource = resources.find(
    (item) => resolvedScope.scopeType === "RESOURCE" && item.id === resolvedScope.scopeId,
  );

  const scopeMeta = useMemo(() => {
    if (selectedProfessional) {
      return {
        title: "Disponibilidade do profissional",
        subtitle: `Ajusta os blocos semanais e excecoes de ${selectedProfessional.name}.`,
      };
    }
    if (selectedResource) {
      return {
        title: "Disponibilidade do recurso",
        subtitle: `Ajusta os blocos semanais e excecoes de ${selectedResource.label}.`,
      };
    }
    return {
      title: "Disponibilidade geral",
      subtitle: "Define o default de disponibilidade usado por toda a operacao.",
    };
  }, [selectedProfessional, selectedResource]);

  if (!organizationId) {
    return (
      <section className={cn(DASHBOARD_CARD, "p-5")}>
        <p className="text-sm text-white/70">Organizacao invalida.</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={DASHBOARD_LABEL}>Reservas</p>
            <h1 className="text-xl font-semibold text-white">Disponibilidade</h1>
            <p className={DASHBOARD_MUTED}>
              Setup de horarios base e excecoes. O calendario operacional fica na ferramenta Calendario.
            </p>
          </div>
          <Link href={buildOrgHref(organizationId, "/calendar")} className={CTA_PRIMARY}>
            Abrir calendario operacional
          </Link>
        </div>
      </header>

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-4")}>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Escopo</p>
          <p className="mt-1 text-sm text-white/70">
            Seleciona onde queres editar disponibilidade: geral da operação, um profissional, ou um recurso/campo.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/50">Geral</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={buildOrgHref(organizationId, "/bookings/availability")}
              className={cn(CHIP_BASE, resolvedScope.scopeType === "ORGANIZATION" && CHIP_ACTIVE)}
            >
              Disponibilidade geral
            </Link>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/50">Profissionais</p>
          <div className="flex flex-wrap items-center gap-2">
            {professionals.map((professional) => (
              <Link
                key={`professional-${professional.id}`}
                href={buildOrgHref(organizationId, "/bookings/availability", {
                  scopeType: "PROFESSIONAL",
                  scopeId: professional.id,
                })}
                className={cn(
                  CHIP_BASE,
                  resolvedScope.scopeType === "PROFESSIONAL" && resolvedScope.scopeId === professional.id && CHIP_ACTIVE,
                )}
              >
                {professional.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/50">Recursos e campos</p>
          <div className="flex flex-wrap items-center gap-2">
            {resources.map((resource) => (
              <Link
                key={`resource-${resource.id}`}
                href={buildOrgHref(organizationId, "/bookings/availability", {
                  scopeType: "RESOURCE",
                  scopeId: resource.id,
                })}
                className={cn(
                  CHIP_BASE,
                  resolvedScope.scopeType === "RESOURCE" && resolvedScope.scopeId === resource.id && CHIP_ACTIVE,
                )}
              >
                {resource.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <AvailabilityEditor
        scopeType={resolvedScope.scopeType as ScopeType}
        scopeId={resolvedScope.scopeId}
        title={scopeMeta.title}
        subtitle={scopeMeta.subtitle}
      />
    </div>
  );
}
