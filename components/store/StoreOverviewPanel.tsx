"use client";

import { useEffect, useMemo, useState } from "react";

type OverviewProduct = {
  id: number;
  name: string;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  slug: string;
};

type OverviewOrder = {
  id: number;
  orderNumber: string | null;
  status: string;
  totalCents: number;
  currency: string;
  customerName: string | null;
  customerEmail?: string | null;
  createdAt: string;
};

type OverviewSummary = {
  totalCents: number;
  totalOrders: number;
  avgOrderCents: number;
  currency: string;
};

type StoreOverviewPanelProps = {
  endpoint: string;
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
  });
}

export default function StoreOverviewPanel({ endpoint }: StoreOverviewPanelProps) {
  const [products, setProducts] = useState<OverviewProduct[]>([]);
  const [orders, setOrders] = useState<OverviewOrder[]>([]);
  const [summary, setSummary] = useState<OverviewSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summaryCurrency = summary?.currency || products[0]?.currency || orders[0]?.currency || "EUR";

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar resumo.");
      }
      setProducts(Array.isArray(json.products) ? json.products : []);
      setOrders(Array.isArray(json.orders) ? json.orders : []);
      setSummary(json.summary ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [endpoint]);

  const summaryBlocks = useMemo(() => {
    const totalOrders = summary?.totalOrders ?? 0;
    const totalCents = summary?.totalCents ?? 0;
    const avgOrderCents = summary?.avgOrderCents ?? 0;
    return [
      { label: "Vendas (30 dias)", value: formatMoney(totalCents, summaryCurrency) },
      { label: "Encomendas", value: String(totalOrders) },
      { label: "Ticket medio", value: formatMoney(avgOrderCents, summaryCurrency) },
    ];
  }, [summary, summaryCurrency]);

  return (
    <section className="mt-6 space-y-4">
      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          A carregar resumo...
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-3xl border border-white/12 bg-black/30 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/50">Produtos ativos</p>
                <h3 className="text-base font-semibold text-white">Carrossel rapido</h3>
              </div>
            </div>
            {products.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-white/70">
                Sem produtos ativos ainda. Usa o botao "Criar produto" no topo para começar.
              </div>
            ) : (
              <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="min-w-[180px] rounded-2xl border border-white/10 bg-black/40 p-3"
                  >
                    <div className="h-28 w-full overflow-hidden rounded-xl border border-white/10 bg-black/60">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
                          Sem imagem
                        </div>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold text-white">{product.name}</p>
                    <p className="text-xs text-white/60">{formatMoney(product.priceCents, product.currency)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/12 bg-black/30 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
            <p className="text-xs uppercase tracking-[0.24em] text-white/50">Resumo financeiro</p>
            <h3 className="text-base font-semibold text-white">Ultimos 30 dias</h3>
            <div className="mt-3 grid gap-2">
              {summaryBlocks.map((block) => (
                <div key={block.label} className="rounded-2xl border border-white/10 bg-black/40 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">{block.label}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{block.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 rounded-3xl border border-white/12 bg-black/30 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/50">Ultimas encomendas</p>
                <h3 className="text-base font-semibold text-white">Entradas recentes</h3>
              </div>
            </div>
            {orders.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-white/70">
                Ainda nao ha encomendas.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white/80"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {order.customerName || order.customerEmail || "Cliente"}
                      </p>
                      <p className="text-xs text-white/50">
                        {order.orderNumber ? `#${order.orderNumber}` : `Encomenda ${order.id}`} •{" "}
                        {formatDate(order.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">
                        {formatMoney(order.totalCents, order.currency)}
                      </p>
                      <p className="text-xs text-white/50">{order.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
