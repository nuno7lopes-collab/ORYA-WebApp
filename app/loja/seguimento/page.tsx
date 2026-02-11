"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";

type OrderLine = {
  id: number;
  name: string;
  slug: string | null;
  quantity: number;
  totalCents: number;
  variantLabel: string | null;
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

type TimelineEntry = { key: string; label: string; date: string };

type OrderLookup = {
  id: number;
  orderNumber: string | null;
  status: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  customerName: string | null;
  createdAt: string;
  store: {
    displayName: string;
    username: string | null;
    supportEmail: string | null;
    supportPhone: string | null;
    returnPolicy?: string | null;
    privacyPolicy?: string | null;
    termsUrl?: string | null;
  };
  shipping: {
    zoneName: string | null;
    methodName: string | null;
    etaMinDays: number | null;
    etaMaxDays: number | null;
    address: {
      fullName: string;
      formattedAddress: string | null;
      nif: string | null;
    } | null;
  };
  shipments: Shipment[];
  timeline: TimelineEntry[];
  lines: OrderLine[];
};

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

function formatShipmentLabel(status: string) {
  if (status === "DELIVERED") return "entregue";
  if (status === "SHIPPED") return "enviado";
  return "em preparacao";
}

export default function StoreOrderTrackingPage() {
  const searchParams = useSearchParams();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderLookup | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);

  useEffect(() => {
    const initialOrderNumber = searchParams?.get("orderNumber") ?? "";
    if (initialOrderNumber) setOrderNumber(initialOrderNumber);
  }, [searchParams]);

  const storeLink = useMemo(() => {
    if (!order?.store.username) return null;
    return `/${order.store.username}/loja`;
  }, [order?.store.username]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      const res = await fetch("/api/public/store/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, email }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Nao foi possivel encontrar a encomenda.");
      }
      setOrder(json.order as OrderLookup);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const handleInvoice = async () => {
    setInvoiceLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/store/orders/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, email }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Fatura indisponivel.");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fatura_${orderNumber}.pdf`;
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

  const handleReceipt = async () => {
    setReceiptLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/store/orders/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, email }),
      });
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

  const statusStyle = order ? STATUS_STYLE[order.status] ?? STATUS_STYLE.PAID : "";
  const statusLabel = order ? STATUS_LABEL[order.status] ?? order.status : "";
  const etaLabel =
    order?.shipping.etaMinDays && order?.shipping.etaMaxDays
      ? `${order.shipping.etaMinDays}-${order.shipping.etaMaxDays} dias`
      : order?.shipping.etaMinDays
        ? `${order.shipping.etaMinDays} dias`
        : null;

  return (
    <main className="min-h-screen w-full text-white">
      <div className="orya-page-width px-4 pb-16 pt-10 space-y-6">
        <header className="rounded-3xl border border-white/15 bg-white/5 px-5 py-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl sm:px-8 sm:py-7">
          <p className="text-xs uppercase tracking-[0.24em] text-white/55">Loja ORYA</p>
          <h1 className="text-2xl font-semibold text-white">Seguimento de encomenda</h1>
          <p className="text-sm text-white/70">
            Introduz o numero da encomenda e o email usado na compra.
          </p>
        </header>

        <form
          onSubmit={handleLookup}
          className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
        >
          <div className="grid gap-3 md:grid-cols-[1.3fr,1.7fr]">
            <input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder="Numero da encomenda (ex: ORD-1-XXXX)"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder="Email da compra"
              type="email"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-full border border-white/20 bg-white/90 px-6 py-2 text-sm font-semibold text-black shadow-[0_10px_24px_rgba(255,255,255,0.2)] disabled:opacity-60"
            >
              {loading ? "A procurar..." : "Encontrar pedido"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOrder(null);
                setError(null);
              }}
              className="rounded-full border border-white/20 bg-white/10 px-6 py-2 text-sm text-white/80 hover:border-white/40"
            >
              Limpar
            </button>
          </div>
        </form>

        {error && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {order ? (
          <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            <div className="space-y-4">
              <div className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-white/60">Pedido</p>
                    <p className="text-lg font-semibold text-white">
                      {order.orderNumber ?? order.id}
                    </p>
                    <p className="text-sm text-white/70">
                      {order.store.displayName} · {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle}`}>
                    ● {statusLabel}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {order.lines.map((line) => (
                    <div
                      key={line.id}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/35 px-3 py-2"
                    >
                      <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-black/40">
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
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 text-right text-sm text-white/70">
                  Total: <span className="font-semibold text-white">{formatMoney(order.totalCents, order.currency)}</span>
                </div>
              </div>

              <div className="rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                <p className="text-xs uppercase tracking-[0.24em] text-white/60">Timeline</p>
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
                <p className="text-xs uppercase tracking-[0.24em] text-white/60">Envio</p>
                <p className="text-sm text-white/70">
                  Metodo: {order.shipping.methodName ?? "Digital"} {etaLabel ? `· ${etaLabel}` : ""}
                </p>
                <p className="text-xs text-white/60">Zona: {order.shipping.zoneName ?? "—"}</p>
                {order.shipping.address ? (
                  <div className="mt-3 text-xs text-white/60 space-y-1">
                    <p>{order.shipping.address.fullName}</p>
                    {order.shipping.address.formattedAddress ? (
                      <p>{order.shipping.address.formattedAddress}</p>
                    ) : null}
                    {order.shipping.address.nif ? <p>NIF: {order.shipping.address.nif}</p> : null}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-white/60">Sem morada de envio.</p>
                )}

                {order.shipments[0] ? (
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
                <p className="text-xs uppercase tracking-[0.24em] text-white/60">Documentos</p>
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
                  <p className="text-xs uppercase tracking-[0.24em] text-white/60">Suporte</p>
                  <div className="mt-2 text-sm text-white/70">
                    {order.store.supportEmail ? <p>Email: {order.store.supportEmail}</p> : null}
                    {order.store.supportPhone ? <p>Telefone: {order.store.supportPhone}</p> : null}
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 py-2 text-sm text-white/80 hover:border-white/40"
          >
            Voltar ao inicio
          </Link>
          {storeLink ? (
            <Link
              href={storeLink}
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 py-2 text-sm text-white/80 hover:border-white/40"
            >
              Visitar loja
            </Link>
          ) : null}
        </div>
        {order ? (
          <StorefrontFooter
            storeName={order.store.displayName}
            storePolicies={{
              supportEmail: order.store.supportEmail ?? null,
              supportPhone: order.store.supportPhone ?? null,
              returnPolicy: order.store.returnPolicy ?? null,
              privacyPolicy: order.store.privacyPolicy ?? null,
              termsUrl: order.store.termsUrl ?? null,
            }}
          />
        ) : null}
      </div>
    </main>
  );
}
