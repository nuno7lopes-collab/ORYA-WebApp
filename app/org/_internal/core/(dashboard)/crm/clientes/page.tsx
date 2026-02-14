"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

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
  CTA_PRIMARY,
} from "@/app/org/_internal/core/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type CustomerRow = {
  id: string;
  userId: string | null;
  contactType: string;
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
  total?: number;
  page?: number;
  limit?: number;
  items?: CustomerRow[];
  error?: string;
  message?: string;
};

type MarketingFilter = "all" | "true" | "false";

type CustomerFilters = {
  query: string;
  tags: string;
  minSpentEur: string;
  maxSpentEur: string;
  lastActivityDays: string;
  marketingOptIn: MarketingFilter;
};

type CustomerSavedView = {
  id: string;
  name: string;
  filters: CustomerFilters;
  isDefault: boolean;
  updatedAt: string;
};

type SavedViewItem = {
  id: string;
  scope: "CUSTOMERS" | "SEGMENTS";
  name: string;
  definition: unknown;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type SavedViewListResponse = {
  ok: boolean;
  items?: SavedViewItem[];
  view?: SavedViewItem;
  error?: string;
  message?: string;
};

const CONTACT_TYPE_LABELS: Record<string, string> = {
  CUSTOMER: "Cliente",
  LEAD: "Lead",
  FOLLOWER: "Seguidor",
  STAFF: "Staff",
  GUEST: "Convidado",
};

const PAGE_SIZE = 20;

const SYSTEM_VIEWS: Array<{ id: string; label: string; patch: Partial<CustomerFilters> }> = [
  { id: "active_30d", label: "Ativos 30d", patch: { lastActivityDays: "30" } },
  { id: "opt_in", label: "Com opt-in", patch: { marketingOptIn: "true" } },
  { id: "vip_100", label: "Gasto ≥ 100€", patch: { minSpentEur: "100" } },
];

function createEmptyFilters(): CustomerFilters {
  return {
    query: "",
    tags: "",
    minSpentEur: "",
    maxSpentEur: "",
    lastActivityDays: "",
    marketingOptIn: "all",
  };
}

function normalizeFilters(raw: Partial<CustomerFilters> | null | undefined): CustomerFilters {
  const fallback = createEmptyFilters();
  if (!raw || typeof raw !== "object") return fallback;
  return {
    query: typeof raw.query === "string" ? raw.query : fallback.query,
    tags: typeof raw.tags === "string" ? raw.tags : fallback.tags,
    minSpentEur: typeof raw.minSpentEur === "string" ? raw.minSpentEur : fallback.minSpentEur,
    maxSpentEur: typeof raw.maxSpentEur === "string" ? raw.maxSpentEur : fallback.maxSpentEur,
    lastActivityDays: typeof raw.lastActivityDays === "string" ? raw.lastActivityDays : fallback.lastActivityDays,
    marketingOptIn:
      raw.marketingOptIn === "true" || raw.marketingOptIn === "false" || raw.marketingOptIn === "all"
        ? raw.marketingOptIn
        : fallback.marketingOptIn,
  };
}

function parseViewFilters(definition: unknown): CustomerFilters {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    return createEmptyFilters();
  }
  const payload = definition as { filters?: unknown };
  if (payload.filters && typeof payload.filters === "object" && !Array.isArray(payload.filters)) {
    return normalizeFilters(payload.filters as Partial<CustomerFilters>);
  }
  return normalizeFilters(definition as Partial<CustomerFilters>);
}

function resolveSavedViewItemPath(viewId: string) {
  return resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/saved-views/[id]").replace("/[id]", `/${viewId}`);
}

function formatRelativeDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDateTime(date);
}

function parseEuroToCents(value: string) {
  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

function countActiveFilters(filters: CustomerFilters) {
  let count = 0;
  if (filters.query.trim()) count += 1;
  if (filters.tags.trim()) count += 1;
  if (filters.minSpentEur.trim()) count += 1;
  if (filters.maxSpentEur.trim()) count += 1;
  if (filters.lastActivityDays.trim()) count += 1;
  if (filters.marketingOptIn !== "all") count += 1;
  return count;
}

export default function CrmClientesPage() {
  const [draftFilters, setDraftFilters] = useState<CustomerFilters>(() => createEmptyFilters());
  const [filters, setFilters] = useState<CustomerFilters>(() => createEmptyFilters());
  const [page, setPage] = useState(1);

  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(null);
  const [newViewName, setNewViewName] = useState("");
  const [savedViewNotice, setSavedViewNotice] = useState<string | null>(null);
  const [defaultApplied, setDefaultApplied] = useState(false);
  const [savingView, setSavingView] = useState(false);
  const [viewActionId, setViewActionId] = useState<string | null>(null);

  const savedViewsUrl = resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/saved-views?scope=CUSTOMERS");
  const {
    data: savedViewsData,
    mutate: mutateSavedViews,
    isLoading: isLoadingSavedViews,
  } = useSWR<SavedViewListResponse>(savedViewsUrl, fetcher, {
    keepPreviousData: true,
  });
  const savedViewsApiError = savedViewsData?.ok === false;

  const savedViews = useMemo<CustomerSavedView[]>(() => {
    if (!savedViewsData?.ok) return [];
    return (savedViewsData.items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      filters: parseViewFilters(item.definition),
      isDefault: Boolean(item.isDefault),
      updatedAt: item.updatedAt,
    }));
  }, [savedViewsData]);

  const defaultViewId = useMemo(
    () => savedViews.find((view) => view.isDefault)?.id ?? null,
    [savedViews],
  );

  const applyFilterSet = (next: CustomerFilters, sourceSavedViewId?: string | null) => {
    setDraftFilters(next);
    setFilters(next);
    setPage(1);
    setActiveSavedViewId(sourceSavedViewId ?? null);
  };

  useEffect(() => {
    if (savedViewsData === undefined || defaultApplied) return;
    if (countActiveFilters(filters) > 0 || !defaultViewId) {
      setDefaultApplied(true);
      return;
    }
    const defaultView = savedViews.find((view) => view.id === defaultViewId);
    if (defaultView) {
      applyFilterSet(defaultView.filters, defaultView.id);
    }
    setDefaultApplied(true);
  }, [defaultApplied, defaultViewId, filters, savedViews, savedViewsData]);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (filters.query.trim()) params.set("q", filters.query.trim());
    if (filters.tags.trim()) params.set("tags", filters.tags.trim());
    const minSpentCents = parseEuroToCents(filters.minSpentEur);
    const maxSpentCents = parseEuroToCents(filters.maxSpentEur);
    if (minSpentCents !== null) params.set("minSpentCents", String(minSpentCents));
    if (maxSpentCents !== null) params.set("maxSpentCents", String(maxSpentCents));
    if (filters.lastActivityDays.trim()) params.set("lastActivityDays", filters.lastActivityDays.trim());
    if (filters.marketingOptIn !== "all") params.set("marketingOptIn", filters.marketingOptIn);
    return resolveCanonicalOrgApiPath(`/api/org/[orgId]/crm/clientes?${params.toString()}`);
  }, [page, filters]);

  const { data, isLoading, isValidating } = useSWR<CustomerListResponse>(url, fetcher, {
    keepPreviousData: true,
  });

  const isApiError = data?.ok === false;
  const items = data?.ok ? data.items ?? [] : [];
  const total = data?.ok ? data.total ?? 0 : 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);
  const activeSavedView = useMemo(
    () => savedViews.find((view) => view.id === activeSavedViewId) ?? null,
    [activeSavedViewId, savedViews],
  );

  const applyFilters = () => {
    setPage(1);
    setFilters({
      ...draftFilters,
      query: draftFilters.query.trim(),
      tags: draftFilters.tags.trim(),
    });
    setActiveSavedViewId(null);
  };

  const clearFilters = () => {
    const empty = createEmptyFilters();
    applyFilterSet(empty, null);
  };

  const applyPreset = (patch: Partial<CustomerFilters>) => {
    const next = normalizeFilters({ ...draftFilters, ...patch });
    applyFilterSet(next, null);
  };

  const applySavedView = (view: CustomerSavedView) => {
    setSavedViewNotice(`Vista aplicada: ${view.name}`);
    applyFilterSet(view.filters, view.id);
  };

  const saveCurrentView = async () => {
    const name = newViewName.trim();
    if (name.length < 2) {
      setSavedViewNotice("Dá um nome à vista (mínimo 2 caracteres).");
      return;
    }
    setSavingView(true);
    try {
      const filtersToSave = normalizeFilters(draftFilters);
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/saved-views"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "CUSTOMERS",
          name,
          definition: { filters: filtersToSave },
        }),
      });
      const json = (await res.json().catch(() => null)) as SavedViewListResponse | null;
      if (!res.ok || !json?.ok || !json.view) {
        throw new Error(json?.message ?? json?.error ?? "Falha ao guardar vista.");
      }
      await mutateSavedViews();
      setActiveSavedViewId(json.view.id);
      setSavedViewNotice("Vista guardada.");
      setNewViewName("");
    } catch (err) {
      setSavedViewNotice(err instanceof Error ? err.message : "Falha ao guardar vista.");
    } finally {
      setSavingView(false);
    }
  };

  const toggleDefaultSavedView = async (view: CustomerSavedView) => {
    setViewActionId(view.id);
    try {
      const res = await fetch(resolveSavedViewItemPath(view.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: !view.isDefault }),
      });
      const json = (await res.json().catch(() => null)) as SavedViewListResponse | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message ?? json?.error ?? "Falha ao atualizar vista.");
      }
      await mutateSavedViews();
      setSavedViewNotice(!view.isDefault ? "Vista definida como default." : "Default removido.");
    } catch (err) {
      setSavedViewNotice(err instanceof Error ? err.message : "Falha ao atualizar default.");
    } finally {
      setViewActionId(null);
    }
  };

  const deleteSavedView = async (viewId: string) => {
    setViewActionId(viewId);
    try {
      const res = await fetch(resolveSavedViewItemPath(viewId), {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => null)) as SavedViewListResponse | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message ?? json?.error ?? "Falha ao remover vista.");
      }
      await mutateSavedViews();
      if (activeSavedViewId === viewId) {
        setActiveSavedViewId(null);
      }
      setSavedViewNotice("Vista removida.");
    } catch (err) {
      setSavedViewNotice(err instanceof Error ? err.message : "Falha ao remover vista.");
    } finally {
      setViewActionId(null);
    }
  };

  const handleDraftChange =
    <K extends keyof CustomerFilters>(key: K) =>
    (value: CustomerFilters[K]) => {
      setDraftFilters((prev) => ({ ...prev, [key]: value }));
    };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className={DASHBOARD_LABEL}>CRM</p>
        <h1 className={DASHBOARD_TITLE}>Clientes</h1>
        <p className={DASHBOARD_MUTED}>Vista unificada de clientes, atividade e consentimentos.</p>
      </header>

      <section className={cn(DASHBOARD_CARD, "space-y-4 p-4")}>
        <div className="flex flex-wrap items-center gap-2">
          {SYSTEM_VIEWS.map((view) => (
            <button key={view.id} type="button" className={CTA_NEUTRAL} onClick={() => applyPreset(view.patch)}>
              {view.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Saved views</p>
            <p className="text-[11px] text-white/55">
              {activeSavedView ? `Ativa: ${activeSavedView.name}` : "Sem vista ativa"}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {savedViews.map((view) => {
              const isActive = view.id === activeSavedViewId;
              const isDefault = view.id === defaultViewId;
              return (
                <div key={view.id} className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-1">
                  <button
                    type="button"
                    className={cn("text-[11px] text-white/80", isActive ? "font-semibold text-white" : "")}
                    onClick={() => applySavedView(view)}
                    disabled={viewActionId === view.id}
                  >
                    {view.name}
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-white/60 hover:text-white"
                    onClick={() => toggleDefaultSavedView(view)}
                    disabled={viewActionId === view.id}
                    title={isDefault ? "Remover default" : "Definir default"}
                  >
                    {isDefault ? "★" : "☆"}
                  </button>
                  <button
                    type="button"
                    className="text-[11px] text-white/60 hover:text-rose-200"
                    onClick={() => deleteSavedView(view.id)}
                    disabled={viewActionId === view.id}
                    title="Remover vista"
                  >
                    ×
                  </button>
                </div>
              );
            })}
            {savedViews.length === 0 ? <p className="text-[11px] text-white/55">Sem vistas guardadas.</p> : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className="w-full max-w-[280px] rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="Nome da vista"
              value={newViewName}
              onChange={(event) => setNewViewName(event.target.value)}
            />
            <button type="button" className={CTA_NEUTRAL} onClick={saveCurrentView} disabled={savingView}>
              {savingView ? "A guardar..." : "Guardar vista atual"}
            </button>
            {savedViewNotice ? <span className="text-[11px] text-white/60">{savedViewNotice}</span> : null}
          </div>
        </div>
        {savedViewsApiError ? (
          <p className="text-[11px] text-rose-200">Não foi possível sincronizar vistas guardadas.</p>
        ) : null}
        {isLoadingSavedViews ? <p className="text-[11px] text-white/45">A carregar vistas guardadas…</p> : null}

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-[12px] text-white/70">
              Pesquisa
              <input
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                placeholder="Nome, email, telefone"
                value={draftFilters.query}
                onChange={(event) => handleDraftChange("query")(event.target.value)}
              />
            </label>
            <label className="text-[12px] text-white/70">
              Tags
              <input
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                placeholder="VIP, premium"
                value={draftFilters.tags}
                onChange={(event) => handleDraftChange("tags")(event.target.value)}
              />
            </label>
            <label className="text-[12px] text-white/70">
              Última atividade (dias)
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                placeholder="30"
                value={draftFilters.lastActivityDays}
                onChange={(event) => handleDraftChange("lastActivityDays")(event.target.value)}
              />
            </label>
            <label className="text-[12px] text-white/70">
              Gasto mínimo (€)
              <input
                type="number"
                min={0}
                step="0.01"
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                placeholder="50.00"
                value={draftFilters.minSpentEur}
                onChange={(event) => handleDraftChange("minSpentEur")(event.target.value)}
              />
            </label>
            <label className="text-[12px] text-white/70">
              Gasto máximo (€)
              <input
                type="number"
                min={0}
                step="0.01"
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                placeholder="200.00"
                value={draftFilters.maxSpentEur}
                onChange={(event) => handleDraftChange("maxSpentEur")(event.target.value)}
              />
            </label>
            <label className="text-[12px] text-white/70">
              Marketing opt-in
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={draftFilters.marketingOptIn}
                onChange={(event) => handleDraftChange("marketingOptIn")(event.target.value as MarketingFilter)}
              >
                <option value="all">Todos</option>
                <option value="true">Com opt-in</option>
                <option value="false">Sem opt-in</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className={CTA_PRIMARY}>
              Aplicar filtros
            </button>
            <button type="button" className={CTA_NEUTRAL} onClick={clearFilters}>
              Limpar
            </button>
            <span className="text-[11px] text-white/55">
              {activeFilterCount > 0 ? `${activeFilterCount} filtros ativos` : "Sem filtros ativos"}
            </span>
          </div>
        </form>
      </section>

      {isApiError ? (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
          {data?.error ?? data?.message ?? "Não foi possível carregar os clientes."}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-white/60">{isLoading ? "A carregar..." : `${total} clientes`}</p>
          <div className="flex items-center gap-2 text-[12px] text-white/60">
            <span>{isValidating ? "A atualizar..." : "Atualizado"}</span>
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
              href={`/org/crm/clientes/${item.id}`}
              className={cn(DASHBOARD_CARD, "p-4 transition hover:border-white/25")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{item.displayName || "Cliente sem nome"}</p>
                  <p className="text-[12px] text-white/60">{item.contactEmail || item.contactPhone || "Sem contacto disponível"}</p>
                  {item.contactType ? (
                    <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/45">
                      {CONTACT_TYPE_LABELS[item.contactType] ?? item.contactType}
                    </p>
                  ) : null}
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
            <div className={cn(DASHBOARD_CARD, "space-y-3 p-6 text-center")}>
              <p className="text-sm font-semibold text-white">Sem clientes para mostrar</p>
              <p className="text-[12px] text-white/60">
                {activeFilterCount > 0
                  ? "Ajusta os filtros para alargar os resultados."
                  : "Quando houver atividade de clientes, os dados aparecem aqui."}
              </p>
              {activeFilterCount > 0 ? (
                <div>
                  <button type="button" className={CTA_NEUTRAL} onClick={clearFilters}>
                    Limpar filtros
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
