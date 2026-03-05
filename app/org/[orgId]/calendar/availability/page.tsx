"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import AvailabilityEditor from "@/app/org/_internal/core/(dashboard)/reservas/_components/AvailabilityEditor";
import { buildOrgHref, parseOrgIdFromPathnameStrict } from "@/lib/organizationIdUtils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  "h-10 w-full rounded-xl border border-white/15 bg-black/35 px-3 text-sm text-white outline-none transition focus:border-cyan-300/50";

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

  const professionalsKey = organizationId ? `/api/org/${organizationId}/academy/trainers` : null;
  const resourcesKey = organizationId ? `/api/org/${organizationId}/reservas/recursos?includeCourts=1` : null;
  const bookingConfigKey = organizationId ? `/api/org/${organizationId}/reservas/config` : null;

  const { data: professionalsData } = useSWR<{ ok: boolean; items?: ProfessionalItem[] }>(professionalsKey, fetcher);
  const { data: resourcesData } = useSWR<{ ok: boolean; items?: ResourceItem[] }>(resourcesKey, fetcher);
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
        title: `Profissional · ${selectedProfessional.name}`,
      };
    }
    if (selectedResource) {
      return {
        title: `Recurso · ${selectedResource.label}`,
      };
    }
    return {
      title: "Disponibilidade geral",
    };
  }, [selectedProfessional, selectedResource]);
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
        throw new Error(json?.message || json?.error || "Não foi possível atualizar o estado operacional.");
      }
      await mutateBookingConfig();
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : "Não foi possível atualizar o estado operacional.");
    } finally {
      setToggleBusy(false);
    }
  };

  if (!organizationId) {
    return (
      <section className={SECTION_CARD}>
        <p className="text-sm text-white/82">Organização inválida.</p>
      </section>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-88px)] flex-col gap-3 p-2 md:p-3">
      <h1 className="sr-only">Disponibilidade</h1>
      <section className={cn(SECTION_CARD, "space-y-2")}>
        <div className="flex items-center justify-end">
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
                  : "Ativar reservas"}
          </button>
        </div>
        {toggleError ? (
          <p className="rounded-xl border border-rose-300/45 bg-rose-500/14 px-3 py-2 text-xs text-rose-100">
            {toggleError}
          </p>
        ) : null}
        <div className="grid gap-2 xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
          <div className={SCOPE_CARD}>
            <button
              type="button"
              onClick={() => navigateToScope("ORGANIZATION")}
              className={cn(
                "inline-flex w-full items-center justify-center rounded-full border px-3 py-2 text-xs transition",
                resolvedScope.scopeType === "ORGANIZATION"
                  ? "border-cyan-300/45 bg-cyan-400/14 text-cyan-100"
                  : "border-white/20 bg-black/35 text-white/78 hover:border-white/35 hover:text-white",
              )}
            >
              Geral
            </button>
          </div>

          <div className={SCOPE_CARD}>
            <select
              id="availability-scope-professional"
              aria-label="Selecionar profissional"
              value={selectedProfessionalScopeValue}
              onChange={(event) => {
                const nextScopeId = parsePositiveInt(event.target.value);
                if (!nextScopeId) return;
                navigateToScope("PROFESSIONAL", nextScopeId);
              }}
              className={SCOPE_SELECT}
            >
              <option value="">Profissional</option>
              {professionals.map((professional) => (
                <option key={`scope-professional-${professional.id}`} value={professional.id}>
                  {professional.name}
                </option>
              ))}
            </select>
          </div>

          <div className={SCOPE_CARD}>
            <select
              id="availability-scope-resource"
              aria-label="Selecionar recurso ou campo"
              value={selectedResourceScopeValue}
              onChange={(event) => {
                const nextScopeId = parsePositiveInt(event.target.value);
                if (!nextScopeId) return;
                navigateToScope("RESOURCE", nextScopeId);
              }}
              className={SCOPE_SELECT}
            >
              <option value="">Recurso/Campo</option>
              {resourceScopeOptions.map((resource) => (
                <option key={`scope-resource-${resource.scopeId}`} value={resource.scopeId}>
                  {resource.sourceType === "COURT" ? "Campo" : "Recurso"} · {resource.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <AvailabilityEditor
        orgId={organizationId}
        scopeType={resolvedScope.scopeType as ScopeType}
        scopeId={resolvedScope.scopeId}
        pendingChangeSetId={pendingScopeChangeSet?.id ?? null}
        title={scopeMeta.title}
        subtitle=""
      />
    </div>
  );
}
