"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";
import { cn } from "@/lib/utils";
import {
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
} from "@/app/org/_internal/core/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ProgressResponse = {
  ok: boolean;
  studentId: string;
  bookings: {
    total: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };
  attendance: {
    present: number;
    absent: number;
    late: number;
    lastMarkedAt: string | null;
  };
  goals: Array<{ id: number; title: string; status: string; targetDate: string | null }>;
  latestNotes: Array<{ id: number; createdAt: string; trainerUserId: string; sessionId: number | null; note: string }>;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export default function TrainerStudentPage() {
  const params = useParams();
  const orgIdRaw = Array.isArray(params?.orgId) ? params.orgId[0] : params?.orgId;
  const studentIdRaw = Array.isArray(params?.studentId) ? params.studentId[0] : params?.studentId;
  const organizationId = Number(orgIdRaw);
  const studentId = String(studentIdRaw ?? "");
  const canonicalOrganizationId = Number.isFinite(organizationId) && organizationId > 0 ? organizationId : null;

  const { data, isLoading, mutate } = useSWR<ProgressResponse>(
    studentId
      ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/students/${encodeURIComponent(studentId)}/progress`)
      : null,
    fetcher,
  );

  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateNote = async () => {
    const trimmed = note.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/academy/trainers/me/notes"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, note: trimmed, visibility: "COACH_ONLY" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Não foi possível guardar a nota.");
      }
      setNote("");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível guardar a nota.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className={DASHBOARD_LABEL}>Academia · Aluno</p>
        <h1 className="text-xl font-semibold text-white">Percurso do aluno</h1>
        <p className={DASHBOARD_MUTED}>Histórico, assiduidade e notas para preparar a próxima sessão.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className={cn(DASHBOARD_CARD, "p-4")}>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">Aulas concluídas</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data?.bookings.completed ?? 0}</p>
        </article>
        <article className={cn(DASHBOARD_CARD, "p-4")}>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">Presenças</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data?.attendance.present ?? 0}</p>
        </article>
        <article className={cn(DASHBOARD_CARD, "p-4")}>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">No-show</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data?.bookings.noShow ?? 0}</p>
        </article>
      </section>

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-white">Nota rápida do treinador</h2>
          <Link
            href={appendOrganizationIdToHref("/org/academy/trainer/me", canonicalOrganizationId)}
            className={CTA_SECONDARY}
          >
            Voltar ao dia
          </Link>
        </div>

        <textarea
          className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Objetivo técnico, correções e plano para próxima sessão"
        />

        {error && <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p>}

        <button type="button" className={CTA_PRIMARY} onClick={handleCreateNote} disabled={saving || !note.trim()}>
          {saving ? "A guardar..." : "Guardar nota"}
        </button>
      </section>

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}>
        <h2 className="text-base font-semibold text-white">Objetivos</h2>
        {isLoading && <p className="text-sm text-white/60">A carregar objetivos...</p>}
        {!isLoading && (data?.goals?.length ?? 0) === 0 && <p className="text-sm text-white/60">Sem objetivos definidos.</p>}
        <div className="grid gap-2">
          {(data?.goals ?? []).map((goal) => (
            <article key={goal.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-sm font-semibold text-white">{goal.title}</p>
              <p className="text-[12px] text-white/60">{goal.status} · alvo {formatDate(goal.targetDate)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}>
        <h2 className="text-base font-semibold text-white">Últimas notas</h2>
        {!isLoading && (data?.latestNotes?.length ?? 0) === 0 && <p className="text-sm text-white/60">Sem notas ainda.</p>}
        <div className="grid gap-2">
          {(data?.latestNotes ?? []).map((item) => (
            <article key={item.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[12px] text-white/60">{formatDate(item.createdAt)}</p>
              <p className="text-sm text-white">{item.note}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
