"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/app/organizacao/dashboardUi";
import { formatDateTime } from "@/lib/i18n";
import {
  TOURNAMENT_LIFECYCLE_LABELS,
  TOURNAMENT_LIFECYCLE_ORDER,
} from "@/domain/padel/tournamentLifecycle";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type LifecyclePayload = {
  lifecycleStatus: string;
  publishedAt?: string | null;
  lockedAt?: string | null;
  liveAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  lifecycleUpdatedAt?: string | null;
};

type LifecycleResponse = {
  ok: boolean;
  lifecycle?: LifecyclePayload;
  transitions?: string[];
  event?: { status: string };
  canManage?: boolean;
  error?: string;
};

function formatLifecycleDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDateTime(date);
}

export default function PadelTournamentLifecyclePanel({ eventId }: { eventId: number }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const { data, mutate } = useSWR<LifecycleResponse>(
    eventId ? `/api/padel/tournaments/lifecycle?eventId=${eventId}` : null,
    fetcher,
  );

  const lifecycle = data?.lifecycle;
  const currentStatus = lifecycle?.lifecycleStatus ?? null;
  const transitions = Array.isArray(data?.transitions) ? data?.transitions ?? [] : [];
  const canManage = Boolean(data?.canManage);

  const timeline = useMemo(
    () =>
      TOURNAMENT_LIFECYCLE_ORDER.map((status) => {
        const label = TOURNAMENT_LIFECYCLE_LABELS[status] ?? status;
        const active = currentStatus === status;
        const done =
          currentStatus &&
          TOURNAMENT_LIFECYCLE_ORDER.indexOf(status) <
            TOURNAMENT_LIFECYCLE_ORDER.indexOf(currentStatus as any);
        return { status, label, active, done };
      }),
    [currentStatus],
  );

  const handleTransition = async (nextStatus: string) => {
    setError(null);
    setMessage(null);
    setSaving(nextStatus);
    try {
      const res = await fetch("/api/padel/tournaments/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, nextStatus }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setError(json?.error || "Não foi possível atualizar o estado.");
        return;
      }
      setMessage("Estado atualizado.");
      mutate();
      setTimeout(() => setMessage(null), 2500);
    } catch (err) {
      console.error("[padel/lifecycle] update", err);
      setError("Erro ao atualizar estado.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="rounded-2xl border border-white/12 bg-white/5 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Lifecycle do torneio</p>
          <p className="text-sm text-white/70">Define fases e bloqueios do torneio.</p>
        </div>
        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/80">
          {currentStatus ? TOURNAMENT_LIFECYCLE_LABELS[currentStatus as any] ?? currentStatus : "—"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        {timeline.map((step, idx) => (
          <div key={step.status} className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 ${
                step.done
                  ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-100"
                  : step.active
                    ? "border-white/30 bg-white/10 text-white"
                    : "border-white/15 bg-black/30 text-white/60"
              }`}
            >
              {step.label}
            </span>
            {idx < timeline.length - 1 && <span className="text-white/25">→</span>}
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2 text-[11px] text-white/70 sm:grid-cols-2">
        <div>Publicado: {formatLifecycleDate(lifecycle?.publishedAt)}</div>
        <div>Bloqueado: {formatLifecycleDate(lifecycle?.lockedAt)}</div>
        <div>Live: {formatLifecycleDate(lifecycle?.liveAt)}</div>
        <div>Concluído: {formatLifecycleDate(lifecycle?.completedAt)}</div>
        <div>Cancelado: {formatLifecycleDate(lifecycle?.cancelledAt)}</div>
        <div>Atualizado: {formatLifecycleDate(lifecycle?.lifecycleUpdatedAt)}</div>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100">
          {message}
        </div>
      )}

      {transitions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {transitions.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => handleTransition(status)}
              disabled={!canManage || saving === status}
              className={status === "CANCELLED" ? CTA_SECONDARY : CTA_PRIMARY}
            >
              {saving === status ? "A atualizar…" : `Mover para ${TOURNAMENT_LIFECYCLE_LABELS[status as any] ?? status}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
