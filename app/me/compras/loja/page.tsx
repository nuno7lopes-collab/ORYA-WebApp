"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AssetItem = {
  id: number;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  maxDownloads: number | null;
};

type StoreOrderLine = {
  id: number;
  name: string;
  slug: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  requiresShipping: boolean;
  variantLabel: string | null;
  image: { url: string; altText: string } | null;
};

type StoreShipment = {
  id: number;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

type StoreOrderItem = {
  id: number;
  orderNumber: string | null;
  status: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  createdAt: string;
  store: {
    id: number;
    displayName: string;
    username: string | null;
    supportEmail: string | null;
    supportPhone: string | null;
  };
  shipping: {
    zoneName: string | null;
    methodName: string | null;
    etaMinDays: number | null;
    etaMaxDays: number | null;
    address: { formattedAddress: string | null } | null;
  };
  shipments: StoreShipment[];
  lines: StoreOrderLine[];
};

type GrantItem = {
  id: number;
  downloadsCount: number;
  expiresAt: string | null;
  createdAt: string;
  order: {
    id: number;
    orderNumber: string | null;
    createdAt: string;
  };
  store: {
    id: number;
    displayName: string;
    username: string | null;
  };
  product: {
    id: number;
    name: string;
    slug: string;
  };
  assets: AssetItem[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

const ORDER_STATUS_STYLES: Record<
  string,
  { bg: string; text: string; glow: string }
> = {
  ok: {
    bg: "from-emerald-500/20 via-emerald-400/18 to-teal-500/18 border-emerald-300/30",
    text: "text-emerald-50",
    glow: "shadow-[0_0_24px_rgba(16,185,129,0.25)]",
  },
  warn: {
    bg: "from-amber-400/20 via-amber-300/16 to-yellow-400/18 border-amber-200/30",
    text: "text-amber-50",
    glow: "shadow-[0_0_24px_rgba(251,191,36,0.22)]",
  },
  info: {
    bg: "from-sky-400/20 via-sky-300/14 to-blue-400/18 border-sky-200/30",
    text: "text-sky-50",
    glow: "shadow-[0_0_24px_rgba(56,189,248,0.22)]",
  },
  error: {
    bg: "from-rose-500/20 via-rose-400/14 to-orange-500/18 border-rose-200/30",
    text: "text-rose-50",
    glow: "shadow-[0_0_24px_rgba(244,63,94,0.22)]",
  },
};

function resolveOrderBadge(order: StoreOrderItem) {
  if (order.status === "CANCELLED") {
    return { label: "Cancelada", tone: "error" };
  }
  if (order.status === "REFUNDED") {
    return { label: "Reembolsada", tone: "info" };
  }
  if (order.status === "PARTIAL_REFUND") {
    return { label: "Reembolso parcial", tone: "info" };
  }
  if (order.status === "PENDING") {
    return { label: "Pagamento pendente", tone: "warn" };
  }

  const needsShipping = order.lines.some((line) => line.requiresShipping);
  const latestShipment = order.shipments[0];
  if (!needsShipping) {
    return { label: "Disponivel", tone: "ok" };
  }
  if (latestShipment?.status === "DELIVERED") {
    return { label: "Entregue", tone: "ok" };
  }
  if (latestShipment?.status === "SHIPPED") {
    return { label: "Enviado", tone: "ok" };
  }
  if (order.status === "FULFILLED") {
    return { label: "Concluida", tone: "ok" };
  }
  return { label: "Em preparacao", tone: "warn" };
}

export default function StoreDownloadsPage() {
  const [orders, setOrders] = useState<StoreOrderItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [receiptLoadingId, setReceiptLoadingId] = useState<number | null>(null);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<number | null>(null);

  const [items, setItems] = useState<GrantItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const loadOrders = async () => {
      setOrdersLoading(true);
      setOrdersError(null);
      try {
        const res = await fetch("/api/me/store/purchases", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Erro ao carregar compras da loja.");
        }
        setOrders(Array.isArray(json.items) ? json.items : []);
      } catch (err) {
        setOrdersError(err instanceof Error ? err.message : "Erro inesperado.");
      } finally {
        setOrdersLoading(false);
      }
    };
    void loadOrders();
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/store/digital/grants", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Erro ao carregar downloads.");
        }
        setItems(Array.isArray(json.grants) ? json.grants : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro inesperado.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handleReceipt = async (orderId: number) => {
    setReceiptLoadingId(orderId);
    setOrdersError(null);
    try {
      const res = await fetch(`/api/me/store/purchases/${orderId}/receipt`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !json?.url) {
        throw new Error(json?.error || "Recibo indisponivel.");
      }
      window.open(json.url as string, "_blank", "noopener");
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setReceiptLoadingId(null);
    }
  };

  const handleInvoice = async (orderId: number, orderLabel?: string | null) => {
    setInvoiceLoadingId(orderId);
    setOrdersError(null);
    try {
      const res = await fetch(`/api/me/store/purchases/${orderId}/invoice`, { cache: "no-store" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Fatura indisponivel.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fatura_${orderLabel ?? orderId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setOrdersError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setInvoiceLoadingId(null);
    }
  };

  const handleDownload = async (grantId: number, assetId: number) => {
    setDownloadingId(`${grantId}-${assetId}`);
    setError(null);
    try {
      const res = await fetch("/api/store/digital/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantId, assetId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !json?.url) {
        throw new Error(json?.error || "Erro ao preparar download.");
      }
      window.location.assign(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <div className="relative orya-page-width flex flex-col gap-6 px-4 pb-16 pt-10">
        <header className="flex flex-col gap-3 rounded-3xl border border-white/15 bg-white/5 px-5 py-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-7">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-white/55">Area pessoal</p>
            <h1 className="bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] bg-clip-text text-3xl font-bold leading-tight text-transparent">
              Compras da Loja
            </h1>
            <p className="text-sm text-white/70">
              Pedidos, estado de envio e downloads digitais num so lugar.
            </p>
          </div>
          <Link
            href="/me/compras"
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-semibold text-white/80 hover:border-white/40"
          >
            Voltar a compras
          </Link>
        </header>

        {ordersLoading && (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
            A carregar pedidos...
          </div>
        )}

        {ordersError && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {ordersError}
          </div>
        )}

        {!ordersLoading && orders.length === 0 ? (
          <div className="rounded-3xl border border-white/15 bg-white/5 px-6 py-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
            <p className="text-lg font-semibold text-white">Sem compras por agora.</p>
            <p className="mt-2 text-sm text-white/70">
              Quando comprares na loja, os pedidos vao aparecer aqui.
            </p>
          </div>
        ) : null}

        <div className="space-y-4">
          {orders.map((order) => {
            const storeLink = order.store.username ? `/${order.store.username}/loja` : null;
            const badge = resolveOrderBadge(order);
            const tone = ORDER_STATUS_STYLES[badge.tone] ?? ORDER_STATUS_STYLES.info;
            const previewLines = order.lines.slice(0, 3);
            const extraLines = Math.max(0, order.lines.length - previewLines.length);
            const needsShipping = order.lines.some((line) => line.requiresShipping);
            const shippingLabel = order.shipping.address?.formattedAddress
              ? order.shipping.address.formattedAddress
              : needsShipping
                ? "Envio pendente"
                : "Entrega digital";
            const etaLabel =
              order.shipping.etaMinDays && order.shipping.etaMaxDays
                ? `${order.shipping.etaMinDays}-${order.shipping.etaMaxDays} dias`
                : order.shipping.etaMinDays
                  ? `${order.shipping.etaMinDays} dias`
                  : null;
            const latestShipment = order.shipments[0];

            return (
              <div
                key={order.id}
                className="rounded-3xl border border-white/15 bg-[linear-gradient(140deg,rgba(255,255,255,0.12),rgba(2,6,16,0.88))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/80">
                        {order.store.displayName}
                      </span>
                      {storeLink ? (
                        <Link
                          href={storeLink}
                          className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/70 hover:border-white/40"
                        >
                          Ver loja
                        </Link>
                      ) : null}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold ${tone.text} ${tone.glow} bg-gradient-to-r ${tone.bg}`}
                      >
                        ● {badge.label}
                      </span>
                    </div>
                    <p className="text-sm text-white/70">
                      Encomenda {order.orderNumber ?? order.id} · {formatDate(order.createdAt)}
                    </p>
                    <p className="text-xs text-white/50">
                      {shippingLabel}
                      {order.shipping.methodName ? ` · ${order.shipping.methodName}` : ""}
                      {etaLabel ? ` · ${etaLabel}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{formatMoney(order.totalCents, order.currency)}</p>
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      <Link
                        href={`/me/compras/loja/${order.id}`}
                        className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/80 hover:border-white/40"
                      >
                        Ver pedido
                      </Link>
                      <button
                        type="button"
                        disabled={invoiceLoadingId === order.id}
                        onClick={() => handleInvoice(order.id, order.orderNumber)}
                        className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/80 hover:border-white/40 disabled:opacity-60"
                      >
                        {invoiceLoadingId === order.id ? "A preparar..." : "Fatura PDF"}
                      </button>
                      <button
                        type="button"
                        disabled={receiptLoadingId === order.id}
                        onClick={() => handleReceipt(order.id)}
                        className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/80 hover:border-white/40 disabled:opacity-60"
                      >
                        {receiptLoadingId === order.id ? "A preparar..." : "Ver recibo"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {previewLines.map((line) => (
                    <div
                      key={line.id}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/35 px-3 py-2"
                    >
                      <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                        {line.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={line.image.url}
                            alt={line.image.altText}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-white/40">
                            ORYA
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-white">{line.name}</p>
                        <p className="text-xs text-white/60">
                          {line.variantLabel ? `${line.variantLabel} · ` : ""}
                          {line.quantity}x · {formatMoney(line.totalCents, order.currency)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {extraLines > 0 ? (
                    <div className="flex items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/25 px-3 py-2 text-xs text-white/60">
                      +{extraLines} artigos
                    </div>
                  ) : null}
                </div>

                {latestShipment ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/70">
                    <span>
                      Envio{" "}
                      {latestShipment.status === "DELIVERED"
                        ? "entregue"
                        : latestShipment.status === "SHIPPED"
                          ? "enviado"
                          : "em preparacao"}{" "}
                      {latestShipment.carrier ? `· ${latestShipment.carrier}` : ""}
                    </span>
                    {latestShipment.trackingUrl ? (
                      <Link
                        href={latestShipment.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/80 hover:border-white/40"
                      >
                        Tracking
                      </Link>
                    ) : latestShipment.trackingNumber ? (
                      <span className="text-[11px] text-white/60">
                        Tracking {latestShipment.trackingNumber}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {(order.store.supportEmail || order.store.supportPhone) && (
                  <div className="mt-3 text-xs text-white/50">
                    {order.store.supportEmail ? `Suporte: ${order.store.supportEmail}` : ""}
                    {order.store.supportEmail && order.store.supportPhone ? " · " : ""}
                    {order.store.supportPhone ?? ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <p className="text-xs uppercase tracking-[0.24em] text-white/55">Downloads</p>
          <p className="text-lg font-semibold text-white">Produtos digitais</p>
          <p className="text-sm text-white/65">Ficheiros prontos a descarregar das tuas compras.</p>
        </section>

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
            A carregar downloads...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {!loading && items.length === 0 ? (
          <div className="rounded-3xl border border-white/15 bg-white/5 px-6 py-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
            <p className="text-lg font-semibold text-white">Sem downloads por agora.</p>
            <p className="mt-2 text-sm text-white/70">
              Quando comprares um produto digital, os ficheiros vao aparecer aqui.
            </p>
          </div>
        ) : null}

        <div className="space-y-4">
          {items.map((grant) => {
            const storeLink = grant.store.username ? `/${grant.store.username}/loja` : null;
            return (
              <div
                key={grant.id}
                className="rounded-3xl border border-white/15 bg-[linear-gradient(140deg,rgba(255,255,255,0.12),rgba(2,6,16,0.88))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/80">
                        {grant.store.displayName}
                      </span>
                      {storeLink ? (
                        <Link
                          href={storeLink}
                          className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/70 hover:border-white/40"
                        >
                          Ver loja
                        </Link>
                      ) : null}
                    </div>
                    <p className="text-sm text-white/70">
                      {grant.product.name} · {formatDate(grant.order.createdAt)}
                    </p>
                    <p className="text-xs text-white/50">Encomenda {grant.order.orderNumber ?? grant.order.id}</p>
                  </div>
                  <div className="text-xs text-white/60">Downloads usados: {grant.downloadsCount}</div>
                </div>

                {grant.assets.length === 0 ? (
                  <p className="mt-3 text-xs text-white/50">Sem ficheiros ativos.</p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {grant.assets.map((asset) => (
                      <div
                        key={asset.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/40 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm text-white">{asset.filename}</p>
                          <p className="text-xs text-white/60">
                            {formatSize(asset.sizeBytes)} · {asset.mimeType}
                            {asset.maxDownloads ? ` · Max ${asset.maxDownloads}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={downloadingId === `${grant.id}-${asset.id}`}
                          onClick={() => handleDownload(grant.id, asset.id)}
                          className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/80 hover:border-white/40 disabled:opacity-60"
                        >
                          {downloadingId === `${grant.id}-${asset.id}` ? "A preparar..." : "Download"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
