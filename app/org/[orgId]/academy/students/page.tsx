"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import {
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
} from "@/app/org/_internal/core/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ClientItem = {
  id: string;
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
  contactPhone?: string | null;
};

export default function AcademyStudentsPage() {
  const params = useParams();
  const orgIdRaw = Array.isArray(params?.orgId) ? params?.orgId[0] : params?.orgId;
  const organizationId = Number(orgIdRaw);
  const canonicalOrganizationId = Number.isFinite(organizationId) && organizationId > 0 ? organizationId : null;
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const shouldSearch = trimmedQuery.length >= 2;
  const { data, isLoading } = useSWR<{ ok: boolean; items: ClientItem[] }>(
    shouldSearch
      ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/students?q=${encodeURIComponent(trimmedQuery)}`)
      : null,
    fetcher,
  );
  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className={DASHBOARD_LABEL}>Academia</p>
          <h1 className="text-xl font-semibold text-white">Alunos</h1>
          <p className={DASHBOARD_MUTED}>Pesquisa rápida para marcações e aulas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={appendOrganizationIdToHref("/org/academy/classes", canonicalOrganizationId)} className={CTA_SECONDARY}>
            Aulas
          </Link>
          <Link href={appendOrganizationIdToHref("/org/academy/trainers", canonicalOrganizationId)} className={CTA_SECONDARY}>
            Treinadores
          </Link>
        </div>
      </header>

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-3")}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40 md:max-w-lg"
            placeholder="Pesquisar por nome, username, email ou telefone"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <span className="text-[11px] text-white/50">{shouldSearch ? `${items.length} resultados` : "min 2 letras"}</span>
        </div>

        {!shouldSearch && (
          <p className="text-[12px] text-white/50">Escreve pelo menos 2 letras para mostrar resultados.</p>
        )}
        {shouldSearch && isLoading && <p className="text-[12px] text-white/60">A carregar...</p>}
        {shouldSearch && !isLoading && items.length === 0 && (
          <p className="text-[12px] text-white/50">Sem alunos encontrados.</p>
        )}

        <div className="grid gap-2">
          {items.map((client) => (
            <div key={client.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[12px] font-semibold text-white">
                {client.fullName || client.username || "Aluno"}
              </p>
              <p className="text-[11px] text-white/60">
                {client.username ? `@${client.username}` : client.email || client.contactPhone || "—"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
