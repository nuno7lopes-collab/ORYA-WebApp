"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/i18n";
import {
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
  DASHBOARD_TITLE,
  CTA_NEUTRAL,
  CTA_PRIMARY,
} from "@/app/organizacao/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const DATE_FIELDS = new Set(["firstInteractionAt", "lastActivityAt", "lastPurchaseAt"]);
const NUMBER_FIELDS = new Set([
  "totalSpentCents",
  "totalOrders",
  "totalBookings",
  "totalAttendances",
  "totalTournaments",
  "totalStoreOrders",
  "padel.tournamentsCount",
  "padel.noShowCount",
]);

const FIELD_OPTIONS = [
  { value: "lastActivityAt", label: "Última atividade" },
  { value: "lastPurchaseAt", label: "Última compra" },
  { value: "totalSpentCents", label: "Gasto total (cêntimos)" },
  { value: "totalOrders", label: "Total de pedidos" },
  { value: "totalBookings", label: "Total de reservas" },
  { value: "totalAttendances", label: "Total check-ins" },
  { value: "totalTournaments", label: "Total torneios" },
  { value: "totalStoreOrders", label: "Total compras loja" },
  { value: "contactType", label: "Tipo de contacto" },
  { value: "sourceType", label: "Origem do contacto" },
  { value: "padel.level", label: "Padel nível" },
  { value: "padel.preferredSide", label: "Padel lado preferido" },
  { value: "padel.clubName", label: "Padel clube" },
  { value: "padel.tournamentsCount", label: "Padel torneios (contagem)" },
  { value: "padel.noShowCount", label: "Padel no-shows (contagem)" },
  { value: "tag", label: "Tag" },
  { value: "interactionType", label: "Tipo de interação" },
  { value: "marketingOptIn", label: "Marketing opt-in" },
];

const OP_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  date: [
    { value: "gte", label: "Depois de" },
    { value: "lte", label: "Antes de" },
  ],
  number: [
    { value: "gte", label: "Maior ou igual" },
    { value: "lte", label: "Menor ou igual" },
  ],
  tag: [
    { value: "has", label: "Tem tag" },
    { value: "in", label: "Tem alguma" },
    { value: "not_in", label: "Não tem" },
  ],
  interactionType: [{ value: "in", label: "Inclui" }],
  marketingOptIn: [{ value: "eq", label: "É" }],
  contactType: [
    { value: "eq", label: "É" },
    { value: "in", label: "Inclui" },
  ],
  sourceType: [
    { value: "eq", label: "É" },
    { value: "in", label: "Inclui" },
  ],
  default: [{ value: "eq", label: "Igual" }],
};

const INTERACTION_TYPES = [
  "EVENT_TICKET",
  "EVENT_CHECKIN",
  "PADEL_TOURNAMENT_ENTRY",
  "PADEL_MATCH_PAYMENT",
  "BOOKING_CONFIRMED",
  "BOOKING_CANCELLED",
  "BOOKING_COMPLETED",
  "STORE_ORDER_PAID",
  "ORG_FOLLOWED",
  "ORG_UNFOLLOWED",
  "PROFILE_VIEWED",
  "EVENT_VIEWED",
  "EVENT_SAVED",
  "FORM_SUBMITTED",
];

const CONTACT_TYPES = ["CUSTOMER", "LEAD", "FOLLOWER", "STAFF", "GUEST"];

type SegmentRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  sizeCache: number | null;
  lastComputedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type SegmentListResponse = {
  ok: boolean;
  items?: SegmentRow[];
  error?: string;
  message?: string;
};

type RuleDraft = {
  id: string;
  field: string;
  op: string;
  value: string;
  windowDays: string;
};

type SegmentStatusFilter = "all" | "ACTIVE" | "DRAFT" | "PAUSED" | "ARCHIVED";
type SegmentSortFilter = "updated_desc" | "updated_asc" | "size_desc" | "name_asc";

type SegmentListFilters = {
  query: string;
  status: SegmentStatusFilter;
  minSize: string;
  updatedDays: string;
  sortBy: SegmentSortFilter;
};

type SegmentSavedView = {
  id: string;
  name: string;
  filters: SegmentListFilters;
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

const SEGMENT_SYSTEM_VIEWS: Array<{ id: string; label: string; patch: Partial<SegmentListFilters> }> = [
  { id: "active", label: "Ativos", patch: { status: "ACTIVE" } },
  { id: "largest", label: "Maior audiência", patch: { sortBy: "size_desc" } },
  { id: "updated_7d", label: "Atualizados 7d", patch: { updatedDays: "7" } },
];

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDateTime(date);
}

function resolveOpOptions(field: string) {
  if (DATE_FIELDS.has(field)) return OP_OPTIONS.date;
  if (NUMBER_FIELDS.has(field)) return OP_OPTIONS.number;
  if (field === "tag") return OP_OPTIONS.tag;
  if (field === "interactionType") return OP_OPTIONS.interactionType;
  if (field === "marketingOptIn") return OP_OPTIONS.marketingOptIn;
  if (field === "contactType") return OP_OPTIONS.contactType;
  if (field === "sourceType") return OP_OPTIONS.sourceType;
  return OP_OPTIONS.default;
}

function resolveValueHint(field: string, op: string) {
  if (!field) return "Seleciona um campo";
  if (DATE_FIELDS.has(field)) return "YYYY-MM-DD ou 30d";
  if (NUMBER_FIELDS.has(field)) return "Ex.: 100";
  if (field === "interactionType") return INTERACTION_TYPES.join(", ");
  if (field === "contactType" && op === "in") return CONTACT_TYPES.join(", ");
  if (field === "sourceType") return "Ex.: EVENT, BOOKING, STORE";
  if (field === "tag" && (op === "in" || op === "not_in")) return "VIP, premium";
  return "Ex.: valor";
}

function createDefaultListFilters(): SegmentListFilters {
  return {
    query: "",
    status: "all",
    minSize: "",
    updatedDays: "",
    sortBy: "updated_desc",
  };
}

function normalizeListFilters(raw: Partial<SegmentListFilters> | null | undefined): SegmentListFilters {
  const fallback = createDefaultListFilters();
  if (!raw || typeof raw !== "object") return fallback;
  return {
    query: typeof raw.query === "string" ? raw.query : fallback.query,
    status:
      raw.status === "all" || raw.status === "ACTIVE" || raw.status === "DRAFT" || raw.status === "PAUSED" || raw.status === "ARCHIVED"
        ? raw.status
        : fallback.status,
    minSize: typeof raw.minSize === "string" ? raw.minSize : fallback.minSize,
    updatedDays: typeof raw.updatedDays === "string" ? raw.updatedDays : fallback.updatedDays,
    sortBy:
      raw.sortBy === "updated_desc" || raw.sortBy === "updated_asc" || raw.sortBy === "size_desc" || raw.sortBy === "name_asc"
        ? raw.sortBy
        : fallback.sortBy,
  };
}

function parseSavedViewFilters(definition: unknown): SegmentListFilters {
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    return createDefaultListFilters();
  }
  const payload = definition as { filters?: unknown };
  if (payload.filters && typeof payload.filters === "object" && !Array.isArray(payload.filters)) {
    return normalizeListFilters(payload.filters as Partial<SegmentListFilters>);
  }
  return normalizeListFilters(definition as Partial<SegmentListFilters>);
}

function resolveSavedViewItemPath(viewId: string) {
  return resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/saved-views/[id]").replace("/[id]", `/${viewId}`);
}

function countListFilters(filters: SegmentListFilters) {
  let count = 0;
  if (filters.query.trim()) count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.minSize.trim()) count += 1;
  if (filters.updatedDays.trim()) count += 1;
  if (filters.sortBy !== "updated_desc") count += 1;
  return count;
}

function parsePositiveInt(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

export default function CrmSegmentosPage() {
  const { data, isLoading, mutate } = useSWR<SegmentListResponse>(resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/segmentos"), fetcher);
  const segments = data?.ok ? data.items ?? [] : [];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logic, setLogic] = useState<"AND" | "OR">("AND");
  const [rules, setRules] = useState<RuleDraft[]>([{ id: "rule-1", field: "", op: "gte", value: "", windowDays: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [listFilters, setListFilters] = useState<SegmentListFilters>(() => createDefaultListFilters());
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(null);
  const [newViewName, setNewViewName] = useState("");
  const [savedViewNotice, setSavedViewNotice] = useState<string | null>(null);
  const [defaultApplied, setDefaultApplied] = useState(false);
  const [savingView, setSavingView] = useState(false);
  const [viewActionId, setViewActionId] = useState<string | null>(null);

  const savedViewsUrl = resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/saved-views?scope=SEGMENTS");
  const {
    data: savedViewsData,
    mutate: mutateSavedViews,
    isLoading: isLoadingSavedViews,
  } = useSWR<SavedViewListResponse>(savedViewsUrl, fetcher, {
    keepPreviousData: true,
  });
  const savedViewsApiError = savedViewsData?.ok === false;

  const savedViews = useMemo<SegmentSavedView[]>(() => {
    if (!savedViewsData?.ok) return [];
    return (savedViewsData.items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      filters: parseSavedViewFilters(item.definition),
      isDefault: Boolean(item.isDefault),
      updatedAt: item.updatedAt,
    }));
  }, [savedViewsData]);

  const defaultViewId = useMemo(
    () => savedViews.find((view) => view.isDefault)?.id ?? null,
    [savedViews],
  );

  const normalizedRules = useMemo(() => {
    return rules
      .map((rule) => {
        const field = rule.field.trim();
        if (!field) return null;
        const op = rule.op || "eq";
        const rawValue = rule.value.trim();
        if (!rawValue) return null;

        let value: unknown = rawValue;
        if (NUMBER_FIELDS.has(field)) {
          const parsed = Number(rawValue);
          if (Number.isFinite(parsed)) value = parsed;
        }
        if (field === "marketingOptIn") {
          value = rawValue === "true";
        }
        if (field === "tag" && (op === "in" || op === "not_in")) {
          value = rawValue.split(",").map((entry) => entry.trim()).filter(Boolean);
        }
        if (field === "interactionType") {
          value = rawValue
            .split(",")
            .map((entry) => entry.trim().toUpperCase())
            .filter(Boolean);
        }
        if (field === "contactType") {
          value =
            op === "eq"
              ? rawValue.trim().toUpperCase()
              : rawValue
                  .split(",")
                  .map((entry) => entry.trim().toUpperCase())
                  .filter(Boolean);
        }
        if (field === "sourceType") {
          value =
            op === "eq"
              ? rawValue.trim()
              : rawValue
                  .split(",")
                  .map((entry) => entry.trim())
                  .filter(Boolean);
        }

        const windowDays = rule.windowDays.trim();
        const windowDaysNumber = windowDays ? Number(windowDays) : null;
        return {
          field,
          op,
          value,
          ...(windowDays && Number.isFinite(windowDaysNumber) ? { windowDays: windowDaysNumber } : {}),
        };
      })
      .filter(Boolean);
  }, [rules]);

  useEffect(() => {
    if (savedViewsData === undefined || defaultApplied) return;
    if (countListFilters(listFilters) > 0 || !defaultViewId) {
      setDefaultApplied(true);
      return;
    }
    const defaultView = savedViews.find((view) => view.id === defaultViewId);
    if (defaultView) {
      setListFilters(defaultView.filters);
      setActiveSavedViewId(defaultView.id);
    }
    setDefaultApplied(true);
  }, [defaultApplied, defaultViewId, listFilters, savedViews, savedViewsData]);

  const validRuleCount = normalizedRules.length;
  const canCreate = name.trim().length >= 2 && validRuleCount > 0 && !saving;

  const handleAddRule = () => {
    setRules((prev) => [...prev, { id: `rule-${prev.length + 1}`, field: "", op: "gte", value: "", windowDays: "" }]);
  };

  const addPresetRule = (preset: Pick<RuleDraft, "field" | "op" | "value" | "windowDays">) => {
    setRules((prev) => [...prev, { id: `rule-${prev.length + 1}`, ...preset }]);
  };

  const handleRemoveRule = (id: string) => {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
  };

  const handleRuleChange = (id: string, patch: Partial<RuleDraft>) => {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  const handleCreateSegment = async () => {
    if (!canCreate) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        definition: {
          version: 2,
          root: {
            kind: "group",
            id: "root",
            logic,
            children: normalizedRules.map((rule, index) => ({
              kind: "rule",
              id: `rule_${index + 1}`,
              ...rule,
            })),
          },
        },
      };
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/segmentos"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.message ?? json?.error ?? "Falha ao criar segmento");
      }
      setName("");
      setDescription("");
      setLogic("AND");
      setRules([{ id: "rule-1", field: "", op: "gte", value: "", windowDays: "" }]);
      setSuccess("Segmento criado com sucesso.");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar segmento");
    } finally {
      setSaving(false);
    }
  };

  const applySystemView = (patch: Partial<SegmentListFilters>) => {
    setListFilters((prev) => normalizeListFilters({ ...prev, ...patch }));
    setActiveSavedViewId(null);
  };

  const applySavedView = (view: SegmentSavedView) => {
    setListFilters(view.filters);
    setActiveSavedViewId(view.id);
    setSavedViewNotice(`Vista aplicada: ${view.name}`);
  };

  const saveCurrentView = async () => {
    const name = newViewName.trim();
    if (name.length < 2) {
      setSavedViewNotice("Dá um nome à vista (mínimo 2 caracteres).");
      return;
    }
    setSavingView(true);
    try {
      const filters = normalizeListFilters(listFilters);
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/crm/saved-views"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "SEGMENTS",
          name,
          definition: { filters },
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

  const toggleDefaultSavedView = async (view: SegmentSavedView) => {
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

  const filteredSegments = useMemo(() => {
    const query = listFilters.query.trim().toLowerCase();
    const minSize = parsePositiveInt(listFilters.minSize);
    const updatedDays = parsePositiveInt(listFilters.updatedDays);
    const updatedCutoff = updatedDays ? new Date(Date.now() - updatedDays * 24 * 60 * 60 * 1000) : null;

    const filtered = segments.filter((segment) => {
      if (query) {
        const haystack = `${segment.name} ${segment.description ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (listFilters.status !== "all" && segment.status !== listFilters.status) return false;
      if (minSize !== null && (segment.sizeCache ?? 0) < minSize) return false;
      if (updatedCutoff) {
        const source = segment.lastComputedAt ?? segment.updatedAt ?? segment.createdAt;
        const date = new Date(source);
        if (Number.isNaN(date.getTime()) || date < updatedCutoff) return false;
      }
      return true;
    });

    const sorted = [...filtered];
    if (listFilters.sortBy === "name_asc") {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "pt"));
      return sorted;
    }
    if (listFilters.sortBy === "size_desc") {
      sorted.sort((a, b) => (b.sizeCache ?? 0) - (a.sizeCache ?? 0));
      return sorted;
    }
    if (listFilters.sortBy === "updated_asc") {
      sorted.sort((a, b) => {
        const da = new Date(a.lastComputedAt ?? a.updatedAt ?? a.createdAt).getTime();
        const db = new Date(b.lastComputedAt ?? b.updatedAt ?? b.createdAt).getTime();
        return da - db;
      });
      return sorted;
    }
    sorted.sort((a, b) => {
      const da = new Date(a.lastComputedAt ?? a.updatedAt ?? a.createdAt).getTime();
      const db = new Date(b.lastComputedAt ?? b.updatedAt ?? b.createdAt).getTime();
      return db - da;
    });
    return sorted;
  }, [listFilters, segments]);

  const activeListFilterCount = useMemo(() => countListFilters(listFilters), [listFilters]);

  const activeSavedView = useMemo(
    () => savedViews.find((view) => view.id === activeSavedViewId) ?? null,
    [activeSavedViewId, savedViews],
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className={DASHBOARD_LABEL}>CRM</p>
        <h1 className={DASHBOARD_TITLE}>Segmentos</h1>
        <p className={DASHBOARD_MUTED}>Define audiências com regras claras e previsíveis.</p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-[12px] text-emerald-100">{success}</div>
      ) : null}
      {data?.ok === false ? (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
          {data.error ?? data.message ?? "Não foi possível carregar segmentos."}
        </div>
      ) : null}

      <section className={cn(DASHBOARD_CARD, "space-y-4 p-4")}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-[12px] text-white/70">
            Nome do segmento
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="text-[12px] text-white/70">
            Descrição (opcional)
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-white/70">Lógica</span>
          <button
            type="button"
            className={cn(CTA_NEUTRAL, logic === "AND" ? "border-white/30 bg-white/12" : "")}
            onClick={() => setLogic("AND")}
          >
            AND
          </button>
          <button
            type="button"
            className={cn(CTA_NEUTRAL, logic === "OR" ? "border-white/30 bg-white/12" : "")}
            onClick={() => setLogic("OR")}
          >
            OR
          </button>
          <span className="text-[11px] text-white/55">{validRuleCount} regra(s) válidas</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={CTA_NEUTRAL}
            onClick={() => addPresetRule({ field: "lastActivityAt", op: "gte", value: "30d", windowDays: "" })}
          >
            + Ativos 30d
          </button>
          <button
            type="button"
            className={CTA_NEUTRAL}
            onClick={() => addPresetRule({ field: "marketingOptIn", op: "eq", value: "true", windowDays: "" })}
          >
            + Opt-in marketing
          </button>
          <button
            type="button"
            className={CTA_NEUTRAL}
            onClick={() => addPresetRule({ field: "totalSpentCents", op: "gte", value: "10000", windowDays: "" })}
          >
            + Gasto ≥ 100€
          </button>
        </div>

        <div className="space-y-3">
          {rules.map((rule) => {
            const ops = resolveOpOptions(rule.field);
            const valueHint = resolveValueHint(rule.field, rule.op);
            return (
              <div key={rule.id} className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 md:grid-cols-[1.2fr_1fr_1.2fr_0.6fr_auto]">
                <label className="text-[11px] text-white/70">
                  Campo
                  <select
                    className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-sm text-white outline-none focus:border-white/40"
                    value={rule.field}
                    onChange={(event) =>
                      handleRuleChange(rule.id, {
                        field: event.target.value,
                        op: resolveOpOptions(event.target.value)[0]?.value ?? "eq",
                        value: "",
                        windowDays: "",
                      })
                    }
                  >
                    <option value="">Selecionar</option>
                    {FIELD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-[11px] text-white/70">
                  Operador
                  <select
                    className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-sm text-white outline-none focus:border-white/40"
                    value={rule.op}
                    onChange={(event) => handleRuleChange(rule.id, { op: event.target.value, value: "" })}
                  >
                    {ops.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-[11px] text-white/70">
                  Valor
                  {rule.field === "marketingOptIn" ? (
                    <select
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={rule.value}
                      onChange={(event) => handleRuleChange(rule.id, { value: event.target.value })}
                    >
                      <option value="">Selecionar</option>
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </select>
                  ) : rule.field === "contactType" && rule.op === "eq" ? (
                    <select
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-sm text-white outline-none focus:border-white/40"
                      value={rule.value}
                      onChange={(event) => handleRuleChange(rule.id, { value: event.target.value })}
                    >
                      <option value="">Selecionar</option>
                      {CONTACT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-sm text-white outline-none focus:border-white/40"
                      placeholder={valueHint}
                      value={rule.value}
                      onChange={(event) => handleRuleChange(rule.id, { value: event.target.value })}
                    />
                  )}
                </label>

                <label className="text-[11px] text-white/70">
                  Janela (dias)
                  <input
                    type="number"
                    min={1}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-sm text-white outline-none focus:border-white/40"
                    placeholder="30"
                    value={rule.windowDays}
                    onChange={(event) => handleRuleChange(rule.id, { windowDays: event.target.value })}
                    disabled={rule.field !== "interactionType"}
                  />
                </label>

                <div className="flex items-end">
                  <button
                    type="button"
                    className={cn(CTA_NEUTRAL, "px-3 py-1")}
                    onClick={() => handleRemoveRule(rule.id)}
                    disabled={rules.length <= 1}
                  >
                    Remover
                  </button>
                </div>
              </div>
            );
          })}

          <button type="button" className={CTA_NEUTRAL} onClick={handleAddRule}>
            + Adicionar regra
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className={CTA_PRIMARY} onClick={handleCreateSegment} disabled={!canCreate}>
            {saving ? "A guardar..." : "Criar segmento"}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Segmentos guardados</h2>
          <span className="text-[11px] text-white/50">
            {filteredSegments.length} de {segments.length} segmentos
          </span>
        </div>

        <div className={cn(DASHBOARD_CARD, "space-y-3 p-4")}>
          <div className="flex flex-wrap items-center gap-2">
            {SEGMENT_SYSTEM_VIEWS.map((view) => (
              <button key={view.id} type="button" className={CTA_NEUTRAL} onClick={() => applySystemView(view.patch)}>
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

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <label className="text-[12px] text-white/70">
              Pesquisa
              <input
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={listFilters.query}
                onChange={(event) => {
                  setListFilters((prev) => ({ ...prev, query: event.target.value }));
                  setActiveSavedViewId(null);
                }}
                placeholder="Nome ou descrição"
              />
            </label>
            <label className="text-[12px] text-white/70">
              Status
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={listFilters.status}
                onChange={(event) => {
                  setListFilters((prev) => ({ ...prev, status: event.target.value as SegmentStatusFilter }));
                  setActiveSavedViewId(null);
                }}
              >
                <option value="all">Todos</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="DRAFT">DRAFT</option>
                <option value="PAUSED">PAUSED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </label>
            <label className="text-[12px] text-white/70">
              Tamanho mínimo
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={listFilters.minSize}
                onChange={(event) => {
                  setListFilters((prev) => ({ ...prev, minSize: event.target.value }));
                  setActiveSavedViewId(null);
                }}
                placeholder="Ex.: 50"
              />
            </label>
            <label className="text-[12px] text-white/70">
              Atualizado nos últimos (dias)
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={listFilters.updatedDays}
                onChange={(event) => {
                  setListFilters((prev) => ({ ...prev, updatedDays: event.target.value }));
                  setActiveSavedViewId(null);
                }}
                placeholder="Ex.: 7"
              />
            </label>
            <label className="text-[12px] text-white/70">
              Ordenação
              <select
                className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                value={listFilters.sortBy}
                onChange={(event) => {
                  setListFilters((prev) => ({ ...prev, sortBy: event.target.value as SegmentSortFilter }));
                  setActiveSavedViewId(null);
                }}
              >
                <option value="updated_desc">Atualizado (desc)</option>
                <option value="updated_asc">Atualizado (asc)</option>
                <option value="size_desc">Tamanho (desc)</option>
                <option value="name_asc">Nome (A-Z)</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={CTA_NEUTRAL}
              onClick={() => {
                setListFilters(createDefaultListFilters());
                setActiveSavedViewId(null);
              }}
            >
              Limpar filtros
            </button>
            <span className="text-[11px] text-white/55">
              {activeListFilterCount > 0 ? `${activeListFilterCount} filtros ativos` : "Sem filtros ativos"}
            </span>
          </div>
        </div>

        <div className="grid gap-3">
          {filteredSegments.map((segment) => (
            <Link
              key={segment.id}
              href={`/organizacao/crm/segmentos/${segment.id}`}
              className={cn(DASHBOARD_CARD, "p-4 transition hover:border-white/25")}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{segment.name}</p>
                  <p className="text-[12px] text-white/60">{segment.description || "Sem descrição"}</p>
                </div>
                <div className="text-right text-[12px] text-white/60">
                  <p>Tamanho: {segment.sizeCache ?? "—"}</p>
                  <p>Atualizado: {formatDate(segment.lastComputedAt)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/60">
                <span>Status: {segment.status}</span>
                <span>Criado: {formatDate(segment.createdAt)}</span>
              </div>
            </Link>
          ))}
          {!isLoading && filteredSegments.length === 0 ? (
            <div className={cn(DASHBOARD_CARD, "p-6 text-center text-[12px] text-white/60")}>
              Sem segmentos para este filtro.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
