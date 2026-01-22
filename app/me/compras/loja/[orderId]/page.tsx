"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";

type OrderLine = {
  id: number;
  name: string;
  slug: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  requiresShipping: boolean;
  variantLabel: string | null;
  personalization: Array<{ optionId: number; label: string; value: string }>;
  image: { url: string; altText: string } | null;
};

type Shipment = {
  id: number;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type OrderDetail = {
  id: number;
  orderNumber: string | null;
  status: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  store: {
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
    address: {
      fullName: string;
      line1: string;
      line2: string | null;
      city: string;
      region: string | null;
      postalCode: string;
      country: string;
      nif: string | null;
    } | null;
  };
  billing: {
    fullName: string;
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postalCode: string;
    country: string;
    nif: string | null;
  } | null;
  shipments: Shipment[];
  timeline: Array<{ key: string; label: string; date: string }>;
  lines: OrderLine[];
};

function formatShipmentLabel(status: string) {
  if (status === "DELIVERED") return "entregue";
  if (status === "SHIPPED") return "enviado";
  return "em preparacao";
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "from-amber-400/20 via-amber-300/16 to-yellow-400/18 border-amber-200/30 text-amber-50",
  PAID: "from-emerald-500/20 via-emerald-400/18 to-teal-500/18 border-emerald-300/30 text-emerald-50",
  FULFILLED: "from-emerald-500/20 via-emerald-400/18 to-teal-500/18 border-emerald-300/30 text-emerald-50",
  REFUNDED: "from-sky-400/20 via-sky-300/14 to-blue-400/18 border-sky-200/30 text-sky-50",
  PARTIAL_REFUND: "from-sky-400/20 via-sky-300/14 to-blue-400/18 border-sky-200/30 text-sky-50",
  CANCELLED: "from-rose-500/20 via-rose-400/14 to-orange-500/18 border-rose-200/30 text-rose-50",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pagamento pendente",
  PAID: "Pago",
  FULFILLED: "Concluida",
  REFUNDED: "Reembolsada",
  PARTIAL_REFUND: "Reembolso parcial",
  CANCELLED: "Cancelada",
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StoreOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const resolvedParams = use(params);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/me/store/purchases/${resolvedParams.orderId}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Erro ao carregar encomenda.");
        }
        setOrder(json.order as OrderDetail);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro inesperado.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [resolvedParams.orderId]);

  const handleReceipt = async () => {
    if (!order) return;
    setReceiptLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/me/store/purchases/${order.id}/receipt`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !json?.url) {
        throw new Error(json?.error || "Recibo indisponivel.");
      }
      window.open(json.url as string, "_blank", "noopener");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleInvoice = async () => {
    if (!order) return;
    setInvoiceLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/me/store/purchases/${order.id}/invoice`, { cache: "no-store" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Fatura indisponivel.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fatura_${order.orderNumber ?? order.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setInvoiceLoading(false);
    }
  };

  const storeLink = useMemo(() => {
    if (!order?.store.username) return null;
    return `/${order.store.username}/loja`;
  }, [order?.store.username]);

  if (loading) {
    return (
      <main className="min-h-screen w-full text-white">
        <div className="orya-page-width px-4 pb-16 pt-10">
          <div className="rounded-3xl border border-white/12 bg-white/5 px-6 py-6 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            A carregar encomenda...
          </div>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen w-full text-white">
        <div className="orya-page-width px-4 pb-16 pt-10 space-y-4">
          <Link
            href="/me/compras/loja"
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs text-white/80 hover:border-white/40"
          >
            Voltar a compras
          </Link>
          <div className="rounded-3xl border border-white/12 bg-white/5 px-6 py-6 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
            {error ?? "Encomenda nao encontrada."}
          </div>
        </div>
      </main>
    );
  }

  const statusStyle = STATUS_STYLE[order.status] ?? STATUS_STYLE.PAID;
  const statusLabel = STATUS_LABEL[order.status] ?? order.status;
  const shippingAddress = order.shipping.address;
  const etaLabel =
    order.shipping.etaMinDays && order.shipping.etaMaxDays
      ? `${order.shipping.etaMinDays}-${order.shipping.etaMaxDays} dias`
      : order.shipping.etaMinDays
        ? `${order.shipping.etaMinDays} dias`
        : null;

  return (
    <main className="min-h-screen w-full text-white">
      <div className="orya-page-width px-4 pb-16 pt-10 space-y-6">
        <header className="rounded-3xl border border-white/15 bg-white/5 px-5 py-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.24em] text-white/55">Compras da loja</p>
              <h1 className="text-2xl font-semibold text-white">
                Encomenda {order.orderNumber ?? order.id}
              </h1>
              <p className="text-sm text-white/70">
                {order.store.displayName} · {formatDate(order.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle}`}
              >
                ● {statusLabel}
              </span>
              {storeLink ? (
                <Link
                  href={storeLink}
                  className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs text-white/80 hover:border-white/40"
                >
                  Ver loja
                </Link>
              ) : null}
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Resumo</p>
                  <p className="text-lg font-semibold text-white">Artigos comprados</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/70">Total</p>
                  <p className="text-lg font-semibold text-white">
                    {formatMoney(order.totalCents, order.currency)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {order.lines.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/35 px-3 py-2"
                  >
                    <div className="relative h-14 w-14 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                      {line.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={line.image.url} alt={line.image.altText} className="h-full w-full object-cover" />
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
                      {line.personalization.length > 0 ? (
                        <p className="text-[11px] text-white/45">
                          {line.personalization.map((entry) => `${entry.label}: ${entry.value}`).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Estado</p>
              <p className="text-lg font-semibold text-white">Linha temporal</p>
              <div className="mt-4 space-y-3">
                {order.timeline.map((entry) => (
                  <div key={entry.key} className="flex items-center gap-3 text-sm text-white/80">
                    <span className="h-2 w-2 rounded-full bg-white/60" />
                    <span className="flex-1">{entry.label}</span>
                    <span className="text-xs text-white/50">{formatDate(entry.date)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-white/50">
                O envio e a entrega sao atualizados manualmente pela loja.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Envio</p>
              <p className="text-lg font-semibold text-white">Detalhes de entrega</p>
              <div className="mt-3 text-sm text-white/70 space-y-1">
                <p>
                  Metodo: {order.shipping.methodName ?? "Digital"}{" "}
                  {etaLabel ? `· ${etaLabel}` : ""}
                </p>
                <p>Zona: {order.shipping.zoneName ?? "—"}</p>
                {shippingAddress ? (
                  <>
                    <p>{shippingAddress.fullName}</p>
                    <p>{shippingAddress.line1}</p>
                    {shippingAddress.line2 ? <p>{shippingAddress.line2}</p> : null}
                    <p>
                      {shippingAddress.postalCode} {shippingAddress.city}
                      {shippingAddress.region ? `, ${shippingAddress.region}` : ""}
                    </p>
                    <p>{shippingAddress.country}</p>
                  </>
                ) : (
                  <p>Sem morada de envio.</p>
                )}
              </div>
                {order.shipments.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/70">
                    <p>
                      Envio {formatShipmentLabel(order.shipments[0].status)}{" "}
                      {order.shipments[0].carrier ? `· ${order.shipments[0].carrier}` : ""}
                    </p>
                  {order.shipments[0].trackingUrl ? (
                    <Link
                      href={order.shipments[0].trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/80 hover:border-white/40"
                    >
                      Tracking
                    </Link>
                  ) : order.shipments[0].trackingNumber ? (
                    <p className="mt-2 text-[11px] text-white/60">
                      Tracking {order.shipments[0].trackingNumber}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Documentos</p>
              <p className="text-lg font-semibold text-white">Recibos e fatura</p>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleInvoice}
                  disabled={invoiceLoading}
                  className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/80 hover:border-white/40 disabled:opacity-60"
                >
                  {invoiceLoading ? "A preparar..." : "Descarregar fatura PDF"}
                </button>
                <button
                  type="button"
                  onClick={handleReceipt}
                  disabled={receiptLoading}
                  className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/80 hover:border-white/40 disabled:opacity-60"
                >
                  {receiptLoading ? "A preparar..." : "Abrir recibo Stripe"}
                </button>
              </div>
            </div>

            {(order.store.supportEmail || order.store.supportPhone) && (
              <div className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Suporte</p>
                <p className="text-lg font-semibold text-white">Contactar loja</p>
                <div className="mt-2 text-sm text-white/70">
                  {order.store.supportEmail ? <p>Email: {order.store.supportEmail}</p> : null}
                  {order.store.supportPhone ? <p>Telefone: {order.store.supportPhone}</p> : null}
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/me/compras/loja"
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 py-2 text-sm text-white/80 hover:border-white/40"
          >
            Voltar a compras
          </Link>
          {storeLink ? (
            <Link
              href={storeLink}
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 py-2 text-sm text-white/80 hover:border-white/40"
            >
              Continuar a comprar
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
