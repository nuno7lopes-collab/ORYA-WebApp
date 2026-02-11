"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ChannelRequestItem = {
  id: string;
  title: string;
  createdAt: string;
  requester: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
  } | null;
};

type ChannelRequestsResponse =
  | { ok: true; items: ChannelRequestItem[] }
  | { ok: false; error?: string };

function requesterLabel(item: ChannelRequestItem) {
  if (!item.requester) return "Utilizador";
  if (item.requester.fullName) return item.requester.fullName;
  if (item.requester.username) return `@${item.requester.username}`;
  return "Utilizador";
}

export default function ChannelRequestsPanel() {
  const [items, setItems] = useState<ChannelRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/channel-requests?limit=20", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ChannelRequestsResponse | null;
      if (res.status === 403) {
        setForbidden(true);
        setItems([]);
        return;
      }
      if (!res.ok || !json || !json.ok) {
        setError((json && "error" in json ? json.error : null) || "Não foi possível carregar pedidos.");
        return;
      }
      setItems(json.items ?? []);
    } catch (err) {
      console.error("[chat/channel-requests] load failed:", err);
      setError("Erro inesperado ao carregar pedidos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDecision = useCallback(
    async (requestId: string, action: "approve" | "reject") => {
      setPendingId(requestId);
      setError(null);
      try {
        const res = await fetch(`/api/chat/channel-requests/${requestId}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Falha ao processar pedido.");
        }
        setItems((prev) => prev.filter((entry) => entry.id !== requestId));
      } catch (err) {
        console.error("[chat/channel-requests] decision failed:", err);
        setError(err instanceof Error ? err.message : "Erro inesperado.");
      } finally {
        setPendingId(null);
      }
    },
    [],
  );

  const hasItems = items.length > 0;
  const subtitle = useMemo(() => {
    if (loading) return "A carregar pedidos pendentes...";
    if (hasItems) return `${items.length} pedido${items.length > 1 ? "s" : ""} pendente${items.length > 1 ? "s" : ""}.`;
    return "Sem pedidos pendentes.";
  }, [hasItems, items.length, loading]);

  if (forbidden) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[rgba(6,10,20,0.75)] px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Chat</p>
          <h2 className="text-sm font-semibold text-white">Pedidos de canais</h2>
          <p className="text-[11px] text-white/60">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70 hover:bg-white/10"
        >
          Atualizar
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/65">
          A carregar...
        </div>
      ) : null}

      {!loading && !hasItems ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/60">
          Nenhum pedido em espera.
        </div>
      ) : null}

      {!loading && hasItems ? (
        <div className="mt-3 grid gap-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-white">{item.title}</p>
                  <p className="text-[10px] text-white/60">
                    {requesterLabel(item)} · {new Date(item.createdAt).toLocaleString("pt-PT")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pendingId === item.id}
                    onClick={() => void handleDecision(item.id, "approve")}
                    className="rounded-full border border-emerald-300/40 px-2.5 py-1 text-[10px] text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-50"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    disabled={pendingId === item.id}
                    onClick={() => void handleDecision(item.id, "reject")}
                    className="rounded-full border border-red-400/40 px-2.5 py-1 text-[10px] text-red-100 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Rejeitar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
