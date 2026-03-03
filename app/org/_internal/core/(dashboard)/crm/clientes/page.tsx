"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateTime } from "@/lib/i18n";
import { appendOrganizationIdToHref, parseOrganizationIdFromPathname } from "@/lib/organizationIdUtils";
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

type CrmTagOption = {
  id: string;
  name: string;
  slug: string;
  color: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  usageCount: number;
};

type CrmTagListResponse = {
  ok: boolean;
  tags?: CrmTagOption[];
  tag?: CrmTagOption;
  error?: string;
  message?: string;
};

const CONTACT_TYPE_LABELS: Record<string, string> = {
  CUSTOMER: "Cliente",
  LEAD: "Lead",
  FOLLOWER: "Seguidor",
  STAFF: "Equipa",
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

function parseTagTokens(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

function stringifyTagTokens(values: string[]) {
  return parseTagTokens(values.join(",")).join(", ");
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
  const pathname = usePathname();
  const organizationId = parseOrganizationIdFromPathname(pathname);
  const [draftFilters, setDraftFilters] = useState<CustomerFilters>(() => createEmptyFilters());
  const [filters, setFilters] = useState<CustomerFilters>(() => createEmptyFilters());
  const [page, setPage] = useState(1);

  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(null);
  const [newViewName, setNewViewName] = useState("");
  const [savedViewNotice, setSavedViewNotice] = useState<string | null>(null);
  const [defaultApplied, setDefaultApplied] = useState(false);
  const [savingView, setSavingView] = useState(false);
  const [viewActionId, setViewActionId] = useState<string | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [bulkTagId, setBulkTagId] = useState("");
  const [bulkMode, setBulkMode] = useState<"ADD" | "REMOVE" | "REPLACE">("ADD");
  const [bulkActionNotice, setBulkActionNotice] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#22D3EE");
  const [newTagSaving, setNewTagSaving] = useState(false);
  const [manageTagId, setManageTagId] = useState("");
  const [manageTagName, setManageTagName] = useState("");
  const [manageTagColor, setManageTagColor] = useState("#22D3EE");
  const [manageTagSaving, setManageTagSaving] = useState(false);
  const [archiveTagSaving, setArchiveTagSaving] = useState(false);

  const savedViewsUrl = resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/saved-views?scope=CUSTOMERS");
  const {
    data: savedViewsData,
    mutate: mutateSavedViews,
    isLoading: isLoadingSavedViews,
  } = useSWR<SavedViewListResponse>(savedViewsUrl, fetcher, {
    keepPreviousData: true,
  });
  const savedViewsApiError = savedViewsData?.ok === false;

  const tagsUrl = resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/tags");
  const {
    data: tagsData,
    mutate: mutateTags,
    isLoading: isLoadingTags,
  } = useSWR<CrmTagListResponse>(tagsUrl, fetcher, {
    keepPreviousData: true,
  });
  const availableTags = useMemo(() => (tagsData?.ok ? tagsData.tags ?? [] : []), [tagsData]);
  const tagByNormalizedName = useMemo(() => {
    return new Map(availableTags.map((tag) => [tag.name.toLocaleLowerCase("pt-PT"), tag]));
  }, [availableTags]);

  useEffect(() => {
    if (!manageTagId) {
      setManageTagName("");
      setManageTagColor("#22D3EE");
      return;
    }
    const selected = availableTags.find((tag) => tag.id === manageTagId);
    if (!selected) {
      setManageTagName("");
      setManageTagColor("#22D3EE");
      return;
    }
    setManageTagName(selected.name);
    setManageTagColor(selected.color);
  }, [manageTagId, availableTags]);

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

  const { data, isLoading, isValidating, mutate: mutateCustomers } = useSWR<CustomerListResponse>(url, fetcher, {
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

  useEffect(() => {
    setSelectedContactIds((prev) => prev.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  const applyFilters = () => {
    setPage(1);
    setFilters({
      ...draftFilters,
      query: draftFilters.query.trim(),
      tags: stringifyTagTokens(parseTagTokens(draftFilters.tags)),
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

  const draftSelectedTags = useMemo(() => parseTagTokens(draftFilters.tags), [draftFilters.tags]);
  const isAllVisibleSelected = items.length > 0 && items.every((item) => selectedContactIds.includes(item.id));

  const toggleDraftTag = (tagName: string) => {
    setDraftFilters((prev) => {
      const selected = parseTagTokens(prev.tags);
      const exists = selected.includes(tagName);
      const next = exists ? selected.filter((tag) => tag !== tagName) : [...selected, tagName];
      return { ...prev, tags: stringifyTagTokens(next) };
    });
  };

  const toggleContactSelection = (contactId: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId],
    );
  };

  const toggleSelectAllVisible = () => {
    setSelectedContactIds((prev) => {
      if (!items.length) return prev;
      if (isAllVisibleSelected) {
        return prev.filter((id) => !items.some((item) => item.id === id));
      }
      const merged = new Set(prev);
      for (const item of items) merged.add(item.id);
      return Array.from(merged);
    });
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (name.length < 2) {
      setBulkActionNotice("Nome da tag inválido (mínimo 2 caracteres).");
      return;
    }
    setNewTagSaving(true);
    setBulkActionNotice(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/tags"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: newTagColor }),
      });
      const json = (await res.json().catch(() => null)) as CrmTagListResponse | null;
      if (!res.ok || !json?.ok || !json.tag) {
        throw new Error(json?.message ?? json?.error ?? "Falha ao criar tag.");
      }
      await mutateTags();
      setNewTagName("");
      setBulkTagId(json.tag.id);
      setManageTagId(json.tag.id);
      setBulkActionNotice(`Tag criada: ${json.tag.name}`);
    } catch (err) {
      setBulkActionNotice(err instanceof Error ? err.message : "Falha ao criar tag.");
    } finally {
      setNewTagSaving(false);
    }
  };

  const handleBulkApplyTags = async () => {
    if (!selectedContactIds.length) {
      setBulkActionNotice("Seleciona pelo menos um cliente.");
      return;
    }

    const selectedTag = availableTags.find((item) => item.id === bulkTagId);
    if (!selectedTag) {
      setBulkActionNotice("Seleciona uma tag para aplicar.");
      return;
    }

    setBulkSaving(true);
    setBulkActionNotice(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/tags/assign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactIds: selectedContactIds,
          tagIds: [selectedTag.id],
          mode: bulkMode,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok: boolean;
        updatedCount?: number;
        error?: string;
        message?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message ?? json?.error ?? "Falha ao aplicar tags.");
      }
      setBulkActionNotice(`Tags atualizadas em ${json.updatedCount ?? 0} clientes.`);
      setSelectedContactIds([]);
      await Promise.all([mutateTags(), mutateCustomers()]);
    } catch (err) {
      setBulkActionNotice(err instanceof Error ? err.message : "Falha ao aplicar tags.");
    } finally {
      setBulkSaving(false);
    }
  };

  const handleUpdateTag = async () => {
    if (!manageTagId) {
      setBulkActionNotice("Seleciona uma tag para editar.");
      return;
    }
    const name = manageTagName.trim();
    if (name.length < 2) {
      setBulkActionNotice("Nome da tag inválido (mínimo 2 caracteres).");
      return;
    }
    setManageTagSaving(true);
    setBulkActionNotice(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/crm/tags/${manageTagId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          color: manageTagColor,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok: boolean;
        tag?: CrmTagOption;
        updatedContacts?: number;
        error?: string;
        message?: string;
      } | null;
      if (!res.ok || !json?.ok || !json.tag) {
        throw new Error(json?.message ?? json?.error ?? "Falha ao atualizar tag.");
      }
      setBulkActionNotice(`Tag atualizada. Contactos ajustados: ${json.updatedContacts ?? 0}.`);
      await Promise.all([mutateTags(), mutateCustomers()]);
    } catch (err) {
      setBulkActionNotice(err instanceof Error ? err.message : "Falha ao atualizar tag.");
    } finally {
      setManageTagSaving(false);
    }
  };

  const handleArchiveTag = async () => {
    if (!manageTagId) {
      setBulkActionNotice("Seleciona uma tag para arquivar.");
      return;
    }
    const selected = availableTags.find((tag) => tag.id === manageTagId);
    if (!selected) {
      setBulkActionNotice("Tag selecionada inválida.");
      return;
    }
    if (selected.isSystem) {
      setBulkActionNotice("Tags de sistema não podem ser arquivadas.");
      return;
    }

    setArchiveTagSaving(true);
    setBulkActionNotice(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/crm/tags/${manageTagId}`), {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => null)) as {
        ok: boolean;
        updatedContacts?: number;
        error?: string;
        message?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message ?? json?.error ?? "Falha ao arquivar tag.");
      }
      setBulkActionNotice(`Tag arquivada. Contactos ajustados: ${json.updatedContacts ?? 0}.`);
      setManageTagId("");
      if (bulkTagId === selected.id) {
        setBulkTagId("");
      }
      await Promise.all([mutateTags(), mutateCustomers()]);
    } catch (err) {
      setBulkActionNotice(err instanceof Error ? err.message : "Falha ao arquivar tag.");
    } finally {
      setArchiveTagSaving(false);
    }
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
            <div className="text-[12px] text-white/70">
              Tags (filtro)
              <input
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                placeholder="Pesquisar tags"
                value={draftFilters.tags}
                onChange={(event) => handleDraftChange("tags")(event.target.value)}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const active = draftSelectedTags.includes(tag.name);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleDraftTag(tag.name)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[10px] tracking-[0.16em]",
                        active ? "border-white/35 bg-white/15 text-white" : "border-white/15 bg-white/5 text-white/70",
                      )}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                        aria-hidden
                      />
                      {tag.name}
                    </button>
                  );
                })}
                {!availableTags.length && !isLoadingTags ? (
                  <span className="text-[11px] text-white/50">Sem tags criadas.</span>
                ) : null}
              </div>
            </div>
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

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Tags por clube</p>
          <div className="mt-2 grid gap-2 md:grid-cols-[1.1fr_auto_auto]">
            <input
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="Nova tag (ex.: Reativar Março)"
              value={newTagName}
              onChange={(event) => setNewTagName(event.target.value)}
            />
            <input
              type="color"
              className="h-[42px] w-full rounded-xl border border-white/15 bg-white/5 px-2"
              value={newTagColor}
              onChange={(event) => setNewTagColor(event.target.value)}
              aria-label="Cor da tag"
            />
            <button type="button" className={CTA_NEUTRAL} onClick={handleCreateTag} disabled={newTagSaving}>
              {newTagSaving ? "A criar..." : "Criar tag"}
            </button>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <select
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={manageTagId}
              onChange={(event) => setManageTagId(event.target.value)}
            >
              <option value="">Gerir tag existente</option>
              {availableTags.map((tag) => (
                <option key={`manage-${tag.id}`} value={tag.id}>
                  {tag.name} {tag.isSystem ? "(sistema)" : ""}
                </option>
              ))}
            </select>
            <input
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="Novo nome da tag"
              value={manageTagName}
              onChange={(event) => setManageTagName(event.target.value)}
              disabled={!manageTagId}
            />
            <input
              type="color"
              className="h-[42px] w-full rounded-xl border border-white/15 bg-white/5 px-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={manageTagColor}
              onChange={(event) => setManageTagColor(event.target.value)}
              disabled={!manageTagId}
              aria-label="Cor da tag em edição"
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={CTA_NEUTRAL}
              onClick={handleUpdateTag}
              disabled={!manageTagId || manageTagSaving}
            >
              {manageTagSaving ? "A atualizar..." : "Atualizar tag"}
            </button>
            <button
              type="button"
              className={CTA_NEUTRAL}
              onClick={handleArchiveTag}
              disabled={!manageTagId || archiveTagSaving}
            >
              {archiveTagSaving ? "A arquivar..." : "Arquivar tag"}
            </button>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <select
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={bulkTagId}
              onChange={(event) => setBulkTagId(event.target.value)}
            >
              <option value="">Selecionar tag para atribuição em massa</option>
              {availableTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name} ({tag.usageCount})
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={bulkMode}
              onChange={(event) => setBulkMode(event.target.value as "ADD" | "REMOVE" | "REPLACE")}
            >
              <option value="ADD">Adicionar</option>
              <option value="REMOVE">Remover</option>
              <option value="REPLACE">Substituir</option>
            </select>
            <button
              type="button"
              className={CTA_PRIMARY}
              disabled={bulkSaving || selectedContactIds.length === 0}
              onClick={handleBulkApplyTags}
            >
              {bulkSaving ? "A aplicar..." : `Aplicar a ${selectedContactIds.length}`}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <button
                key={`catalog-${tag.id}`}
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/75"
                onClick={() => {
                  setBulkTagId(tag.id);
                  setManageTagId(tag.id);
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} aria-hidden />
                {tag.name}
                <span className="text-white/45">{tag.usageCount}</span>
              </button>
            ))}
          </div>
          {bulkActionNotice ? <p className="mt-2 text-[11px] text-white/65">{bulkActionNotice}</p> : null}
        </div>
      </section>

      {isApiError ? (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
          {data?.error ?? data?.message ?? "Não foi possível carregar os clientes."}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-[12px] text-white/60">
            <p>{isLoading ? "A carregar..." : `${total} clientes`}</p>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="h-3 w-3 accent-[#22D3EE]"
                checked={isAllVisibleSelected}
                onChange={toggleSelectAllVisible}
              />
              Selecionar página
            </label>
            <span>{selectedContactIds.length} selecionados</span>
          </div>
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
            <div key={item.id} className="flex items-start gap-2">
              <label className="mt-2 inline-flex h-5 w-5 items-center justify-center">
                <input
                  type="checkbox"
                  className="h-3 w-3 accent-[#22D3EE]"
                  checked={selectedContactIds.includes(item.id)}
                  onChange={() => toggleContactSelection(item.id)}
                />
              </label>
              <Link
                href={appendOrganizationIdToHref(`/org/crm/customers/${item.id}`, organizationId)}
                className={cn(DASHBOARD_CARD, "flex-1 p-4 transition hover:border-white/25")}
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
                  <span>Pagamentos jogo: {item.totalOrders}</span>
                  <span>Reservas: {item.totalBookings}</span>
                  <span>Sessões: {item.totalAttendances}</span>
                  <span>Notas: {item.notesCount}</span>
                  <span>Opt-in: {item.marketingOptIn ? "Sim" : "Não"}</span>
                </div>
                {item.tags.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.tags.map((tag) => {
                      const tagDef = tagByNormalizedName.get(tag.toLocaleLowerCase("pt-PT"));
                      return (
                        <span
                          key={`${item.id}-${tag}`}
                          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/70"
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: tagDef?.color ?? "#22D3EE" }}
                            aria-hidden
                          />
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                ) : null}
              </Link>
            </div>
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
