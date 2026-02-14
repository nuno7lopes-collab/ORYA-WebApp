"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
  DASHBOARD_TITLE,
} from "@/app/org/_shared/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ClientItem = {
  id: string;
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
  contactPhone?: string | null;
};

export default function ReservasClientesPage() {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const shouldSearch = trimmedQuery.length >= 2;
  const { data, isLoading } = useSWR<{ ok: boolean; items: ClientItem[] }>(
    shouldSearch
      ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas/clientes?q=${encodeURIComponent(trimmedQuery)}`)
      : null,
    fetcher,
  );
  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <p className={DASHBOARD_LABEL}>Reservas</p>
        <h1 className={DASHBOARD_TITLE}>Clientes</h1>
        <p className={DASHBOARD_MUTED}>Pesquisa rápida para marcações e reservas.</p>
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
          <p className="text-[12px] text-white/50">Sem clientes encontrados.</p>
        )}

        <div className="grid gap-2">
          {items.map((client) => (
            <div key={client.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[12px] font-semibold text-white">
                {client.fullName || client.username || "Cliente"}
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
