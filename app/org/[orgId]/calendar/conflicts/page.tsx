"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";
import { cn } from "@/lib/utils";
import { CTA_PRIMARY, DASHBOARD_CARD, DASHBOARD_LABEL, DASHBOARD_MUTED } from "@/app/org/_internal/core/dashboardUi";

type ChangeSetItem = {
  id: number;
  scopeType: "ORGANIZATION" | "PROFESSIONAL" | "RESOURCE";
  scopeId: number;
  status: "PENDING" | "READY_TO_APPLY" | "APPLIED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
  conflictsOpen: number;
};

type ChangesetListResponse = {
  ok: boolean;
  data?: {
    items: ChangeSetItem[];
    summary: {
      pendingSets: number;
      readyToApplySets: number;
      openConflictsTotal: number;
    };
    pagination: {
      limit: number;
      nextCursor: number | null;
    };
  };
  message?: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function formatScope(scopeType: ChangeSetItem["scopeType"], scopeId: number) {
  if (scopeType === "ORGANIZATION") return "Organização";
  if (scopeType === "PROFESSIONAL") return `Profissional #${scopeId}`;
  return `Recurso #${scopeId}`;
}

function formatStatus(status: ChangeSetItem["status"]) {
  if (status === "PENDING") return "Pedido pendente";
  if (status === "READY_TO_APPLY") return "Pronto para aplicar";
  if (status === "APPLIED") return "Aplicado";
  return "Cancelado";
}

export default function CalendarConflictsPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = Number(params?.orgId);
  const canLoad = Number.isFinite(orgId) && orgId > 0;

  const apiPath = canLoad
    ? resolveCanonicalOrgApiPath(
        "/api/org/[orgId]/reservas/disponibilidade/changesets?statuses=PENDING,READY_TO_APPLY&limit=50",
      )
    : null;

  const { data, isLoading } = useSWR<ChangesetListResponse>(apiPath, fetcher, {
    revalidateOnFocus: true,
  });

  const payload = data?.data;
  const items = payload?.items ?? [];
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [items],
  );

  if (!canLoad) {
    return (
      <section className={cn(DASHBOARD_CARD, "p-5")}>
        <p className="text-sm text-white/70">Organização inválida.</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={DASHBOARD_LABEL}>Calendário</p>
            <h1 className="text-xl font-semibold text-white">Conflitos de disponibilidade</h1>
            <p className={DASHBOARD_MUTED}>Pedidos pendentes e prontos a aplicar, com resolução operacional de conflitos.</p>
          </div>
          <Link href={buildOrgHref(orgId, "/calendar/availability")} className={CTA_PRIMARY}>
            Abrir disponibilidade
          </Link>
        </div>
      </header>

      <section className={cn(DASHBOARD_CARD, "p-4 grid gap-3 md:grid-cols-3")}>{/* summary */}
        <article className="rounded-xl border border-white/12 bg-white/5 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">Pendentes</p>
          <p className="mt-1 text-2xl font-semibold text-white">{payload?.summary.pendingSets ?? 0}</p>
        </article>
        <article className="rounded-xl border border-white/12 bg-white/5 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">Prontos a aplicar</p>
          <p className="mt-1 text-2xl font-semibold text-white">{payload?.summary.readyToApplySets ?? 0}</p>
        </article>
        <article className="rounded-xl border border-white/12 bg-white/5 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">Conflitos abertos</p>
          <p className="mt-1 text-2xl font-semibold text-white">{payload?.summary.openConflictsTotal ?? 0}</p>
        </article>
      </section>

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Pedidos em aberto</p>
          {isLoading ? <p className="text-xs text-white/60">A carregar...</p> : null}
        </div>

        {!isLoading && sortedItems.length === 0 && (
          <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            Sem pedidos pendentes/prontos nesta organização.
          </div>
        )}

        {sortedItems.map((item) => {
          const createdAt = new Date(item.createdAt).toLocaleString("pt-PT");
          const updatedAt = new Date(item.updatedAt).toLocaleString("pt-PT");
          return (
            <article key={item.id} className="rounded-xl border border-white/12 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">Pedido #{item.id}</p>
                  <p className="text-xs text-white/60">
                    {formatStatus(item.status)} · {formatScope(item.scopeType, item.scopeId)}
                  </p>
                  <p className="text-[11px] text-white/45">Criado: {createdAt} · Atualizado: {updatedAt}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-amber-300/40 px-2 py-0.5 text-[11px] text-amber-100">
                    Conflitos: {item.conflictsOpen}
                  </span>
                  <Link href={buildOrgHref(orgId, `/calendar/conflicts/${item.id}`)} className={CTA_PRIMARY}>
                    Abrir
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
