"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { OryaDateTimeField } from "@/components/ui/datetime";
import { cn } from "@/lib/utils";
import { CTA_DANGER, CTA_NEUTRAL, CTA_PRIMARY, DASHBOARD_CARD, DASHBOARD_LABEL, DASHBOARD_MUTED } from "@/app/org/_internal/core/dashboardUi";

type ConflictItem = {
  id: number;
  status: "OPEN" | "RESOLVED";
  entityType: "BOOKING" | "CLASS_SESSION";
  entityId: number;
  startsAt: string;
  endsAt: string;
  reasonCode: string | null;
  resolutionAction: "RESCHEDULED" | "CANCELLED" | null;
  resolvedAt: string | null;
  details?: Record<string, unknown> | null;
};

type ChangeSetResponse = {
  ok: boolean;
  data?: {
    id: number;
    status: "PENDING" | "READY_TO_APPLY" | "APPLIED" | "CANCELLED";
    scopeType: "ORGANIZATION" | "PROFESSIONAL" | "RESOURCE";
    scopeId: number;
    createdAt: string;
    updatedAt: string;
    appliedAt: string | null;
    cancelledAt: string | null;
    conflictsOpen: number;
    conflicts: ConflictItem[];
  };
  errorCode?: string;
  message?: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function toDateTimeLocalValue(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export default function AvailabilityChangeSetConflictsPage() {
  const router = useRouter();
  const params = useParams<{ orgId: string; changeSetId: string }>();
  const orgId = Number(params?.orgId);
  const changeSetId = Number(params?.changeSetId);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rescheduleDrafts, setRescheduleDrafts] = useState<Record<number, string>>({});

  const canLoad = Number.isFinite(orgId) && orgId > 0 && Number.isFinite(changeSetId) && changeSetId > 0;
  const apiPath = canLoad
    ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas/disponibilidade/changesets/${changeSetId}`)
    : null;

  const { data, mutate, isLoading } = useSWR<ChangeSetResponse>(apiPath, fetcher, {
    revalidateOnFocus: true,
  });

  const payload = data?.data ?? null;
  const openConflicts = useMemo(
    () => (payload?.conflicts ?? []).filter((item) => item.status === "OPEN"),
    [payload?.conflicts],
  );

  const handleApply = async () => {
    if (!canLoad) return;
    setBusyKey("apply");
    setError(null);
    try {
      const res = await fetch(
        resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas/disponibilidade/changesets/${changeSetId}/apply`),
        { method: "POST" },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message ?? json?.error ?? "Ainda existem conflitos por resolver.");
      }
      router.push(buildOrgHref(orgId, "/calendar/availability"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao aplicar pedido.");
    } finally {
      setBusyKey(null);
      await mutate();
    }
  };

  const handleCancel = async () => {
    if (!canLoad) return;
    const confirmed = window.confirm("Cancelar este pedido pendente?");
    if (!confirmed) return;
    setBusyKey("cancel");
    setError(null);
    try {
      const res = await fetch(
        resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas/disponibilidade/changesets/${changeSetId}/cancel`),
        { method: "POST" },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message ?? json?.error ?? "Erro ao cancelar pedido.");
      }
      router.push(buildOrgHref(orgId, "/calendar/availability"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cancelar pedido.");
    } finally {
      setBusyKey(null);
      await mutate();
    }
  };

  const resolveConflict = async (conflictId: number, action: "CANCEL" | "RESCHEDULE") => {
    if (!canLoad) return;
    setBusyKey(`${action}-${conflictId}`);
    setError(null);
    try {
      const conflict = openConflicts.find((item) => item.id === conflictId);
      const startsAt =
        action === "RESCHEDULE"
          ? (rescheduleDrafts[conflictId] ?? (conflict ? toDateTimeLocalValue(conflict.startsAt) : ""))
          : "";
      if (action === "RESCHEDULE" && !startsAt) {
        throw new Error("Seleciona a nova data/hora para reagendar.");
      }
      const res = await fetch(
        resolveCanonicalOrgApiPath(
          `/api/org/[orgId]/reservas/disponibilidade/changesets/${changeSetId}/conflicts/${conflictId}/resolve`,
        ),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            ...(action === "RESCHEDULE" ? { startsAt: new Date(String(startsAt)).toISOString() } : {}),
          }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message ?? json?.error ?? "Não foi possível resolver o conflito.");
      }
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao resolver conflito.");
    } finally {
      setBusyKey(null);
    }
  };

  if (!canLoad) {
    return (
      <section className={cn(DASHBOARD_CARD, "p-5")}>
        <p className="text-sm text-white/70">Pedido inválido.</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={DASHBOARD_LABEL}>Disponibilidade</p>
            <h1 className="text-xl font-semibold text-white">Conflitos do pedido</h1>
            <p className={DASHBOARD_MUTED}>
              Resolve todos os conflitos antes de aplicar alterações de disponibilidade.
            </p>
          </div>
          <Link href={buildOrgHref(orgId, "/calendar/availability")} className={CTA_NEUTRAL}>
            Voltar à disponibilidade
          </Link>
        </div>
      </header>

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm text-white/75">Pedido #{changeSetId}</p>
            <p className="text-xs text-white/55">
              Estado: <span className="font-semibold text-white/85">{payload?.status ?? "—"}</span> · Conflitos abertos: {openConflicts.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={CTA_PRIMARY}
              onClick={handleApply}
              disabled={busyKey === "apply" || openConflicts.length > 0 || payload?.status === "APPLIED"}
            >
              {busyKey === "apply" ? "A aplicar..." : "Aplicar pedido"}
            </button>
            <button
              type="button"
              className={CTA_DANGER}
              onClick={handleCancel}
              disabled={busyKey === "cancel" || payload?.status === "CANCELLED" || payload?.status === "APPLIED"}
            >
              {busyKey === "cancel" ? "A cancelar..." : "Cancelar pedido"}
            </button>
          </div>
        </div>

        {(isLoading || !payload) && (
          <p className="text-sm text-white/65">A carregar conflitos...</p>
        )}

        {!!payload && openConflicts.length === 0 && (
          <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            Não existem conflitos abertos. Podes aplicar o pedido.
          </div>
        )}

        {openConflicts.map((conflict) => {
          const startsAtLabel = new Date(conflict.startsAt).toLocaleString("pt-PT");
          const endsAtLabel = new Date(conflict.endsAt).toLocaleString("pt-PT");
          return (
            <article
              key={conflict.id}
              className="rounded-xl border border-white/12 bg-white/[0.03] p-3 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">
                  {conflict.entityType === "BOOKING" ? "Reserva" : "Aula"} #{conflict.entityId}
                </p>
                <span className="rounded-full border border-amber-300/40 px-2 py-0.5 text-[11px] text-amber-100">
                  {conflict.reasonCode ?? "OUTSIDE_AVAILABILITY"}
                </span>
              </div>
              <p className="text-xs text-white/65">
                Bloqueia aplicação: {startsAtLabel} → {endsAtLabel}
              </p>
              <p className="text-xs text-white/60">
                Ação pendente: reagendar para slot válido ou cancelar esta entidade.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <OryaDateTimeField
                  value={rescheduleDrafts[conflict.id] ?? toDateTimeLocalValue(conflict.startsAt)}
                  onChange={(next) =>
                    setRescheduleDrafts((prev) => ({
                      ...prev,
                      [conflict.id]: next,
                    }))
                  }
                  className="w-full sm:w-auto"
                  dateButtonClassName="h-10 w-full sm:min-w-[170px] rounded-xl justify-between"
                  timeButtonClassName="h-10 w-full sm:min-w-[110px] rounded-xl justify-between"
                />
                <button
                  type="button"
                  className={CTA_PRIMARY}
                  onClick={() => resolveConflict(conflict.id, "RESCHEDULE")}
                  disabled={busyKey === `RESCHEDULE-${conflict.id}`}
                >
                  {busyKey === `RESCHEDULE-${conflict.id}` ? "A reagendar..." : "Reagendar"}
                </button>
                <button
                  type="button"
                  className={CTA_DANGER}
                  onClick={() => resolveConflict(conflict.id, "CANCEL")}
                  disabled={busyKey === `CANCEL-${conflict.id}`}
                >
                  {busyKey === `CANCEL-${conflict.id}` ? "A cancelar..." : "Cancelar"}
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </div>
      )}
    </div>
  );
}
