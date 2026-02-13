"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/app/organizacao/dashboardUi";
import { cn } from "@/lib/utils";

type AttendeeItem = {
  entitlementId: string;
  status: string;
  holderKey: string;
  holder?: { name?: string | null; email?: string | null; type?: string | null };
  purchaseId?: string | null;
  ticketId?: string | null;
  checkedInAt?: string | null;
  refundedAt?: string | null;
  snapshot?: { title?: string | null; startAt?: string | null; timezone?: string | null };
};

type AttendeesResponse = {
  items?: AttendeeItem[];
  nextCursor?: string | null;
  error?: string;
};

const STATUS_FILTERS = [
  { key: "ACTIVE", label: "Ativos" },
  { key: "CHECKED_IN", label: "Check-in" },
  { key: "PENDING", label: "Pendentes" },
  { key: "REVOKED", label: "Revogados" },
  { key: "CHARGEBACK_LOST", label: "Chargeback" },
  { key: "EXPIRED", label: "Expirados" },
  { key: "SUSPENDED", label: "Suspensos" },
];

const STATUS_META: Record<string, { label: string; tone: string }> = {
  ACTIVE: {
    label: "Ativo",
    tone: "border-emerald-400/60 bg-emerald-500/10 text-emerald-100",
  },
  CHECKED_IN: {
    label: "Check-in",
    tone: "border-[#6BFFFF]/50 bg-[#6BFFFF]/10 text-[#E6FFFF]",
  },
  PENDING: {
    label: "Pendente",
    tone: "border-slate-400/50 bg-slate-500/10 text-slate-100",
  },
  REVOKED: {
    label: "Revogado",
    tone: "border-amber-400/50 bg-amber-500/10 text-amber-100",
  },
  CHARGEBACK_LOST: {
    label: "Chargeback",
    tone: "border-red-400/50 bg-red-500/10 text-red-100",
  },
  EXPIRED: {
    label: "Expirado",
    tone: "border-orange-400/50 bg-orange-500/10 text-orange-100",
  },
  SUSPENDED: {
    label: "Suspenso",
    tone: "border-red-400/50 bg-red-500/10 text-red-100",
  },
};

const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatPurchaseId = (value?: string | null) => {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
};

export default function EventAttendeesPanel({
  eventId,
  isPadelEvent = false,
}: {
  eventId: number;
  isPadelEvent?: boolean;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statuses, setStatuses] = useState<string[]>(["ACTIVE", "CHECKED_IN"]);
  const [items, setItems] = useState<AttendeeItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refundBusy, setRefundBusy] = useState<Record<string, boolean>>({});
  const requestIdRef = useRef(0);
  const loadingRef = useRef(false);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(handler);
  }, [searchInput]);

  const buildUrl = useCallback(
    (cursor: string | null) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statuses.length) params.set("status", statuses.join(","));
      if (cursor) params.set("cursor", cursor);
      params.set("pageSize", "50");
      return resolveCanonicalOrgApiPath(`/api/org/[orgId]/events/${eventId}/attendees?${params.toString()}`);
    },
    [eventId, search, statuses],
  );

  const load = useCallback(
    async (cursor: string | null, mode: "reset" | "append") => {
      if (loadingRef.current && mode === "append") return;
      const requestId = ++requestIdRef.current;
      setLoading(true);
      loadingRef.current = true;
      setError(null);
      try {
        const res = await fetch(buildUrl(cursor));
        const data = (await res.json().catch(() => null)) as AttendeesResponse | null;
        if (requestId !== requestIdRef.current) return;
        if (!res.ok) {
          throw new Error(data?.error || "Erro ao carregar participantes.");
        }
        const nextItems = Array.isArray(data?.items) ? data?.items : [];
        setItems((prev) => (mode === "reset" ? nextItems : [...prev, ...nextItems]));
        setNextCursor(data?.nextCursor ?? null);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar participantes.");
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
    if (!eventId) return;
    load(null, "reset");
  }, [eventId, search, statuses, load]);

  const toggleStatus = (key: string) => {
    setStatuses((prev) => {
      if (prev.includes(key)) return prev.filter((item) => item !== key);
      return [...prev, key];
    });
  };

  const handleRefund = async (purchaseId?: string | null, holderName?: string | null) => {
    if (!purchaseId) return;
    if (refundBusy[purchaseId]) return;
    const confirmed = window.confirm(
      `Reembolsar compra ${formatPurchaseId(purchaseId)}${holderName ? ` (${holderName})` : ""}?`,
    );
    if (!confirmed) return;
    setRefundBusy((prev) => ({ ...prev, [purchaseId]: true }));
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/events/${eventId}/refund`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId, reason: "CANCELLED" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Erro ao reembolsar.");
      }
      await load(null, "reset");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao reembolsar.");
    } finally {
      setRefundBusy((prev) => {
        const next = { ...prev };
        delete next[purchaseId];
        return next;
      });
    }
  };

  const hasMore = Boolean(nextCursor);
  const attendeeLabel = isPadelEvent ? "inscritos" : "participantes";

  return (
    <section className="rounded-2xl border border-white/12 bg-black/40 backdrop-blur-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white/90">Participantes</h2>
          <p className="text-[11px] text-white/65">
            Lista de {attendeeLabel} e estado de check-in.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <a href={`/organizacao/scan?eventId=${eventId}`} className={CTA_PRIMARY}>
            Abrir check-in
          </a>
          <button type="button" className={CTA_SECONDARY} onClick={() => load(null, "reset")}>
            Atualizar
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px]">
        {STATUS_FILTERS.map((item) => {
          const active = statuses.includes(item.key);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => toggleStatus(item.key)}
              className={cn(
                "rounded-full border px-3 py-1 transition",
                active
                  ? "border-white/40 bg-white/15 text-white"
                  : "border-white/15 bg-black/30 text-white/60 hover:border-white/30",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Pesquisar participante, email ou código..."
          className="flex-1 min-w-[220px] rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white placeholder:text-white/40"
        />
        <button
          type="button"
          onClick={() => setSearchInput("")}
          className="rounded-full border border-white/15 px-3 py-2 text-[11px] text-white/70"
        >
          Limpar
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-100">
          {error}
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-[12px] text-white/70">
          A carregar participantes...
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-[12px] text-white/70">
          Sem participantes para os filtros atuais.
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => {
            const holderName = item.holder?.name || item.holderKey;
            const holderEmail = item.holder?.email || null;
            const statusMeta = STATUS_META[item.status] ?? {
              label: item.status,
              tone: "border-white/20 bg-white/5 text-white/80",
            };
            const checkedInLabel = formatDateTime(item.checkedInAt);
            const refundedLabel = formatDateTime(item.refundedAt);
            const refundDisabled =
              !item.purchaseId ||
              item.status === "REFUNDED" ||
              item.status === "CHARGEBACK_LOST" ||
              Boolean(item.refundedAt);

            return (
              <div
                key={item.entitlementId}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">{holderName}</p>
                  {holderEmail && <p className="text-[11px] text-white/60">{holderEmail}</p>}
                  <p className="text-[10px] text-white/40">
                    Compra {formatPurchaseId(item.purchaseId)} • Entitlement {item.entitlementId.slice(0, 6)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                  <span className={cn("rounded-full border px-2 py-1 text-[10px]", statusMeta.tone)}>
                    {statusMeta.label}
                  </span>
                  {checkedInLabel && (
                    <span className="text-[10px] text-white/55">Check-in {checkedInLabel}</span>
                  )}
                  {refundedLabel && (
                    <span className="text-[10px] text-white/55">Reembolso {refundedLabel}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRefund(item.purchaseId, holderName)}
                    disabled={refundDisabled || Boolean(item.purchaseId && refundBusy[item.purchaseId])}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] transition",
                      refundDisabled
                        ? "border-white/10 text-white/30"
                        : "border-rose-400/40 bg-rose-500/10 text-rose-100 hover:border-rose-300/70",
                    )}
                  >
                    {item.purchaseId && refundBusy[item.purchaseId] ? "A reembolsar..." : "Reembolsar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
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
