"use client";

import { useEffect, useState } from "react";

type PurchaseItem = {
  id: number;
  purchaseId: string | null;
  totalCents: number;
  currency: string;
  createdAt: string;
  badge: string;
  status: string;
  timeline: { id: number; status: string; createdAt: string; source: string; errorMessage?: string | null }[];
  lines: { id: number; eventTitle: string; eventSlug: string; ticketTypeName: string }[];
};

export default function PurchasesPage() {
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [includeFree, setIncludeFree] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (includeFree) params.set("includeFree", "true");
        if (statusFilter) params.set("status", statusFilter);
        const res = await fetch(`/api/me/purchases?${params.toString()}`);
        const json = await res.json();
        if (json?.items) setItems(json.items);
      } catch (err) {
        console.warn("Erro a carregar compras", err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [statusFilter, includeFree]);

  const statusOptions = ["PAID", "PROCESSING", "REFUNDED", "DISPUTED", "FAILED"];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Minhas Compras</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <label className="text-sm flex items-center gap-1">
            <input type="checkbox" checked={includeFree} onChange={(e) => setIncludeFree(e.target.checked)} />
            Incluir gratuitos
          </label>
          <div className="flex gap-1 items-center">
            <span className="text-sm text-gray-500">Status:</span>
            <select
              value={statusFilter ?? ""}
              onChange={(e) => setStatusFilter(e.target.value || null)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="">Todos</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {loading && <p className="text-sm text-gray-500">A carregar...</p>}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5">{item.badge}</span>
              <span className="text-xs rounded-full bg-blue-100 px-2 py-0.5">{item.status}</span>
              <span className="text-xs text-gray-500">
                {new Date(item.createdAt).toLocaleString()} · {item.totalCents / 100} {item.currency}
              </span>
              {item.purchaseId && <span className="text-xs text-gray-400">ID: {item.purchaseId}</span>}
            </div>
            <div className="space-y-1">
              {item.lines.map((l) => (
                <div key={l.id} className="text-sm">
                  {l.eventTitle} — {l.ticketTypeName}
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Timeline:</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {item.timeline.map((t) => (
                  <span key={t.id} className="px-2 py-0.5 rounded bg-gray-100">
                    {t.status} ({t.source}) {new Date(t.createdAt).toLocaleString()}
                  </span>
                ))}
              </div>
            </div>
          </li>
        ))}
        {!loading && !items.length && <p className="text-sm text-gray-500">Sem compras.</p>}
      </ul>
    </main>
  );
}
