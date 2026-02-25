"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import AvailabilityEditor from "@/app/org/_internal/core/(dashboard)/reservas/_components/AvailabilityEditor";
import { CTA_PRIMARY, DASHBOARD_CARD, DASHBOARD_LABEL, DASHBOARD_MUTED } from "@/app/org/_internal/core/dashboardUi";
import { buildOrgHref, parseOrgIdFromPathnameStrict } from "@/lib/organizationIdUtils";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  resolveOrganizationOperationalMode,
  type OrganizationOperationalMode,
} from "@/lib/organizationOperationalMode";

type ProfessionalItem = {
  id: number;
  name: string;
  isActive: boolean;
};

type ResourceItem = {
  id: number;
  label: string;
  isActive: boolean;
  sourceType?: "RESOURCE" | "COURT";
  resourceId?: number | null;
  availabilityScopeId?: number | null;
};

type ScopeType = "ORGANIZATION" | "PROFESSIONAL" | "RESOURCE";

type OrganizationMeResponse = {
  ok: boolean;
  organization?: {
    primaryModule?: string | null;
    tools?: string[] | null;
  } | null;
};

type BookingConfigPayload = {
  acceptNewBookings?: boolean;
};

type BookingConfigResponse = {
  ok: boolean;
  data?: BookingConfigPayload | { data?: BookingConfigPayload } | null;
  result?: BookingConfigPayload | { data?: BookingConfigPayload } | null;
  errorCode?: string;
  message?: string;
};

type PendingScopeChangesetsResponse = {
  ok: boolean;
  data?: {
    items?: Array<{
      id: number;
      status: "PENDING" | "READY_TO_APPLY" | "APPLIED" | "CANCELLED";
      conflictsOpen: number;
      scopeType: ScopeType;
      scopeId: number;
      createdAt: string;
      updatedAt: string;
    }>;
  };
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const CHIP_BASE =
  "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/75 transition hover:border-white/20 hover:bg-white/10 hover:text-white";
const CHIP_ACTIVE =
  "border-[#22D3EE]/40 bg-[linear-gradient(120deg,rgba(34,211,238,0.22),rgba(106,123,255,0.18))] text-white shadow-[0_10px_28px_rgba(34,211,238,0.22)]";

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveBookingConfigPayload(data: BookingConfigResponse | undefined): BookingConfigPayload | null {
  if (!data) return null;
  const direct = data.data;
  if (direct && typeof direct === "object" && "acceptNewBookings" in direct) {
    return direct as BookingConfigPayload;
  }
  if (direct && typeof direct === "object" && "data" in direct) {
    const nested = (direct as { data?: BookingConfigPayload }).data;
    if (nested && typeof nested === "object") return nested;
  }
  const result = data.result;
  if (result && typeof result === "object" && "acceptNewBookings" in result) {
    return result as BookingConfigPayload;
  }
  if (result && typeof result === "object" && "data" in result) {
    const nested = (result as { data?: BookingConfigPayload }).data;
    if (nested && typeof nested === "object") return nested;
  }
  return null;
}

export default function OrgCalendarAvailabilityPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const organizationId = parseOrgIdFromPathnameStrict(pathname);

  const scopeTypeParam = (searchParams.get("scopeType") || "").trim().toUpperCase();
  const scopeIdParam = parsePositiveInt(searchParams.get("scopeId"));
  const professionalIdParam = parsePositiveInt(searchParams.get("professionalId"));
  const resourceIdParam = parsePositiveInt(searchParams.get("resourceId"));

  const professionalsKey = organizationId ? `/api/org/${organizationId}/reservas/profissionais` : null;
  const resourcesKey = organizationId ? `/api/org/${organizationId}/reservas/recursos?includeCourts=1` : null;
  const organizationMeKey = organizationId ? `/api/org/${organizationId}/me` : null;
  const bookingConfigKey = organizationId ? `/api/org/${organizationId}/reservas/config` : null;

  const { data: professionalsData } = useSWR<{ ok: boolean; items?: ProfessionalItem[] }>(professionalsKey, fetcher);
  const { data: resourcesData } = useSWR<{ ok: boolean; items?: ResourceItem[] }>(resourcesKey, fetcher);
  const { data: organizationMeData } = useSWR<OrganizationMeResponse>(organizationMeKey, fetcher);
  const { data: bookingConfigData, mutate: mutateBookingConfig, isLoading: bookingConfigLoading } =
    useSWR<BookingConfigResponse>(bookingConfigKey, fetcher);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const bookingConfig = useMemo(() => resolveBookingConfigPayload(bookingConfigData), [bookingConfigData]);
  const acceptsNewBookings = bookingConfig?.acceptNewBookings ?? true;

  const professionals = useMemo(
    () => (professionalsData?.items ?? []).filter((item) => item.isActive !== false),
    [professionalsData?.items],
  );
  const resources = useMemo(
    () => (resourcesData?.items ?? []).filter((item) => item.isActive !== false),
    [resourcesData?.items],
  );
  const organizationOperationalMode = useMemo<OrganizationOperationalMode>(() => {
    const organizationPayload = organizationMeData?.organization;
    if (!organizationPayload) return "SLOT_DRIVEN";
    return resolveOrganizationOperationalMode({
      primaryModule: organizationPayload.primaryModule ?? null,
      tools: organizationPayload.tools ?? [],
    });
  }, [organizationMeData?.organization]);
  const activeToolSet = useMemo(
    () =>
      new Set(
        (organizationMeData?.organization?.tools ?? [])
          .map((tool) => (typeof tool === "string" ? tool.trim().toUpperCase() : ""))
          .filter(Boolean),
      ),
    [organizationMeData?.organization?.tools],
  );
  const canCreateEvent = activeToolSet.has("EVENTOS");
  const canCreateTournament = activeToolSet.has("TORNEIOS");
  const availabilityGuidance = useMemo(() => {
    if (organizationOperationalMode === "HYBRID") {
      return {
        badge: "Modo híbrido",
        title: "Disponibilidade apenas para reservas",
        body:
          "Nesta organização, eventos/torneios continuam a entrar diretamente na agenda. Configura disponibilidade apenas para serviços por slots.",
      };
    }
    return {
      badge: "Modo reservas",
      title: "Disponibilidade como fonte de verdade",
      body:
        "A disponibilidade semanal define quando os teus serviços de reserva podem ser vendidos e operados.",
    };
  }, [organizationOperationalMode]);

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
      const matchedResource = resources.find(
        (item) =>
          item.id === resourceIdParam ||
          item.resourceId === resourceIdParam ||
          item.availabilityScopeId === resourceIdParam,
      );
      if (matchedResource) {
        const resolvedResourceScopeId =
          matchedResource.availabilityScopeId ??
          matchedResource.resourceId ??
          (matchedResource.sourceType === "RESOURCE" ? matchedResource.id : null);
        if (!resolvedResourceScopeId) {
          return { scopeType: "ORGANIZATION" as const, scopeId: null };
        }
        return { scopeType: "RESOURCE" as const, scopeId: resolvedResourceScopeId };
      }
      const resolvedResourceScopeId = resourceIdParam;
      return { scopeType: "RESOURCE" as const, scopeId: resolvedResourceScopeId };
    }
    return { scopeType: "ORGANIZATION" as const, scopeId: null };
  }, [professionalIdParam, resourceIdParam, resources, scopeIdParam, scopeTypeParam]);

  const selectedProfessional = professionals.find(
    (item) => resolvedScope.scopeType === "PROFESSIONAL" && item.id === resolvedScope.scopeId,
  );
  const selectedResource = resources.find(
    (item) =>
      resolvedScope.scopeType === "RESOURCE" &&
      (item.availabilityScopeId ?? item.resourceId ?? (item.sourceType === "RESOURCE" ? item.id : null)) ===
        resolvedScope.scopeId,
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
      subtitle: "Define o default de disponibilidade usado pelos servicos com reservas.",
    };
  }, [selectedProfessional, selectedResource]);

  const pendingScopeChangesetsKey = useMemo(() => {
    if (!organizationId) return null;
    const params = new URLSearchParams({
      scopeType: resolvedScope.scopeType,
      statuses: "PENDING,READY_TO_APPLY",
      limit: "1",
    });
    if (resolvedScope.scopeId) {
      params.set("scopeId", String(resolvedScope.scopeId));
    }
    return `/api/org/${organizationId}/reservas/disponibilidade/changesets?${params.toString()}`;
  }, [organizationId, resolvedScope.scopeId, resolvedScope.scopeType]);

  const { data: pendingScopeChangesetsData } = useSWR<PendingScopeChangesetsResponse>(
    pendingScopeChangesetsKey,
    fetcher,
  );
  const pendingScopeChangeSet = pendingScopeChangesetsData?.data?.items?.[0] ?? null;

  const handleOperationalToggle = async () => {
    if (!organizationId || toggleBusy) return;
    setToggleBusy(true);
    setToggleError(null);
    try {
      const res = await fetch(`/api/org/${organizationId}/reservas/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptNewBookings: !acceptsNewBookings,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            errorCode?: string;
            message?: string;
            error?: string;
            data?: unknown;
            result?: unknown;
          }
        | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Nao foi possivel atualizar o estado operacional.");
      }
      await mutateBookingConfig();
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : "Nao foi possivel atualizar o estado operacional.");
    } finally {
      setToggleBusy(false);
    }
  };

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
            <p className={DASHBOARD_LABEL}>Calendario</p>
            <h1 className="text-xl font-semibold text-white">Disponibilidade de reservas</h1>
            <p className={DASHBOARD_MUTED}>
              Usa isto apenas para servicos com slots. Para eventos e torneios pontuais, a agenda nasce no proprio item criado.
            </p>
          </div>
          <Link href={buildOrgHref(organizationId, "/calendar")} className={CTA_PRIMARY}>
            Abrir calendario operacional
          </Link>
        </div>
      </header>

      <section
        className={cn(
          "rounded-2xl border p-4 shadow-[0_16px_50px_rgba(0,0,0,0.35)]",
          acceptsNewBookings
            ? "border-emerald-300/30 bg-[linear-gradient(145deg,rgba(16,185,129,0.18),rgba(10,18,34,0.84))]"
            : "border-rose-300/35 bg-[linear-gradient(145deg,rgba(244,63,94,0.2),rgba(10,18,34,0.84))]",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/80">
              Reservas {acceptsNewBookings ? "ON" : "OFF"}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {acceptsNewBookings ? "Novas reservas ativas" : "Novas reservas bloqueadas"}
            </h2>
            <p className="mt-2 text-sm text-white/80">
              {acceptsNewBookings
                ? "Permite novas reservas, sempre limitadas pela disponibilidade configurada."
                : "Bloqueia novas reservas e checkout de novas pre-reservas. Historico e reservas ja confirmadas mantem-se."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOperationalToggle}
            disabled={toggleBusy || bookingConfigLoading}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60",
              acceptsNewBookings
                ? "border-rose-300/55 bg-rose-500/15 text-rose-100 hover:border-rose-200/80"
                : "border-emerald-300/55 bg-emerald-500/15 text-emerald-100 hover:border-emerald-200/80",
            )}
          >
            {toggleBusy
              ? "A atualizar..."
              : bookingConfigLoading
                ? "A carregar..."
                : acceptsNewBookings
                  ? "Desligar reservas"
                  : "Ligar reservas"}
          </button>
        </div>
        {toggleError ? (
          <p className="mt-3 rounded-xl border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            {toggleError}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-cyan-300/20 bg-[linear-gradient(140deg,rgba(34,211,238,0.12),rgba(10,18,34,0.82))] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/75">{availabilityGuidance.badge}</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{availabilityGuidance.title}</h2>
            <p className="mt-2 text-sm text-white/80">{availabilityGuidance.body}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={buildOrgHref(organizationId, "/bookings/operations")} className={CTA_PRIMARY}>
              Abrir operacoes
            </Link>
            {organizationOperationalMode === "HYBRID" && canCreateEvent ? (
              <Link
                href={buildOrgHref(organizationId, "/events/new")}
                className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:border-white/35 hover:text-white"
              >
                Criar evento
              </Link>
            ) : null}
            {organizationOperationalMode === "HYBRID" && !canCreateEvent && canCreateTournament ? (
              <Link
                href={buildOrgHref(organizationId, "/padel/tournaments/create")}
                className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:border-white/35 hover:text-white"
              >
                Criar torneio
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-4")}>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Escopo</p>
          <p className="mt-1 text-sm text-white/70">
            Seleciona onde queres editar disponibilidade de reservas: geral da operacao, um profissional, ou um recurso/campo.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/50">Geral</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={buildOrgHref(organizationId, "/calendar/availability")}
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
                href={buildOrgHref(organizationId, "/calendar/availability", {
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
            {resources.map((resource) => {
              const resourceScopeId =
                resource.availabilityScopeId ??
                resource.resourceId ??
                (resource.sourceType === "RESOURCE" ? resource.id : null);
              const isActive =
                resolvedScope.scopeType === "RESOURCE" &&
                resourceScopeId != null &&
                resolvedScope.scopeId === resourceScopeId;
              if (resourceScopeId == null) {
                return (
                  <span
                    key={`resource-${resource.id}`}
                    className={cn(CHIP_BASE, "cursor-not-allowed opacity-55")}
                    title="Campo sem recurso de reservas ligado"
                  >
                    {resource.label}
                  </span>
                );
              }
              return (
                <Link
                  key={`resource-${resource.id}`}
                  href={buildOrgHref(organizationId, "/calendar/availability", {
                    scopeType: "RESOURCE",
                    scopeId: resourceScopeId,
                  })}
                  className={cn(CHIP_BASE, isActive && CHIP_ACTIVE)}
                >
                  {resource.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {pendingScopeChangeSet && (
        <section className="rounded-2xl border border-amber-300/35 bg-amber-500/10 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.28)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100/75">Pedido pendente</p>
              <p className="mt-1 text-sm text-amber-100">
                Existe um pedido de disponibilidade neste escopo (#{pendingScopeChangeSet.id}) com{" "}
                {pendingScopeChangeSet.conflictsOpen} conflitos abertos.
              </p>
              <p className="text-xs text-amber-50/80">Resolve os conflitos antes de criar/aplicar novas alterações.</p>
            </div>
            <Link href={buildOrgHref(organizationId, `/calendar/conflicts/${pendingScopeChangeSet.id}`)} className={CTA_PRIMARY}>
              Abrir conflitos
            </Link>
          </div>
        </section>
      )}

      <AvailabilityEditor
        orgId={organizationId}
        scopeType={resolvedScope.scopeType as ScopeType}
        scopeId={resolvedScope.scopeId}
        pendingChangeSetId={pendingScopeChangeSet?.id ?? null}
        title={scopeMeta.title}
        subtitle={scopeMeta.subtitle}
      />
    </div>
  );
}
