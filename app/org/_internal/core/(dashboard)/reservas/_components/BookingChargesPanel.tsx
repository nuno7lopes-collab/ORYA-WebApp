"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/app/org/_shared/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ChargeItem = {
  id: number;
  status: "OPEN" | "PAID" | "CANCELLED";
  kind: string;
  payerKind: string;
  label: string | null;
  amountCents: number;
  currency: string;
  token: string;
  paymentUrl: string;
  paidAt: string | null;
  createdAt: string;
};

function formatMoney(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency}`;
  }
}

function statusLabel(status: ChargeItem["status"]) {
  if (status === "PAID") return "Pago";
  if (status === "CANCELLED") return "Cancelado";
  return "Aberto";
}

function parseAmountToCents(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

export default function BookingChargesPanel({
  bookingId,
  organizationId,
  defaultCurrency,
  disabled,
}: {
  bookingId: number;
  organizationId: number | null;
  defaultCurrency: string;
  disabled?: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const chargesKey = useMemo(() => {
    if (!bookingId || !organizationId) return null;
    return `/api/org/${organizationId}/reservas/${bookingId}/charges`;
  }, [bookingId, organizationId]);

  const { data, isLoading, mutate } = useSWR(chargesKey, fetcher);
  const charges: ChargeItem[] = data?.ok ? (data.data?.charges ?? []) : [];

  const handleCreate = async () => {
    if (creating || disabled || !bookingId || !organizationId) return;
    setError(null);
    const amountCents = parseAmountToCents(amount);
    if (!amountCents || amountCents <= 0) {
      setError("Indica um valor válido.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas/${bookingId}/charges`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          label: label.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao criar cobrança.");
      }
      const created: ChargeItem | null = json?.data?.charge ?? null;
      await mutate();
      setAmount("");
      setLabel("");
      if (created?.paymentUrl && navigator?.clipboard) {
        await navigator.clipboard.writeText(created.paymentUrl);
        setCopiedId(created.id);
        setTimeout(() => setCopiedId((prev) => (prev === created.id ? null : prev)), 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar cobrança.");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (charge: ChargeItem) => {
    if (!charge.paymentUrl || !navigator?.clipboard) return;
    await navigator.clipboard.writeText(charge.paymentUrl);
    setCopiedId(charge.id);
    setTimeout(() => setCopiedId((prev) => (prev === charge.id ? null : prev)), 2000);
  };

  return (
    <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Pagamentos extra</p>
          <p className="text-[12px] text-white/60">Cria cobranças adicionais e partilha o link.</p>
        </div>
      </div>

      <div className="space-y-2">
        {isLoading && <div className="h-16 rounded-xl border border-white/10 orya-skeleton-surface animate-pulse" />}
        {!isLoading && charges.length === 0 && (
          <p className="text-[12px] text-white/50">Sem cobranças adicionais.</p>
        )}
        {charges.map((charge) => (
          <div key={charge.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-white">
                  {charge.label || "Cobrança extra"} · {formatMoney(charge.amountCents, charge.currency)}
                </p>
                <p className="text-[11px] text-white/55">{statusLabel(charge.status)}</p>
              </div>
              {charge.status === "OPEN" && (
                <button
                  type="button"
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/70 hover:border-white/40"
                  onClick={() => handleCopy(charge)}
                >
                  {copiedId === charge.id ? "Link copiado" : "Copiar link"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Nova cobrança</p>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <label className="flex flex-col gap-1 text-white/60">
            Valor ({defaultCurrency})
            <input
              type="text"
              className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={creating || disabled}
            />
          </label>
          <label className="flex flex-col gap-1 text-white/60">
            Nota (opcional)
            <input
              type="text"
              className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-white"
              placeholder="Ex: extra"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              disabled={creating || disabled}
            />
          </label>
        </div>
        {error && <p className="text-[11px] text-red-200">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={CTA_PRIMARY}
            onClick={handleCreate}
            disabled={creating || disabled}
          >
            {creating ? "A criar..." : "Criar cobrança"}
          </button>
          <button
            type="button"
            className={CTA_SECONDARY}
            onClick={() => {
              setAmount("");
              setLabel("");
              setError(null);
            }}
            disabled={creating}
          >
            Limpar
          </button>
        </div>
      </div>
    </div>
  );
}
