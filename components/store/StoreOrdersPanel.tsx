"use client";

import { useEffect, useMemo, useState } from "react";

type OrderSummary = {
  id: number;
  orderNumber: string | null;
  status: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  customerName: string | null;
  customerEmail: string | null;
  createdAt: string;
  shippingZone?: { id: number; name: string } | null;
  shippingMethod?: { id: number; name: string } | null;
};

type OrderLine = {
  id: number;
  nameSnapshot: string;
  skuSnapshot: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  requiresShipping: boolean;
  personalization: unknown;
  product?: { id: number; name: string } | null;
  variant?: { id: number; label: string | null } | null;
};

type OrderAddress = {
  id: number;
  addressType: string;
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
  nif: string | null;
};

type Shipment = {
  id: number;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: string;
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
  shippingZone?: { id: number; name: string } | null;
  shippingMethod?: { id: number; name: string; description: string | null; etaMinDays: number | null; etaMaxDays: number | null } | null;
  lines: OrderLine[];
  addresses: OrderAddress[];
  shipments: Shipment[];
};

type StoreOrdersPanelProps = {
  endpointBase: string;
  storeEnabled: boolean;
};

type OrdersSummary = {
  totalOrders: number;
  totalCents: number;
  shippingCents: number;
};

const STATUSES = ["PENDING", "PAID", "FULFILLED", "CANCELLED", "REFUNDED", "PARTIAL_REFUND"] as const;
const SHIPMENT_STATUSES = ["PENDING", "SHIPPED", "DELIVERED"] as const;

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  FULFILLED: "Concluida",
  CANCELLED: "Cancelada",
  REFUNDED: "Reembolsada",
  PARTIAL_REFUND: "Reembolso parcial",
};

const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Em preparacao",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-PT");
}

function formatOrderStatus(status: string) {
  return ORDER_STATUS_LABEL[status] ?? status;
}

function formatShipmentStatus(status: string) {
  return SHIPMENT_STATUS_LABEL[status] ?? status;
}

export default function StoreOrdersPanel({ endpointBase, storeEnabled }: StoreOrdersPanelProps) {
  const [items, setItems] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [shipmentSavingId, setShipmentSavingId] = useState<number | null>(null);
  const [filters, setFilters] = useState({ status: "", q: "" });
  const [summary, setSummary] = useState<OrdersSummary | null>(null);
  const summaryCurrency = items[0]?.currency ?? "EUR";
  const [shipmentForm, setShipmentForm] = useState({
    carrier: "",
    trackingNumber: "",
    trackingUrl: "",
    status: "PENDING",
  });

  const shipmentsBase = useMemo(() => endpointBase.replace(/\/orders$/, "") + "/shipments", [endpointBase]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.q.trim()) params.set("q", filters.q.trim());
      const res = await fetch(`${endpointBase}?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar encomendas.");
      }
      setItems(Array.isArray(json.items) ? json.items : []);
      setSummary(json.summary ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (orderId: number) => {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await fetch(`${endpointBase}/${orderId}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar encomenda.");
      }
      setDetail(json.order as OrderDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [endpointBase]);

  useEffect(() => {
    void load();
  }, [filters.status]);

  const handleSelect = async (orderId: number) => {
    setSelectedId(orderId);
    await loadDetail(orderId);
  };

  const handleUpdateOrder = async () => {
    if (!detail || !storeEnabled) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${endpointBase}/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: detail.status, notes: detail.notes }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar encomenda.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateShipment = async () => {
    if (!detail || !storeEnabled) return;
    setShipmentSavingId(-1);
    setError(null);
    try {
      const res = await fetch(`${endpointBase}/${detail.id}/shipments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrier: shipmentForm.carrier || null,
          trackingNumber: shipmentForm.trackingNumber || null,
          trackingUrl: shipmentForm.trackingUrl || null,
          status: shipmentForm.status,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar envio.");
      }
      setDetail((prev) =>
        prev ? { ...prev, shipments: [json.shipment as Shipment, ...prev.shipments] } : prev,
      );
      setShipmentForm({ carrier: "", trackingNumber: "", trackingUrl: "", status: "PENDING" });
      await load();
      await loadDetail(detail.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setShipmentSavingId(null);
    }
  };

  const handleUpdateShipment = async (shipment: Shipment) => {
    if (!storeEnabled) return;
    setShipmentSavingId(shipment.id);
    setError(null);
    try {
      const res = await fetch(`${shipmentsBase}/${shipment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrier: shipment.carrier,
          trackingNumber: shipment.trackingNumber,
          trackingUrl: shipment.trackingUrl,
          status: shipment.status,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar envio.");
      }
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              shipments: prev.shipments.map((entry) =>
                entry.id === shipment.id ? (json.shipment as Shipment) : entry,
              ),
            }
          : prev,
      );
      await load();
      if (detail) {
        await loadDetail(detail.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setShipmentSavingId(null);
    }
  };

  const handleDeleteShipment = async (shipmentId: number) => {
    if (!storeEnabled) return;
    setShipmentSavingId(shipmentId);
    setError(null);
    try {
      const res = await fetch(`${shipmentsBase}/${shipmentId}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao remover envio.");
      }
      setDetail((prev) =>
        prev ? { ...prev, shipments: prev.shipments.filter((entry) => entry.id !== shipmentId) } : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setShipmentSavingId(null);
    }
  };

  return (
    <section className="mt-6 rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
      <header className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-white">Encomendas</h2>
        <p className="text-sm text-white/65">Acompanha pagamentos, envios e estados.</p>
      </header>

      {!storeEnabled && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          A loja esta desativada globalmente.
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-white/70">
          Pesquisa
          <input
            value={filters.q}
            onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="Order, email ou nome"
          />
        </label>
        <label className="flex min-w-[160px] flex-col gap-1 text-xs text-white/70">
          Estado
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
          >
            <option value="">Todos</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatOrderStatus(status)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/85 px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? "A atualizar..." : "Atualizar"}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {summary ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-white/70">
          {summary.totalOrders} encomendas · Volume {formatMoney(summary.totalCents, summaryCurrency)} · Portes{" "}
          {formatMoney(summary.shippingCents, summaryCurrency)}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          A carregar encomendas...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          Sem encomendas por agora.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => void handleSelect(item.id)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                selectedId === item.id
                  ? "border-white/40 bg-white/10"
                  : "border-white/10 bg-black/30 hover:border-white/30"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {item.orderNumber || `#${item.id}`} · {item.customerName || item.customerEmail || "Cliente"}
                  </p>
                  <p className="text-xs text-white/60">
                    {formatDate(item.createdAt)} · {formatOrderStatus(item.status)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">
                    {formatMoney(item.totalCents, item.currency)}
                  </p>
                  <p className="text-xs text-white/60">
                    Portes {formatMoney(item.shippingCents, item.currency)}
                  </p>
                </div>
              </div>
              {item.shippingMethod?.name ? (
                <p className="mt-2 text-xs text-white/50">
                  {item.shippingZone?.name ? `${item.shippingZone.name} · ` : ""}{item.shippingMethod.name}
                </p>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {selectedId ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/80 space-y-4">
          {detailLoading || !detail ? (
            <div className="text-white/60">A carregar detalhe...</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-white">
                    {detail.orderNumber || `#${detail.id}`}
                  </p>
                  <p className="text-xs text-white/60">{formatDate(detail.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/70">Total</p>
                  <p className="text-lg font-semibold text-white">
                    {formatMoney(detail.totalCents, detail.currency)}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">Cliente</p>
                  <p>{detail.customerName || "-"}</p>
                  <p>{detail.customerEmail || "-"}</p>
                  <p>{detail.customerPhone || "-"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">Envio</p>
                  <p>{detail.shippingZone?.name || "-"}</p>
                  <p>{detail.shippingMethod?.name || "-"}</p>
                  {detail.shippingMethod?.etaMinDays || detail.shippingMethod?.etaMaxDays ? (
                    <p>
                      ETA {detail.shippingMethod?.etaMinDays ?? ""}-{detail.shippingMethod?.etaMaxDays ?? ""} dias
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {detail.addresses.map((address) => (
                  <div key={address.id} className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                      {address.addressType === "SHIPPING" ? "Envio" : "Faturacao"}
                    </p>
                    <p>{address.fullName}</p>
                    <p>
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ""}
                    </p>
                    <p>
                      {address.postalCode} {address.city}
                      {address.region ? `, ${address.region}` : ""}
                    </p>
                    <p>{address.country}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Itens</p>
                {detail.lines.map((line) => (
                  <div key={line.id} className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-white">
                        {line.nameSnapshot}
                        {line.variant?.label ? ` · ${line.variant.label}` : ""}
                      </p>
                      <p className="text-xs text-white/50">
                        {line.quantity} x {formatMoney(line.unitPriceCents, detail.currency)}
                      </p>
                    </div>
                    <p className="text-sm text-white">{formatMoney(line.totalCents, detail.currency)}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <label className="flex min-w-[180px] flex-col gap-1 text-xs text-white/70">
                  Estado
                  <select
                    value={detail.status}
                    onChange={(e) =>
                      setDetail((prev) => (prev ? { ...prev, status: e.target.value } : prev))
                    }
                    className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {formatOrderStatus(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-1 min-w-[240px] flex-col gap-1 text-xs text-white/70">
                  Notas internas
                  <input
                    value={detail.notes ?? ""}
                    onChange={(e) =>
                      setDetail((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                    }
                    className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                    placeholder="Observacoes..."
                  />
                </label>
                <button
                  type="button"
                  disabled={!storeEnabled || saving}
                  onClick={handleUpdateOrder}
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/85 px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
                >
                  {saving ? "A guardar..." : "Guardar"}
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Envios</p>
                <div className="grid gap-3 md:grid-cols-[1fr,1fr,1fr,1fr,auto]">
                  <input
                    value={shipmentForm.carrier}
                    onChange={(e) => setShipmentForm((prev) => ({ ...prev, carrier: e.target.value }))}
                    className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                    placeholder="Transportadora"
                  />
                  <input
                    value={shipmentForm.trackingNumber}
                    onChange={(e) =>
                      setShipmentForm((prev) => ({ ...prev, trackingNumber: e.target.value }))
                    }
                    className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                    placeholder="Tracking"
                  />
                  <input
                    value={shipmentForm.trackingUrl}
                    onChange={(e) => setShipmentForm((prev) => ({ ...prev, trackingUrl: e.target.value }))}
                    className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                    placeholder="URL tracking"
                  />
                  <select
                    value={shipmentForm.status}
                    onChange={(e) => setShipmentForm((prev) => ({ ...prev, status: e.target.value }))}
                    className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  >
                    {SHIPMENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {formatShipmentStatus(status)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!storeEnabled || shipmentSavingId !== null}
                    onClick={handleCreateShipment}
                    className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/85 px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
                  >
                    {shipmentSavingId === -1 ? "A criar..." : "Adicionar"}
                  </button>
                </div>

                {detail.shipments.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-white/60">
                    Sem envios por agora.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detail.shipments.map((shipment) => (
                      <div
                        key={shipment.id}
                        className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-3"
                      >
                        <input
                          value={shipment.carrier ?? ""}
                          onChange={(e) =>
                            setDetail((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    shipments: prev.shipments.map((entry) =>
                                      entry.id === shipment.id
                                        ? { ...entry, carrier: e.target.value }
                                        : entry,
                                    ),
                                  }
                                : prev,
                            )
                          }
                          className="min-w-[140px] flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-white/40"
                          placeholder="Transportadora"
                        />
                        <input
                          value={shipment.trackingNumber ?? ""}
                          onChange={(e) =>
                            setDetail((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    shipments: prev.shipments.map((entry) =>
                                      entry.id === shipment.id
                                        ? { ...entry, trackingNumber: e.target.value }
                                        : entry,
                                    ),
                                  }
                                : prev,
                            )
                          }
                          className="min-w-[140px] flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-white/40"
                          placeholder="Tracking"
                        />
                        <input
                          value={shipment.trackingUrl ?? ""}
                          onChange={(e) =>
                            setDetail((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    shipments: prev.shipments.map((entry) =>
                                      entry.id === shipment.id
                                        ? { ...entry, trackingUrl: e.target.value }
                                        : entry,
                                    ),
                                  }
                                : prev,
                            )
                          }
                          className="min-w-[160px] flex-[2] rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-white/40"
                          placeholder="URL"
                        />
                        <select
                          value={shipment.status}
                          onChange={(e) =>
                            setDetail((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    shipments: prev.shipments.map((entry) =>
                                      entry.id === shipment.id
                                        ? { ...entry, status: e.target.value }
                                        : entry,
                                    ),
                                  }
                                : prev,
                            )
                          }
                          className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:border-white/40"
                        >
                          {SHIPMENT_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {formatShipmentStatus(status)}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!storeEnabled || shipmentSavingId !== null}
                            onClick={() => handleUpdateShipment(shipment)}
                            className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/80 hover:border-white/40 disabled:opacity-60"
                          >
                            {shipmentSavingId === shipment.id ? "A guardar..." : "Guardar"}
                          </button>
                          <button
                            type="button"
                            disabled={!storeEnabled || shipmentSavingId !== null}
                            onClick={() => handleDeleteShipment(shipment.id)}
                            className="rounded-full border border-red-400/50 bg-red-500/10 px-3 py-1 text-xs text-red-100 hover:border-red-300/60 disabled:opacity-60"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
