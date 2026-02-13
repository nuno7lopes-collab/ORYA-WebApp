"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";

type FollowRequestItem = {
  id: number;
  requesterId: string;
  createdAt: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
};

type RequestAction = "accept" | "decline";

function buildLabel(item: FollowRequestItem) {
  return item.fullName?.trim() || item.username?.trim() || "Utilizador ORYA";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrgProfileRequestsClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<FollowRequestItem[]>([]);
  const [pendingById, setPendingById] = useState<Record<number, boolean>>({});
  const [query, setQuery] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/social/follow-requests", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !Array.isArray(json.items)) {
        throw new Error(json?.error || "Nao foi possivel carregar pedidos.");
      }
      setItems(json.items as FollowRequestItem[]);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const filteredItems = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return items;
    return items.filter((item) => {
      const label = buildLabel(item).toLowerCase();
      const username = item.username?.toLowerCase() ?? "";
      return label.includes(trimmed) || username.includes(trimmed);
    });
  }, [items, query]);

  const handleAction = useCallback(async (requestId: number, action: RequestAction) => {
    setPendingById((prev) => ({ ...prev, [requestId]: true }));
    setError(null);
    try {
      const res = await fetch(`/api/social/follow-requests/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Nao foi possivel atualizar o pedido.");
      }
      setItems((prev) => prev.filter((item) => item.id !== requestId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setPendingById((prev) => ({ ...prev, [requestId]: false }));
    }
  }, []);

  return (
    <div className="space-y-5 text-white">
      <section className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Profile Tool</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Requests</h1>
            <p className="mt-1 text-sm text-white/65">
              Pedidos pendentes para seguir a tua conta, com decisao imediata.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadRequests()}
            disabled={loading}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15 disabled:opacity-60"
          >
            {loading ? "A atualizar..." : "Atualizar"}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-white/70">
            {loading ? "A carregar pedidos..." : `${items.length} pedidos pendentes`}
          </p>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar pedido..."
            className="w-full rounded-full border border-white/20 bg-black/25 px-4 py-2 text-sm text-white outline-none transition focus:border-[#6BFFFF] sm:w-72"
          />
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {!loading && !error && filteredItems.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-white/12 bg-black/20 px-4 py-6 text-center text-sm text-white/65">
            Sem pedidos pendentes.
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {filteredItems.map((item) => {
            const label = buildLabel(item);
            const pending = pendingById[item.id] === true;
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/5 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    src={item.avatarUrl}
                    name={label}
                    className="h-11 w-11 border border-white/12"
                    textClassName="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80"
                    fallbackText="OR"
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="text-[12px] text-white/60">
                      {item.username ? `@${item.username}` : "Sem username"} · {formatDate(item.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void handleAction(item.id, "decline")}
                    className="rounded-full border border-white/25 bg-transparent px-4 py-2 text-[12px] font-semibold text-white/85 transition hover:bg-white/10 disabled:opacity-60"
                  >
                    Recusar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void handleAction(item.id, "accept")}
                    className="rounded-full border border-[#3797F0] bg-[#3797F0] px-4 py-2 text-[12px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                  >
                    Aceitar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
