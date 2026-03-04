"use client";

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

type TrainerDashboardResponse = {
  ok: boolean;
  trainerUserId: string;
  nextSessions: Array<{
    id: number;
    classId: number;
    classTitle: string;
    startsAt: string;
    endsAt: string;
    trainer: { id: number; name: string } | null;
    court: { id: number; name: string | null } | null;
    enrolledCount: number;
    waitlistCount: number;
  }>;
  pendingNotesCount: number;
  waitingMessagesCount: number;
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

export default function TrainerMePage() {
  const params = useParams();
  const orgIdRaw = Array.isArray(params?.orgId) ? params.orgId[0] : params?.orgId;
  const organizationId = Number(orgIdRaw);
  const canonicalOrganizationId = Number.isFinite(organizationId) && organizationId > 0 ? organizationId : null;

  const { data, isLoading } = useSWR<TrainerDashboardResponse>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/academy/trainers/me"),
    fetcher,
  );

  const sessions = data?.nextSessions ?? [];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className={DASHBOARD_LABEL}>Academia · Treinador</p>
        <h1 className="text-xl font-semibold text-white">Dashboard do dia</h1>
        <p className={DASHBOARD_MUTED}>
          Operação rápida para sessões, presenças e notas pedagógicas.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className={cn(DASHBOARD_CARD, "p-4")}> 
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">Próximas sessões</p>
          <p className="mt-2 text-2xl font-semibold text-white">{sessions.length}</p>
        </article>
        <article className={cn(DASHBOARD_CARD, "p-4")}>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">Notas pendentes</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data?.pendingNotesCount ?? 0}</p>
        </article>
        <article className={cn(DASHBOARD_CARD, "p-4")}>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">Mensagens por responder</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data?.waitingMessagesCount ?? 0}</p>
        </article>
      </section>

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">Próximas sessões</h2>
          <Link
            href={appendOrganizationIdToHref("/org/academy/classes", canonicalOrganizationId)}
            className={CTA_SECONDARY}
          >
            Ver aulas
          </Link>
        </div>

        {isLoading && <p className="text-sm text-white/60">A carregar sessões...</p>}
        {!isLoading && sessions.length === 0 && (
          <p className="text-sm text-white/60">Sem sessões atribuídas para hoje.</p>
        )}

        <div className="grid gap-2">
          {sessions.map((session) => (
            <article key={session.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">{session.classTitle}</p>
                  <p className="text-[12px] text-white/60">{formatDateTime(session.startsAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-white/65">
                    {session.enrolledCount} inscritos · {session.waitlistCount} waitlist
                  </span>
                  <Link
                    href={appendOrganizationIdToHref(
                      `/org/academy/trainer/me/sessions/${session.id}`,
                      canonicalOrganizationId,
                    )}
                    className={CTA_PRIMARY}
                  >
                    Abrir sessão
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
