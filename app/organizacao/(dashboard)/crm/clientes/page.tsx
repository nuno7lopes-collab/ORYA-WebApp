"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateTime } from "@/lib/i18n";
import {
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
  DASHBOARD_TITLE,
  CTA_NEUTRAL,
} from "@/app/organizacao/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type CustomerRow = {
  id: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  marketingOptIn: boolean;
  lastActivityAt: string | null;
  totalSpentCents: number;
  totalOrders: number;
  totalBookings: number;
  totalAttendances: number;
  totalTournaments: number;
  totalStoreOrders: number;
  tags: string[];
  notesCount: number;
};

type CustomerListResponse = {
  ok: boolean;
  total: number;
  page: number;
  limit: number;
  items: CustomerRow[];
};

const PAGE_SIZE = 20;

function formatRelativeDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDateTime(date);
}

export default function CrmClientesPage() {
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState("");
  const [minSpent, setMinSpent] = useState("");
  const [maxSpent, setMaxSpent] = useState("");
  const [lastActivityDays, setLastActivityDays] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState<"all" | "true" | "false">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [query, tags, minSpent, maxSpent, lastActivityDays, marketingOptIn]);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (query.trim()) params.set("q", query.trim());
    if (tags.trim()) params.set("tags", tags.trim());
    if (minSpent.trim()) params.set("minSpentCents", minSpent.trim());
    if (maxSpent.trim()) params.set("maxSpentCents", maxSpent.trim());
    if (lastActivityDays.trim()) params.set("lastActivityDays", lastActivityDays.trim());
    if (marketingOptIn !== "all") params.set("marketingOptIn", marketingOptIn);
    return `/api/organizacao/crm/clientes?${params.toString()}`;
  }, [page, query, tags, minSpent, maxSpent, lastActivityDays, marketingOptIn]);

  const { data, isLoading } = useSWR<CustomerListResponse>(url, fetcher);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className={DASHBOARD_LABEL}>CRM</p>
        <h1 className={DASHBOARD_TITLE}>Clientes</h1>
        <p className={DASHBOARD_MUTED}>Customer 360 por organização, com filtros de comportamento e consentimento.</p>
      </header>

      <section className={cn(DASHBOARD_CARD, "p-4")}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-[12px] text-white/70">
            Pesquisa
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="Nome, email, telefone"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Tags
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="ex.: VIP, premium"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Última atividade (dias)
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="ex.: 30"
              value={lastActivityDays}
              onChange={(event) => setLastActivityDays(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Gasto mínimo (cêntimos)
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="ex.: 5000"
              value={minSpent}
              onChange={(event) => setMinSpent(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Gasto máximo (cêntimos)
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="ex.: 20000"
              value={maxSpent}
              onChange={(event) => setMaxSpent(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Marketing opt-in
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={marketingOptIn}
              onChange={(event) => setMarketingOptIn(event.target.value as "all" | "true" | "false")}
            >
              <option value="all">Todos</option>
              <option value="true">Com opt-in</option>
              <option value="false">Sem opt-in</option>
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-white/60">
            {isLoading ? "A carregar..." : `${total} clientes`}
          </p>
          <div className="flex items-center gap-2 text-[12px] text-white/60">
            <button
              type="button"
              className={cn(CTA_NEUTRAL, "px-3 py-1")}
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              className={cn(CTA_NEUTRAL, "px-3 py-1")}
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Seguinte
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/organizacao/crm/clientes/${item.id}`}
              className={cn(DASHBOARD_CARD, "p-4 transition hover:border-white/25")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {item.displayName || "Cliente sem nome"}
                  </p>
                  <p className="text-[12px] text-white/60">
                    {item.contactEmail || item.contactPhone || "Sem contacto disponível"}
                  </p>
                </div>
                <div className="text-right text-[12px] text-white/60">
                  <p>Última atividade</p>
                  <p className="text-white/90">{formatRelativeDate(item.lastActivityAt)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-white/70">
                <span>Gasto: {formatCurrency(item.totalSpentCents ?? 0, "EUR")}</span>
                <span>Pedidos: {item.totalOrders}</span>
                <span>Reservas: {item.totalBookings}</span>
                <span>Check-ins: {item.totalAttendances}</span>
                <span>Notas: {item.notesCount}</span>
                <span>Opt-in: {item.marketingOptIn ? "Sim" : "Não"}</span>
              </div>
              {item.tags.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span
                      key={`${item.id}-${tag}`}
                      className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/70"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </Link>
          ))}

          {!isLoading && items.length === 0 ? (
            <div className={cn(DASHBOARD_CARD, "p-6 text-center text-[12px] text-white/60")}>Sem clientes encontrados com estes filtros.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
