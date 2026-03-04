"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CTA_SECONDARY_CLEAN } from "@/app/org/_internal/core/dashboardUi";

type PayoutItem = {
  id: number;
  sourceType: string;
  sourceId: string;
  paymentIntentId: string;
  amountCents: number;
  grossAmountCents: number;
  platformFeeCents: number;
  currency: string;
  status: string;
  holdUntil: string | null;
  blockedReason: string | null;
  nextAttemptAt: string | null;
  releasedAt: string | null;
  transferId: string | null;
  createdAt: string;
  source?: { title: string | null; href: string | null } | null;
};

type PayoutsResponse =
  | { ok: true; items: PayoutItem[]; pagination: { nextCursor: number | null; hasMore: boolean } }
  | { ok: false; error?: string };

const STATUS_FILTERS = [
  { key: "ALL", label: "Todos" },
  { key: "HELD", label: "Em espera" },
  { key: "RELEASING", label: "A libertar" },
  { key: "BLOCKED", label: "Bloqueado" },
  { key: "ACTION_REQUIRED", label: "Ação necessária" },
  { key: "RELEASED", label: "Libertado" },
];

const STATUS_META: Record<string, { label: string; tone: string }> = {
  HELD: { label: "Em espera", tone: "border-amber-300/60 bg-amber-500/10 text-amber-100" },
  RELEASING: { label: "A libertar", tone: "border-sky-300/60 bg-sky-500/10 text-sky-100" },
  BLOCKED: { label: "Bloqueado", tone: "border-rose-300/60 bg-rose-500/10 text-rose-100" },
  RELEASED: { label: "Libertado", tone: "border-emerald-300/60 bg-emerald-500/10 text-emerald-100" },
  CANCELLED: { label: "Cancelado", tone: "border-white/20 bg-white/5 text-white/70" },
};

const formatMoney = (cents: number, currency?: string | null) => {
  try {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: (currency || "EUR").toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    const numeric = new Intl.NumberFormat("pt-PT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
    return `${numeric} ${(currency || "EUR").toUpperCase()}`;
  }
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

export default function PayoutsPanel() {
  const [status, setStatus] = useState("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<PayoutItem[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(handler);
  }, [searchInput]);

  const buildUrl = useCallback(
    (cursor: number | null) => {
      const params = new URLSearchParams();
      params.set("status", status);
      if (search) params.set("q", search);
      if (cursor) params.set("cursor", String(cursor));
      return resolveCanonicalOrgApiPath(`/api/org/[orgId]/finance/payouts/list?${params.toString()}`);
    },
    [status, search],
  );

  const load = useCallback(
    async (cursor: number | null, mode: "reset" | "append") => {
      if (loadingRef.current && mode === "append") return;
      const requestId = ++requestIdRef.current;
      setLoading(true);
      loadingRef.current = true;
      setError(null);
      try {
        const res = await fetch(buildUrl(cursor));
        const data = (await res.json().catch(() => null)) as PayoutsResponse | null;
        if (requestId !== requestIdRef.current) return;
        if (!res.ok || !data || data.ok === false) {
          throw new Error(data && "error" in data ? data.error : "Erro ao carregar transferências.");
        }
        const nextItems = data.items ?? [];
        setItems((prev) => (mode === "reset" ? nextItems : [...prev, ...nextItems]));
        setNextCursor(data.pagination?.nextCursor ?? null);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar transferências.");
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          loadingRef.current = false;
        }
      }
    },
    [buildUrl],
  );

  useEffect(() => {
    load(null, "reset");
  }, [status, search, load]);

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + (item.amountCents ?? 0), 0),
    [items],
  );

  const downloadCsv = () => {
    if (!items.length) return;
    const rows = [
      ["ID", "Estado", "Fonte", "Valor", "Moeda", "Em espera até", "Motivo", "Criado em"],
      ...items.map((item) => [
        item.id,
        item.status,
        item.source?.title ?? item.sourceType,
        (item.amountCents / 100).toFixed(2),
        item.currency ?? "EUR",
        item.holdUntil ?? "",
        item.blockedReason ?? "",
        item.createdAt ?? "",
      ]),
    ];
    const csvContent = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "transferencias.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="org-clean-section space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={downloadCsv}
            disabled={!items.length}
            className={cn(CTA_SECONDARY_CLEAN, "px-3 py-1 text-[12px] disabled:opacity-50")}
          >
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {STATUS_FILTERS.map((filter) => {
          const active = status === filter.key;
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setStatus(filter.key)}
              className={cn(
                "rounded-full border px-3 py-1 transition",
                active
                  ? "border-white/40 bg-white/12 text-white"
                  : "border-white/18 bg-white/[0.03] text-white/72 hover:border-white/30",
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Pesquisar por intenção de pagamento, motivo ou origem..."
          className="org-clean-input min-w-[220px] flex-1 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => setSearchInput("")}
          className={`${CTA_SECONDARY_CLEAN} px-3 py-2 text-[12px]`}
        >
          Limpar
        </button>
      </div>

      <div className="rounded-2xl border border-white/14 bg-white/[0.03] p-3 text-[13px] text-white/82">
        Total apresentado: <span className="text-white">{formatMoney(totalAmount, items[0]?.currency)}</span>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-400/45 bg-red-500/12 px-3 py-2 text-[13px] text-red-100">
          {error}
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="rounded-2xl border border-white/14 bg-white/[0.03] px-4 py-4 text-[13px] text-white/80">
          A carregar transferências...
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="rounded-2xl border border-white/14 bg-white/[0.03] px-4 py-4 text-[13px] text-white/80">
          Sem transferências para o filtro atual.
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => {
            const statusMeta = STATUS_META[item.status] ?? {
              label: item.status,
              tone: "border-white/20 bg-white/5 text-white/70",
            };
            return (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl border border-white/14 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">
                    {item.source?.title ?? item.sourceType}
                  </p>
                  <p className="text-[12px] text-white/74">
                    {item.sourceType} · {item.sourceId}
                  </p>
                  <p className="text-[11px] text-white/64">
                    PI {item.paymentIntentId.slice(0, 10)}… · Criado {formatDateTime(item.createdAt)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/80">
                  <span className={cn("rounded-full border px-2 py-1 text-[11px]", statusMeta.tone)}>
                    {statusMeta.label}
                  </span>
                  {item.holdUntil && <span className="text-[11px]">Em espera até {formatDateTime(item.holdUntil)}</span>}
                  {item.nextAttemptAt && <span className="text-[11px]">Próx. tentativa {formatDateTime(item.nextAttemptAt)}</span>}
                  {item.releasedAt && <span className="text-[11px]">Libertado {formatDateTime(item.releasedAt)}</span>}
                </div>

                <div className="flex flex-col items-end gap-1 text-right">
                  <span className="text-[12px] text-white/74">A receber</span>
                  <span className="text-sm font-semibold text-white">{formatMoney(item.amountCents, item.currency)}</span>
                  {item.source?.href && (
                    <Link href={item.source.href} className="text-[11px] text-[#22D3EE] hover:underline">
                      Ver origem
                    </Link>
                  )}
                  {item.blockedReason && (
                    <span className="text-[11px] text-rose-200">{item.blockedReason}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {nextCursor && (
        <button
          type="button"
          onClick={() => load(nextCursor, "append")}
          disabled={loading}
          className={`${CTA_SECONDARY_CLEAN} w-full px-3 py-2 text-[13px] disabled:opacity-60`}
        >
          {loading ? "A carregar..." : "Carregar mais"}
        </button>
      )}
    </section>
  );
}
