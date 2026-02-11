"use client";

import { useMemo, useState } from "react";
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
  items: SegmentRow[];
};

type RuleDraft = {
  id: string;
  field: string;
  op: string;
  value: string;
  windowDays: string;
};

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

export default function CrmSegmentosPage() {
  const { data, isLoading, mutate } = useSWR<SegmentListResponse>(
    "/api/organizacao/crm/segmentos",
    fetcher,
  );
  const segments = data?.items ?? [];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logic, setLogic] = useState<"AND" | "OR">("AND");
  const [rules, setRules] = useState<RuleDraft[]>([
    { id: "rule-1", field: "", op: "gte", value: "", windowDays: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          value = rawValue.split(",").map((v) => v.trim()).filter(Boolean);
        }
        if (field === "interactionType") {
          value = rawValue
            .split(",")
            .map((v) => v.trim().toUpperCase())
            .filter(Boolean);
        }
        if (field === "contactType") {
          value = rawValue
            .split(",")
            .map((v) => v.trim().toUpperCase())
            .filter(Boolean);
        }
        if (field === "sourceType") {
          value = rawValue
            .split(",")
            .map((v) => v.trim())
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

  const handleAddRule = () => {
    setRules((prev) => [
      ...prev,
      { id: `rule-${prev.length + 1}`, field: "", op: "gte", value: "", windowDays: "" },
    ]);
  };

  const handleRemoveRule = (id: string) => {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
  };

  const handleRuleChange = (id: string, patch: Partial<RuleDraft>) => {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  const handleCreateSegment = async () => {
    if (name.trim().length < 2) {
      setError("Nome inválido.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        rules: { logic, rules: normalizedRules },
      };
      const res = await fetch("/api/organizacao/crm/segmentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Falha ao criar segmento");
      setName("");
      setDescription("");
      setLogic("AND");
      setRules([{ id: "rule-1", field: "", op: "gte", value: "", windowDays: "" }]);
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar segmento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className={DASHBOARD_LABEL}>CRM</p>
        <h1 className={DASHBOARD_TITLE}>Segmentos</h1>
        <p className={DASHBOARD_MUTED}>Segmentação simples por recência, frequência, gasto e interações.</p>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
          {error}
        </div>
      ) : null}

      <section className={cn(DASHBOARD_CARD, "p-4 space-y-4")}
      >
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
            Descrição
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-white/70">
          <span>Lógica</span>
          <select
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            value={logic}
            onChange={(event) => setLogic(event.target.value as "AND" | "OR")}
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
        </div>

        <div className="space-y-3">
          {rules.map((rule, index) => {
            const ops = resolveOpOptions(rule.field);
            return (
              <div key={rule.id} className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 md:grid-cols-[1.2fr_1fr_1.2fr_0.6fr_auto]">
                <label className="text-[11px] text-white/70">
                  Campo
                  <select
                    className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-sm text-white outline-none focus:border-white/40"
                    value={rule.field}
                    onChange={(event) =>
                      handleRuleChange(rule.id, { field: event.target.value, op: resolveOpOptions(event.target.value)[0]?.value ?? "eq" })
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
                    onChange={(event) => handleRuleChange(rule.id, { op: event.target.value })}
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
                  <input
                    className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-sm text-white outline-none focus:border-white/40"
                    placeholder={rule.field === "interactionType" ? INTERACTION_TYPES.join(", ") : "ex.: 30d, VIP"}
                    value={rule.value}
                    onChange={(event) => handleRuleChange(rule.id, { value: event.target.value })}
                  />
                </label>
                <label className="text-[11px] text-white/70">
                  Janela (dias)
                  <input
                    className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-sm text-white outline-none focus:border-white/40"
                    placeholder="ex.: 30"
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
          <button type="button" className={CTA_PRIMARY} onClick={handleCreateSegment} disabled={saving}>
            {saving ? "A guardar..." : "Criar segmento"}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Segmentos guardados</h2>
          <span className="text-[11px] text-white/50">{segments.length} segmentos</span>
        </div>
        <div className="grid gap-3">
          {segments.map((segment) => (
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
          {!isLoading && segments.length === 0 ? (
            <div className={cn(DASHBOARD_CARD, "p-6 text-center text-[12px] text-white/60")}>Sem segmentos criados.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
