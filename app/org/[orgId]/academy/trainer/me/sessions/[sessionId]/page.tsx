"use client";

import { useMemo, useState } from "react";
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

type SessionResponse = {
  ok: boolean;
  session: {
    id: number;
    classId: number;
    classTitle: string;
    startsAt: string;
    endsAt: string;
    capacity: number;
    status: string;
    trainer: { id: number; name: string; userId: string | null } | null;
    court: { id: number; name: string | null } | null;
    enrolledCount: number;
    waitlistCount: number;
  };
  enrollments: Array<{
    id: number;
    bookingId: number | null;
    userId: string | null;
    status: string;
    student: { id: string; fullName: string | null; username: string | null; avatarUrl: string | null } | null;
    attendance: { id: number; status: string; note: string | null } | null;
  }>;
};

type AttendanceState = {
  status: "PRESENT" | "ABSENT" | "LATE";
  note: string;
};

function formatDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function resolveStudentLabel(item: SessionResponse["enrollments"][number]) {
  const fullName = item.student?.fullName?.trim();
  if (fullName) return fullName;
  const username = item.student?.username?.trim();
  if (username) return `@${username}`;
  if (item.userId) return item.userId;
  return "Aluno";
}

export default function TrainerSessionPage() {
  const params = useParams();
  const orgIdRaw = Array.isArray(params?.orgId) ? params.orgId[0] : params?.orgId;
  const sessionIdRaw = Array.isArray(params?.sessionId) ? params.sessionId[0] : params?.sessionId;
  const organizationId = Number(orgIdRaw);
  const sessionId = Number(sessionIdRaw);
  const canonicalOrganizationId = Number.isFinite(organizationId) && organizationId > 0 ? organizationId : null;

  const { data, isLoading, mutate } = useSWR<SessionResponse>(
    Number.isFinite(sessionId) && sessionId > 0
      ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/sessions/${sessionId}`)
      : null,
    fetcher,
  );

  const initialState = useMemo(() => {
    const map: Record<string, AttendanceState> = {};
    for (const enrollment of data?.enrollments ?? []) {
      if (!enrollment.userId) continue;
      map[enrollment.userId] = {
        status:
          enrollment.attendance?.status === "ABSENT"
            ? "ABSENT"
            : enrollment.attendance?.status === "LATE"
              ? "LATE"
              : "PRESENT",
        note: enrollment.attendance?.note ?? "",
      };
    }
    return map;
  }, [data?.enrollments]);

  const [attendanceState, setAttendanceState] = useState<Record<string, AttendanceState>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveState = Object.keys(attendanceState).length > 0 ? attendanceState : initialState;

  const handleSubmitAttendance = async () => {
    if (!data?.session) return;
    setSaving(true);
    setError(null);

    try {
      const items = (data.enrollments ?? [])
        .filter((item) => Boolean(item.userId))
        .map((item) => {
          const userId = item.userId as string;
          const state = effectiveState[userId] ?? { status: "PRESENT", note: "" };
          return {
            studentId: userId,
            status: state.status,
            note: state.note.trim() || null,
          };
        });

      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/sessions/${data.session.id}/attendance`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Não foi possível guardar presenças.");
      }
      await mutate();
      setAttendanceState({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível guardar presenças.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className={DASHBOARD_LABEL}>Academia · Sessão</p>
        <h1 className="text-xl font-semibold text-white">Operação da sessão</h1>
        <p className={DASHBOARD_MUTED}>Fluxo rápido para presenças e notas pedagógicas.</p>
      </header>

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}>
        {isLoading && <p className="text-sm text-white/60">A carregar sessão...</p>}
        {!isLoading && !data?.session && <p className="text-sm text-white/60">Sessão não encontrada.</p>}
        {data?.session && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-white">{data.session.classTitle}</p>
                <p className="text-[12px] text-white/60">{formatDateTime(data.session.startsAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={appendOrganizationIdToHref("/org/academy/trainer/me", canonicalOrganizationId)}
                  className={CTA_SECONDARY}
                >
                  Voltar
                </Link>
                <button type="button" className={CTA_PRIMARY} onClick={handleSubmitAttendance} disabled={saving}>
                  {saving ? "A guardar..." : "Guardar presenças"}
                </button>
              </div>
            </div>

            {error && <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</p>}

            <div className="grid gap-2">
              {data.enrollments.map((enrollment) => {
                if (!enrollment.userId) return null;
                const state = effectiveState[enrollment.userId] ?? { status: "PRESENT", note: "" };
                return (
                  <article key={enrollment.id} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{resolveStudentLabel(enrollment)}</p>
                      <Link
                        href={appendOrganizationIdToHref(
                          `/org/academy/trainer/me/students/${enrollment.userId}`,
                          canonicalOrganizationId,
                        )}
                        className={CTA_SECONDARY}
                      >
                        Ver aluno
                      </Link>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
                      <select
                        className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                        value={state.status}
                        onChange={(event) =>
                          setAttendanceState((prev) => ({
                            ...prev,
                            [enrollment.userId as string]: {
                              status: event.target.value as AttendanceState["status"],
                              note: prev[enrollment.userId as string]?.note ?? state.note,
                            },
                          }))
                        }
                      >
                        <option value="PRESENT">Presente</option>
                        <option value="LATE">Atrasado</option>
                        <option value="ABSENT">Ausente</option>
                      </select>
                      <input
                        className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                        value={state.note}
                        onChange={(event) =>
                          setAttendanceState((prev) => ({
                            ...prev,
                            [enrollment.userId as string]: {
                              status: prev[enrollment.userId as string]?.status ?? state.status,
                              note: event.target.value,
                            },
                          }))
                        }
                        placeholder="Nota pedagógica (opcional)"
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
