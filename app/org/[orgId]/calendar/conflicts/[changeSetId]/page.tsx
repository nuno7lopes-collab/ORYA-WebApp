"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { cn } from "@/lib/utils";
import {
  CTA_DANGER,
  CTA_NEUTRAL,
  CTA_PRIMARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
} from "@/app/org/_internal/core/dashboardUi";

type ConflictEntityType = "BOOKING" | "CLASS_SESSION" | "MATCH" | "SOFT_BLOCK" | "HARD_BLOCK";

type ConflictItem = {
  id: number;
  status: "OPEN" | "RESOLVED";
  entityType: ConflictEntityType;
  entityId: number;
  startsAt: string;
  endsAt: string;
  reasonCode: string | null;
  resolutionAction: "CANCELLED" | "EXTERNAL_RESOLUTION" | null;
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

type BulkCancelResponse = {
  ok: boolean;
  data?: {
    processed: number;
    successCount: number;
    failureCount: number;
    succeeded: Array<{ conflictId: number; alreadyResolved: boolean; conflictsOpen: number }>;
    failed: Array<{ conflictId: number; errorCode: string; message: string }>;
  };
  errorCode?: string;
  message?: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function formatConflictEntity(entityType: ConflictEntityType) {
  if (entityType === "BOOKING") return "Reserva";
  if (entityType === "CLASS_SESSION") return "Aula";
  if (entityType === "MATCH") return "Jogo";
  if (entityType === "HARD_BLOCK") return "Bloqueio rígido";
  if (entityType === "SOFT_BLOCK") return "Bloqueio suave";
  return "Entidade";
}

function isCancelable(entityType: ConflictEntityType) {
  return entityType === "BOOKING" || entityType === "CLASS_SESSION";
}

function toDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export default function CalendarConflictsDetailsPage() {
  const router = useRouter();
  const params = useParams<{ orgId: string; changeSetId: string }>();
  const orgId = Number(params?.orgId);
  const changeSetId = Number(params?.changeSetId);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkConfirmText, setBulkConfirmText] = useState("");
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkResult, setBulkResult] = useState<BulkCancelResponse["data"] | null>(null);

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
  const cancelableConflicts = useMemo(
    () => openConflicts.filter((item) => isCancelable(item.entityType)),
    [openConflicts],
  );

  const selectedCancelableIds = useMemo(() => {
    const availableIds = new Set(cancelableConflicts.map((item) => item.id));
    return selectedIds.filter((id) => availableIds.has(id));
  }, [cancelableConflicts, selectedIds]);

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
        const conflictsOpen = Number(json?.details?.conflictsOpen ?? Number.NaN);
        if (json?.errorCode === "AVAILABILITY_CHANGESET_NOT_READY" && Number.isFinite(conflictsOpen)) {
          throw new Error(`Ainda faltam ${conflictsOpen} conflitos por resolver.`);
        }
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

  const handleCancelRequest = async () => {
    if (!canLoad) return;
    const confirmed = window.confirm("Cancelar este pedido pendente?");
    if (!confirmed) return;
    setBusyKey("cancel-request");
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
      router.push(buildOrgHref(orgId, "/calendar/conflicts"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cancelar pedido.");
    } finally {
      setBusyKey(null);
      await mutate();
    }
  };

  const handleCancelOne = async (conflictId: number) => {
    if (!canLoad) return;
    setBusyKey(`cancel-${conflictId}`);
    setError(null);
    try {
      const res = await fetch(
        resolveCanonicalOrgApiPath(
          `/api/org/[orgId]/reservas/disponibilidade/changesets/${changeSetId}/conflicts/${conflictId}/resolve`,
        ),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "CANCEL" }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message ?? json?.error ?? "Não foi possível resolver o conflito.");
      }
      setSelectedIds((prev) => prev.filter((id) => id !== conflictId));
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao resolver conflito.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleBulkCancel = async () => {
    if (!canLoad || selectedCancelableIds.length === 0) return;
    setBusyKey("bulk-cancel");
    setError(null);
    setBulkProgress(10);
    setBulkResult(null);
    const tick = window.setInterval(() => {
      setBulkProgress((current) => (current >= 80 ? current : current + 10));
    }, 180);

    try {
      const res = await fetch(
        resolveCanonicalOrgApiPath(
          `/api/org/[orgId]/reservas/disponibilidade/changesets/${changeSetId}/conflicts/bulk-cancel`,
        ),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conflictIds: selectedCancelableIds,
            reason: `Bulk cancel no pedido ${changeSetId}`,
          }),
        },
      );
      const json = (await res.json().catch(() => null)) as BulkCancelResponse | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message ?? json?.errorCode ?? "Falha no cancelamento em massa.");
      }
      setBulkProgress(100);
      setBulkResult(json.data ?? null);
      setSelectedIds([]);
      setBulkModalOpen(false);
      setBulkConfirmText("");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no cancelamento em massa.");
    } finally {
      window.clearInterval(tick);
      setBusyKey(null);
      window.setTimeout(() => setBulkProgress(0), 800);
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
            <p className={DASHBOARD_LABEL}>Calendário · Conflitos</p>
            <h1 className="text-xl font-semibold text-white">Conflitos do pedido</h1>
            <p className={DASHBOARD_MUTED}>Pedido fica pendente até todos os conflitos estarem resolvidos.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={buildOrgHref(orgId, "/calendar/conflicts")} className={CTA_NEUTRAL}>
              Voltar à lista
            </Link>
            <Link href={buildOrgHref(orgId, "/calendar/availability")} className={CTA_NEUTRAL}>
              Abrir disponibilidade
            </Link>
          </div>
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
              disabled={busyKey === "apply" || payload?.status === "APPLIED" || payload?.status === "CANCELLED"}
            >
              {busyKey === "apply" ? "A aplicar..." : "Aplicar pedido"}
            </button>
            <button
              type="button"
              className={CTA_DANGER}
              onClick={handleCancelRequest}
              disabled={busyKey === "cancel-request" || payload?.status === "CANCELLED" || payload?.status === "APPLIED"}
            >
              {busyKey === "cancel-request" ? "A cancelar..." : "Cancelar pedido"}
            </button>
          </div>
        </div>

        {!!payload && openConflicts.length > 0 && (
          <div className="rounded-xl border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            Faltam {openConflicts.length} conflitos para poderes aplicar este pedido.
          </div>
        )}

        {(isLoading || !payload) && (
          <p className="text-sm text-white/65">A carregar conflitos...</p>
        )}

        {!!payload && openConflicts.length === 0 && (
          <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            Não existem conflitos abertos. Podes aplicar o pedido manualmente.
          </div>
        )}
      </section>

      {cancelableConflicts.length > 0 && (
        <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white">Conflitos canceláveis ({cancelableConflicts.length})</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={CTA_NEUTRAL}
                onClick={() => setSelectedIds(cancelableConflicts.map((item) => item.id))}
              >
                Selecionar todos
              </button>
              <button
                type="button"
                className={CTA_DANGER}
                disabled={selectedCancelableIds.length === 0 || busyKey === "bulk-cancel"}
                onClick={() => setBulkModalOpen(true)}
              >
                Cancelar selecionados ({selectedCancelableIds.length})
              </button>
            </div>
          </div>

          {cancelableConflicts.map((conflict) => {
            const startsAtLabel = new Date(conflict.startsAt).toLocaleString("pt-PT");
            const endsAtLabel = new Date(conflict.endsAt).toLocaleString("pt-PT");
            const selected = selectedCancelableIds.includes(conflict.id);
            return (
              <article key={conflict.id} className="rounded-xl border border-white/12 bg-white/[0.03] p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-white/25 bg-black/30"
                      checked={selected}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setSelectedIds((prev) =>
                          checked ? [...new Set([...prev, conflict.id])] : prev.filter((id) => id !== conflict.id),
                        );
                      }}
                    />
                    {formatConflictEntity(conflict.entityType)} #{conflict.entityId}
                  </label>
                  <span className="rounded-full border border-amber-300/40 px-2 py-0.5 text-[11px] text-amber-100">
                    {conflict.reasonCode ?? "OUTSIDE_AVAILABILITY"}
                  </span>
                </div>
                <p className="text-xs text-white/65">Bloqueia aplicação: {startsAtLabel} → {endsAtLabel}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={CTA_DANGER}
                    onClick={() => handleCancelOne(conflict.id)}
                    disabled={busyKey === `cancel-${conflict.id}` || busyKey === "bulk-cancel"}
                  >
                    {busyKey === `cancel-${conflict.id}` ? "A cancelar..." : "Cancelar"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}>
        <p className="text-sm font-semibold text-white">Conflitos com resolução externa</p>
        <p className="text-xs text-white/60">
          Para estes conflitos, a resolução é feita na entidade de origem (calendário). O pedido fica pendente até essa resolução.
        </p>

        {openConflicts.filter((item) => !isCancelable(item.entityType)).length === 0 && (
          <p className="text-xs text-white/50">Sem conflitos externos em aberto.</p>
        )}

        {openConflicts
          .filter((item) => !isCancelable(item.entityType))
          .map((conflict) => {
            const startsAtLabel = new Date(conflict.startsAt).toLocaleString("pt-PT");
            const endsAtLabel = new Date(conflict.endsAt).toLocaleString("pt-PT");
            const dayKey = toDateKey(conflict.startsAt);
            return (
              <article key={conflict.id} className="rounded-xl border border-white/12 bg-white/[0.03] p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">
                    {formatConflictEntity(conflict.entityType)} #{conflict.entityId}
                  </p>
                  <span className="rounded-full border border-violet-300/40 px-2 py-0.5 text-[11px] text-violet-100">
                    Resolver externamente
                  </span>
                </div>
                <p className="text-xs text-white/65">Bloqueia aplicação: {startsAtLabel} → {endsAtLabel}</p>
                <div className="flex items-center gap-2">
                  <Link
                    href={buildOrgHref(orgId, "/calendar/day", dayKey ? { date: dayKey } : undefined)}
                    className={CTA_NEUTRAL}
                  >
                    Abrir no calendário
                  </Link>
                </div>
              </article>
            );
          })}
      </section>

      {bulkProgress > 0 && (
        <section className={cn(DASHBOARD_CARD, "p-3 space-y-2")}>
          <p className="text-xs text-white/70">Execução de cancelamento em massa</p>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-cyan-300 transition-all"
              style={{ width: `${Math.max(2, Math.min(100, bulkProgress))}%` }}
            />
          </div>
        </section>
      )}

      {bulkResult && (
        <section className={cn(DASHBOARD_CARD, "p-3 space-y-1")}>
          <p className="text-sm font-semibold text-white">Resultado do cancelamento em massa</p>
          <p className="text-xs text-white/70">
            Processados: {bulkResult.processed} · Sucessos: {bulkResult.successCount} · Falhas: {bulkResult.failureCount}
          </p>
          {bulkResult.failed.length > 0 && (
            <div className="rounded-lg border border-rose-300/35 bg-rose-500/10 p-2 text-xs text-rose-100">
              {bulkResult.failed.slice(0, 6).map((item) => (
                <p key={`failed-${item.conflictId}`}>
                  Conflito #{item.conflictId}: {item.message}
                </p>
              ))}
            </div>
          )}
        </section>
      )}

      {bulkModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#070d18] p-4 space-y-3">
            <h2 className="text-lg font-semibold text-white">Confirmar cancelamento em massa</h2>
            <p className="text-sm text-white/75">
              Vais cancelar {selectedCancelableIds.length} conflitos canceláveis deste pedido. Esta ação pode desencadear reembolsos.
            </p>
            <p className="text-xs text-white/60">Escreve <span className="font-semibold text-white">CANCELAR</span> para confirmar.</p>
            <input
              value={bulkConfirmText}
              onChange={(event) => setBulkConfirmText(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/35"
              placeholder="CANCELAR"
            />
            <div className="flex items-center justify-end gap-2">
              <button type="button" className={CTA_NEUTRAL} onClick={() => setBulkModalOpen(false)}>
                Fechar
              </button>
              <button
                type="button"
                className={CTA_DANGER}
                onClick={handleBulkCancel}
                disabled={bulkConfirmText.trim().toUpperCase() !== "CANCELAR" || busyKey === "bulk-cancel"}
              >
                {busyKey === "bulk-cancel" ? "A processar..." : "Confirmar cancelamento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </div>
      )}
    </div>
  );
}
