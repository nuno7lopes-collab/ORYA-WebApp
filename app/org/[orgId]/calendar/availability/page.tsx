"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import AvailabilityEditor from "@/app/org/_internal/core/(dashboard)/reservas/_components/AvailabilityEditor";
import { CTA_PRIMARY, DASHBOARD_LABEL, DASHBOARD_MUTED } from "@/app/org/_internal/core/dashboardUi";
import { buildOrgHref, parseOrgIdFromPathnameStrict } from "@/lib/organizationIdUtils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  resolveOrganizationOperationalMode,
  type OrganizationOperationalMode,
} from "@/lib/organizationOperationalMode";
import {
  CALENDAR_AVAILABILITY_OVERLAY_STORAGE_KEY,
  parseAvailabilityOverlayPreference,
  serializeAvailabilityOverlayPreference,
} from "../_components/availabilityOverlayPreference";

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

type ResourceScopeOption = {
  scopeId: number;
  label: string;
  sourceType: "RESOURCE" | "COURT";
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

const SECTION_CARD = "rounded-xl border border-white/10 bg-[rgba(6,10,20,0.9)] p-4";
const SCOPE_CARD = "rounded-xl border border-white/10 bg-[rgba(8,13,24,0.86)] p-3";
const SCOPE_SELECT =
  "mt-1 h-10 w-full rounded-xl border border-white/15 bg-black/35 px-3 text-sm text-white outline-none transition focus:border-cyan-300/50";

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const organizationId = parseOrgIdFromPathnameStrict(pathname);

  const scopeTypeParam = (searchParams.get("scopeType") || "").trim().toUpperCase();
  const scopeIdParam = parsePositiveInt(searchParams.get("scopeId"));

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
  const [calendarOverlayEnabled, setCalendarOverlayEnabled] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = parseAvailabilityOverlayPreference(
      window.localStorage.getItem(CALENDAR_AVAILABILITY_OVERLAY_STORAGE_KEY),
    );
    if (stored !== null) setCalendarOverlayEnabled(stored);
  }, []);

  const setCalendarOverlayPreference = (enabled: boolean) => {
    setCalendarOverlayEnabled(enabled);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      CALENDAR_AVAILABILITY_OVERLAY_STORAGE_KEY,
      serializeAvailabilityOverlayPreference(enabled),
    );
  };

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
  const resourceScopeOptions = useMemo<ResourceScopeOption[]>(() => {
    const byScopeId = new Map<number, ResourceScopeOption>();
    resources.forEach((resource) => {
      const resourceScopeId =
        resource.availabilityScopeId ??
        resource.resourceId ??
        (resource.sourceType === "RESOURCE" ? resource.id : null);
      if (!resourceScopeId || !Number.isFinite(resourceScopeId) || resourceScopeId <= 0) return;
      if (byScopeId.has(resourceScopeId)) return;
      byScopeId.set(resourceScopeId, {
        scopeId: resourceScopeId,
        label: resource.label,
        sourceType: resource.sourceType === "COURT" ? "COURT" : "RESOURCE",
      });
    });
    return [...byScopeId.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-PT"));
  }, [resources]);
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
    return { scopeType: "ORGANIZATION" as const, scopeId: null };
  }, [scopeIdParam, scopeTypeParam]);

  const selectedProfessional = professionals.find(
    (item) => resolvedScope.scopeType === "PROFESSIONAL" && item.id === resolvedScope.scopeId,
  );
  const selectedResource = resourceScopeOptions.find(
    (item) => resolvedScope.scopeType === "RESOURCE" && item.scopeId === resolvedScope.scopeId,
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
  const scopeSummaryLabel = useMemo(() => {
    if (selectedProfessional) return `Profissional: ${selectedProfessional.name}`;
    if (selectedResource) return `Recurso: ${selectedResource.label}`;
    return "Escopo geral da organizacao";
  }, [selectedProfessional, selectedResource]);
  const calendarHref = useMemo(
    () =>
      organizationId
        ? buildOrgHref(organizationId, "/calendar", {
            showAvailabilityOverlay: serializeAvailabilityOverlayPreference(calendarOverlayEnabled),
          })
        : "/org/calendar",
    [calendarOverlayEnabled, organizationId],
  );
  const selectedProfessionalScopeValue =
    resolvedScope.scopeType === "PROFESSIONAL" && resolvedScope.scopeId ? String(resolvedScope.scopeId) : "";
  const selectedResourceScopeValue =
    resolvedScope.scopeType === "RESOURCE" && resolvedScope.scopeId ? String(resolvedScope.scopeId) : "";
  const navigateToScope = (scopeType: ScopeType, scopeId?: number | null) => {
    if (!organizationId) return;
    const href =
      scopeType === "ORGANIZATION" || !scopeId
        ? buildOrgHref(organizationId, "/calendar/availability")
        : buildOrgHref(organizationId, "/calendar/availability", {
            scopeType,
            scopeId,
          });
    router.push(href, { scroll: false });
  };

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
  const linkedResourcesCount = resourceScopeOptions.length;
  const unlinkedResourcesCount = Math.max(0, resources.length - linkedResourcesCount);

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
      <section className={SECTION_CARD}>
        <p className="text-sm text-white/82">Organizacao invalida.</p>
      </section>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-88px)] flex-col gap-3 p-2 md:p-3">
      <header className={SECTION_CARD}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className={DASHBOARD_LABEL}>Calendario</p>
            <h1 className="text-xl font-semibold text-white">Disponibilidade de reservas</h1>
            <p className={DASHBOARD_MUTED}>
              Esta pagina define janelas de reserva por escopo. Eventos e torneios continuam a ser geridos na agenda
              operacional.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={calendarHref} className={CTA_PRIMARY}>
              Abrir calendario operacional
            </Link>
            <Link
              href={buildOrgHref(organizationId, "/bookings/operations")}
              className="rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-xs text-white/80 transition hover:border-white/35 hover:text-white"
            >
              Abrir operacoes
            </Link>
            {organizationOperationalMode === "HYBRID" && canCreateEvent ? (
              <Link
                href={buildOrgHref(organizationId, "/events/new")}
                className="rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-xs text-white/80 transition hover:border-white/35 hover:text-white"
              >
                Criar evento
              </Link>
            ) : null}
            {organizationOperationalMode === "HYBRID" && !canCreateEvent && canCreateTournament ? (
              <Link
                href={buildOrgHref(organizationId, "/padel/tournaments/create")}
                className="rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-xs text-white/80 transition hover:border-white/35 hover:text-white"
              >
                Criar torneio
              </Link>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full border border-cyan-300/45 bg-cyan-400/14 px-2 py-0.5 text-cyan-100">
            {availabilityGuidance.badge}
          </span>
          <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-white/75">
            {scopeSummaryLabel}
          </span>
          <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-white/75">
            Profissionais {professionals.length}
          </span>
          <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-white/75">
            Recursos ligados {linkedResourcesCount}/{resources.length}
          </span>
          {pendingScopeChangeSet ? (
            <span className="rounded-full border border-amber-300/45 bg-amber-400/12 px-2 py-0.5 text-amber-100">
              Pedido pendente #{pendingScopeChangeSet.id}
            </span>
          ) : null}
        </div>
      </header>

      <section className={SECTION_CARD}>
        <div className="grid gap-3 lg:grid-cols-2">
          <article
            className={cn(
              "rounded-xl border p-3",
              acceptsNewBookings ? "border-emerald-300/35 bg-emerald-500/10" : "border-rose-300/35 bg-rose-500/10",
            )}
          >
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">Estado de reservas</p>
            <h2 className="mt-1 text-base font-semibold text-white">
              {acceptsNewBookings ? "Novas reservas ativas" : "Novas reservas bloqueadas"}
            </h2>
            <p className="mt-2 text-sm text-white/80">
              {acceptsNewBookings
                ? "Permite novas reservas, sempre limitadas pela disponibilidade configurada."
                : "Bloqueia novas reservas e checkout de novas pre-reservas. Historico e reservas ja confirmadas mantem-se."}
            </p>
            <div className="mt-3">
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
              <p className="mt-3 rounded-xl border border-rose-300/45 bg-rose-500/14 px-3 py-2 text-xs text-rose-100">
                {toggleError}
              </p>
            ) : null}
          </article>

          <article className="rounded-xl border border-white/10 bg-[rgba(8,13,24,0.8)] p-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">Visualizacao na agenda</p>
            <h2 className="mt-1 text-base font-semibold text-white">Disponibilidade ON/OFF</h2>
            <p className="mt-2 text-sm text-white/80">
              Controla a sobreposicao de disponibilidade no calendario (grelha de dia/semana). Esta opcao fica guardada
              para a tua sessao.
            </p>
            <div className="mt-3 inline-flex rounded-full border border-white/20 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setCalendarOverlayPreference(true)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition",
                  calendarOverlayEnabled
                    ? "bg-cyan-400/20 text-cyan-100"
                    : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                Disponibilidade ON
              </button>
              <button
                type="button"
                onClick={() => setCalendarOverlayPreference(false)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition",
                  !calendarOverlayEnabled
                    ? "bg-cyan-400/20 text-cyan-100"
                    : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                Disponibilidade OFF
              </button>
            </div>
            <div className="mt-3">
              <Link
                href={calendarHref}
                className="rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-xs text-white/80 transition hover:border-white/35 hover:text-white"
              >
                Abrir calendario com este estado
              </Link>
            </div>
          </article>
        </div>
        <div className="mt-3 rounded-xl border border-cyan-300/25 bg-cyan-400/8 p-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-100/75">{availabilityGuidance.badge}</p>
          <p className="mt-1 text-sm font-semibold text-white">{availabilityGuidance.title}</p>
          <p className="mt-1 text-sm text-white/75">{availabilityGuidance.body}</p>
        </div>
      </section>

      <section className={cn(SECTION_CARD, "space-y-4")}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Escopo</p>
            <p className="mt-1 text-sm text-white/75">
              Seleciona o escopo que queres editar: geral, profissional ou recurso/campo.
            </p>
          </div>
          <p className="text-xs text-white/55">{scopeSummaryLabel}</p>
        </div>
        <div className="grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
          <article className={SCOPE_CARD}>
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/58">Escopo base</p>
            <button
              type="button"
              onClick={() => navigateToScope("ORGANIZATION")}
              className={cn(
                "mt-2 inline-flex w-full items-center justify-center rounded-full border px-3 py-2 text-xs transition",
                resolvedScope.scopeType === "ORGANIZATION"
                  ? "border-cyan-300/45 bg-cyan-400/14 text-cyan-100"
                  : "border-white/20 bg-black/35 text-white/78 hover:border-white/35 hover:text-white",
              )}
            >
              Disponibilidade geral
            </button>
            <p className="mt-2 text-xs text-white/58">
              Base de referencia para servicos de reserva sem ajuste dedicado.
            </p>
          </article>

          <article className={SCOPE_CARD}>
            <label htmlFor="availability-scope-professional" className="text-[11px] uppercase tracking-[0.16em] text-white/58">
              Profissional
            </label>
            <select
              id="availability-scope-professional"
              value={selectedProfessionalScopeValue}
              onChange={(event) => {
                const nextScopeId = parsePositiveInt(event.target.value);
                if (!nextScopeId) return;
                navigateToScope("PROFESSIONAL", nextScopeId);
              }}
              className={SCOPE_SELECT}
            >
              <option value="">Selecionar profissional</option>
              {professionals.map((professional) => (
                <option key={`scope-professional-${professional.id}`} value={professional.id}>
                  {professional.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-white/58">{professionals.length} profissionais ativos.</p>
          </article>

          <article className={SCOPE_CARD}>
            <label htmlFor="availability-scope-resource" className="text-[11px] uppercase tracking-[0.16em] text-white/58">
              Recurso ou campo
            </label>
            <select
              id="availability-scope-resource"
              value={selectedResourceScopeValue}
              onChange={(event) => {
                const nextScopeId = parsePositiveInt(event.target.value);
                if (!nextScopeId) return;
                navigateToScope("RESOURCE", nextScopeId);
              }}
              className={SCOPE_SELECT}
            >
              <option value="">Selecionar recurso/campo</option>
              {resourceScopeOptions.map((resource) => (
                <option key={`scope-resource-${resource.scopeId}`} value={resource.scopeId}>
                  {resource.sourceType === "COURT" ? "Campo" : "Recurso"} · {resource.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-white/58">
              {linkedResourcesCount} escopos ligados.
              {unlinkedResourcesCount > 0
                ? ` ${unlinkedResourcesCount} recursos/campos ainda sem ligacao.`
                : " Todos os recursos visiveis ja estao ligados."}
            </p>
          </article>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-white/65">Escopo ativo</span>
          <span className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-2 py-0.5 text-cyan-100">
            {scopeSummaryLabel}
          </span>
        </div>
      </section>

      {pendingScopeChangeSet ? (
        <section className="rounded-xl border border-amber-300/35 bg-amber-400/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100/75">Pedido pendente</p>
              <p className="mt-1 text-sm text-amber-100">
                Existe um pedido neste escopo (#{pendingScopeChangeSet.id}) com {pendingScopeChangeSet.conflictsOpen}{" "}
                conflitos abertos.
              </p>
              <p className="text-xs text-amber-50/80">Resolve os conflitos antes de criar ou aplicar novas alteracoes.</p>
            </div>
            <Link href={buildOrgHref(organizationId, `/calendar/conflicts/${pendingScopeChangeSet.id}`)} className={CTA_PRIMARY}>
              Abrir conflitos
            </Link>
          </div>
        </section>
      ) : null}

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
