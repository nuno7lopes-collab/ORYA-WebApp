"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CTA_SECONDARY } from "@/app/organizacao/dashboardUi";

type RefundItem = {
  id: number;
  eventId: number;
  eventTitle: string;
  purchaseId: string | null;
  paymentIntentId: string | null;
  baseAmountCents: number;
  feesExcludedCents: number;
  currency: string;
  reason: string;
  refundedAt: string | null;
  createdAt: string | null;
};

type RefundsResponse =
  | { ok: true; items: RefundItem[]; pagination: { nextCursor: number | null; hasMore: boolean } }
  | { ok: false; error?: string };

const REASON_FILTERS = [
  { key: "ALL", label: "Todos" },
  { key: "CANCELLED", label: "Cancelado" },
  { key: "DELETED", label: "Apagado" },
  { key: "DATE_CHANGED", label: "Mudança de data" },
];

const formatMoney = (cents: number, currency?: string | null) =>
  `${(cents / 100).toFixed(2)} ${currency || "EUR"}`;

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

const normalizeQueryDate = (value: string) => (value ? new Date(value).toISOString() : "");

export default function RefundsPanel() {
  const [reason, setReason] = useState("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState<RefundItem[]>([]);
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
      if (reason !== "ALL") params.set("reason", reason);
      if (search) params.set("q", search);
      if (from) params.set("from", normalizeQueryDate(from));
      if (to) params.set("to", normalizeQueryDate(to));
      if (cursor) params.set("cursor", String(cursor));
      return resolveCanonicalOrgApiPath(`/api/org/[orgId]/refunds/list?${params.toString()}`);
    },
    [reason, search, from, to],
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
        const data = (await res.json().catch(() => null)) as RefundsResponse | null;
        if (requestId !== requestIdRef.current) return;
        if (!res.ok || !data || data.ok === false) {
          throw new Error(data && "error" in data ? data.error : "Erro ao carregar reembolsos.");
        }
        const nextItems = data.items ?? [];
        setItems((prev) => (mode === "reset" ? nextItems : [...prev, ...nextItems]));
        setNextCursor(data.pagination?.nextCursor ?? null);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar reembolsos.");
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
  }, [reason, search, from, to, load]);

  const totalRefunded = useMemo(
    () => items.reduce((sum, item) => sum + (item.baseAmountCents ?? 0), 0),
    [items],
  );

  const downloadCsv = () => {
    if (!items.length) return;
    const rows = [
      ["ID", "Evento", "Compra", "Valor", "Moeda", "Motivo", "Reembolsado em"],
      ...items.map((item) => [
        item.id,
        item.eventTitle,
        item.purchaseId ?? "",
        (item.baseAmountCents / 100).toFixed(2),
        item.currency ?? "EUR",
        item.reason,
        item.refundedAt ?? "",
      ]),
    ];
    const csvContent = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "refunds.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/92 backdrop-blur-3xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-white">Reembolsos</h3>
          <p className="text-[12px] text-white/65">Histórico e motivos.</p>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={!items.length}
          className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px] disabled:opacity-50")}
        >
          Exportar CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {REASON_FILTERS.map((filter) => {
          const active = reason === filter.key;
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setReason(filter.key)}
              className={cn(
                "rounded-full border px-3 py-1 transition",
                active
                  ? "border-white/40 bg-white/15 text-white"
                  : "border-white/15 bg-black/30 text-white/60 hover:border-white/30",
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-3 text-[12px]">
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Pesquisar compra ou payment intent..."
          className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white placeholder:text-white/40"
        />
        <label className="flex flex-col gap-1 text-white/60">
          Desde
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-white/60">
          Até
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/70">
        Total listado: <span className="text-white">{formatMoney(totalRefunded, items[0]?.currency)}</span>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-100">
          {error}
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-[12px] text-white/70">
          A carregar reembolsos...
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-[12px] text-white/70">
          Sem reembolsos para o filtro atual.
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">{item.eventTitle}</p>
                <p className="text-[11px] text-white/60">
                  Compra {item.purchaseId ? `${item.purchaseId.slice(0, 6)}…` : "—"} · {item.reason}
                </p>
                <p className="text-[10px] text-white/45">Reembolso {formatDateTime(item.refundedAt || item.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-white/60">Valor</p>
                <p className="text-sm font-semibold text-white">{formatMoney(item.baseAmountCents, item.currency)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {nextCursor && (
        <button
          type="button"
          onClick={() => load(nextCursor, "append")}
          disabled={loading}
          className="w-full rounded-full border border-white/15 bg-white/5 px-3 py-2 text-[12px] text-white/80 hover:border-white/30 disabled:opacity-60"
        >
          {loading ? "A carregar..." : "Carregar mais"}
        </button>
      )}
    </section>
  );
}
