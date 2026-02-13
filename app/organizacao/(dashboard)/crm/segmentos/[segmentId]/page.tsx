"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/i18n";
import {
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
  DASHBOARD_TITLE,
  CTA_NEUTRAL,
} from "@/app/organizacao/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type SegmentDetailResponse = {
  ok: boolean;
  segment: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    rules: unknown;
    definition?: unknown;
    sizeCache: number | null;
    lastComputedAt: string | null;
  };
};

type SegmentPreviewResponse = {
  ok: boolean;
  total: number;
  segment: { id: string; name: string };
  items: Array<{
    id: string;
    userId: string | null;
    contactType: string;
    displayName: string | null;
    avatarUrl: string | null;
    lastActivityAt: string | null;
    totalSpentCents: number;
    tags: string[];
  }>;
  explain?: Array<{
    ruleId: string;
    field: string;
    op: string;
    matched: number;
  }>;
};

type RuleLine = {
  id: string;
  text: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDateTime(date);
}

function renderValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).join(", ");
  }
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (value === null || value === undefined) return "—";
  return String(value);
}

function normalizeRuleLines(definitionRaw: unknown): RuleLine[] {
  if (!definitionRaw || typeof definitionRaw !== "object") return [];
  const root = (definitionRaw as { root?: unknown }).root;
  if (!root || typeof root !== "object") return [];

  const lines: RuleLine[] = [];

  const visit = (node: unknown, parentLogic: "AND" | "OR") => {
    if (!node || typeof node !== "object") return;
    const data = node as Record<string, unknown>;
    const kind = typeof data.kind === "string" ? data.kind : null;

    if (kind === "group") {
      const logic = typeof data.logic === "string" && data.logic.toUpperCase() === "OR" ? "OR" : "AND";
      const children = Array.isArray(data.children) ? data.children : [];
      children.forEach((child) => visit(child, logic));
      return;
    }

    if (kind !== "rule") return;

    const id = typeof data.id === "string" && data.id.trim() ? data.id.trim() : `rule_${lines.length + 1}`;
    const field = typeof data.field === "string" ? data.field : "campo";
    const op = typeof data.op === "string" ? data.op : "eq";
    const value = renderValue(data.value);
    const windowDays = typeof data.windowDays === "number" && Number.isFinite(data.windowDays) ? data.windowDays : null;

    const text = `${parentLogic} · ${field} ${op} ${value}${windowDays ? ` · janela ${windowDays}d` : ""}`;
    lines.push({ id, text });
  };

  visit(root, "AND");
  return lines;
}

export default function CrmSegmentDetailPage() {
  const params = useParams();
  const segmentId = typeof params?.segmentId === "string" ? params.segmentId : "";

  const { data: detail, mutate: mutateDetail } = useSWR<SegmentDetailResponse>(
    segmentId ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/crm/segmentos/${segmentId}`) : null,
    fetcher,
  );
  const { data: preview, isLoading, mutate: mutatePreview } = useSWR<SegmentPreviewResponse>(
    segmentId ? resolveCanonicalOrgApiPath(`/api/org/[orgId]/crm/segmentos/${segmentId}/preview`) : null,
    fetcher,
  );

  const segment = detail?.segment ?? null;
  const ruleLines = useMemo(() => normalizeRuleLines(segment?.definition ?? segment?.rules), [segment?.definition, segment?.rules]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className={DASHBOARD_LABEL}>CRM</p>
        <h1 className={DASHBOARD_TITLE}>Segmento</h1>
        <p className={DASHBOARD_MUTED}>Regras legíveis, audiência e explicação de inclusão.</p>
      </header>

      <section className={cn(DASHBOARD_CARD, "space-y-3 p-4")}>
        {segment ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{segment.name}</p>
                <p className="text-[12px] text-white/60">{segment.description || "Sem descrição"}</p>
              </div>
              <div className="text-right text-[12px] text-white/60">
                <p>Status: {segment.status}</p>
                <p>Atualizado: {formatDate(segment.lastComputedAt)}</p>
              </div>
            </div>
            <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Regras</p>
              {ruleLines.length ? (
                <ul className="space-y-1 text-[12px] text-white/75">
                  {ruleLines.map((rule) => (
                    <li key={rule.id} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                      {rule.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-white/55">Sem regras definidas.</p>
              )}
            </div>
          </>
        ) : (
          <p className="text-[12px] text-white/60">A carregar segmento...</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Pré-visualização</h2>
          <button
            type="button"
            className={CTA_NEUTRAL}
            onClick={() => {
              mutateDetail();
              mutatePreview();
            }}
          >
            Recalcular
          </button>
        </div>
        <div className={cn(DASHBOARD_CARD, "space-y-3 p-4")}>
          <p className="text-[12px] text-white/60">
            {isLoading ? "A calcular..." : `${preview?.total ?? 0} clientes no segmento`}
          </p>

          {preview?.explain?.length ? (
            <div className="space-y-1 rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] text-white/70">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Explain</p>
              {preview.explain.map((item) => (
                <p key={item.ruleId}>
                  {item.field} {item.op} · {item.matched} match(es)
                </p>
              ))}
            </div>
          ) : null}

          <div className="grid gap-2">
            {preview?.items?.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[12px] font-semibold text-white">{item.displayName || "Cliente"}</p>
                <p className="text-[11px] text-white/50">Última atividade: {formatDate(item.lastActivityAt)}</p>
                {item.tags.length ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <span
                        key={`${item.id}-${tag}`}
                        className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-white/60"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {!isLoading && preview?.items?.length === 0 ? (
              <p className="text-[12px] text-white/50">Sem clientes no segmento.</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
