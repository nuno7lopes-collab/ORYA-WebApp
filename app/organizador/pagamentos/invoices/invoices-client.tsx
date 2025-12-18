"use client";

import useSWR from "swr";
import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useEffect } from "react";
import { formatMoney } from "@/lib/money";
import { useUser } from "@/app/hooks/useUser";

type InvoiceLine = { quantity: number };
type InvoiceEvent = { id: number; title: string; slug?: string | null; payoutMode?: string | null };
type InvoiceItem = {
  id: number;
  createdAt: string;
  subtotalCents: number;
  discountCents: number;
  platformFeeCents: number;
  totalCents: number;
  netCents: number;
  event?: InvoiceEvent | null;
  lines?: InvoiceLine[];
};
type InvoiceSummary = { grossCents: number; discountCents: number; platformFeeCents: number; netCents: number; tickets: number };
type InvoiceResponse =
  | { ok: true; items: InvoiceItem[]; summary: InvoiceSummary }
  | { ok: false; error?: string };

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<InvoiceResponse>);

const toQuery = (params: Record<string, string | number | null | undefined>) => {
  const url = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && String(v).trim() !== "") {
      url.set(k, String(v));
    }
  });
  const qs = url.toString();
  return qs ? `?${qs}` : "";
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function InvoicesClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { organizerId: orgIdFromProfile } = useUser()?.organizer ?? {};
  const organizerIdParam = searchParams?.get("organizerId") ?? (orgIdFromProfile ? String(orgIdFromProfile) : null);
  const from = searchParams?.get("from") ?? "";
  const to = searchParams?.get("to") ?? "";
  const organizerId = organizerIdParam ? Number(organizerIdParam) : null;
  const qs = toQuery({ organizerId, from, to });
  const { data, isLoading, mutate } = useSWR(() => (organizerId ? `/api/organizador/pagamentos/invoices${qs}` : null), fetcher, {
    revalidateOnFocus: false,
  });

  const summary: InvoiceSummary = data?.ok ? data.summary : { grossCents: 0, discountCents: 0, platformFeeCents: 0, netCents: 0, tickets: 0 };
  const items: InvoiceItem[] = data?.ok ? data.items : [];
  const totalTickets = useMemo(
    () => (data?.ok ? data.items.reduce((acc, sale) => acc + (sale.lines?.reduce((s, l) => s + l.quantity, 0) ?? 0), 0) : 0),
    [data],
  );

  // Se houver organizerId do perfil mas não na query, sincroniza a URL.
  useEffect(() => {
    if (!organizerId && orgIdFromProfile) {
      router.replace(`/organizador${toQuery({ tab: "invoices", organizerId: orgIdFromProfile, from, to })}`);
    }
  }, [organizerId, orgIdFromProfile, router, from, to]);

  const downloadCsv = () => {
    if (!items.length) return;
    const rows = [
      ["Data", "Evento", "Payout Mode", "Subtotal", "Desconto", "Taxas", "Total", "Líquido", "Bilhetes"],
      ...items.map((sale) => [
        sale.createdAt,
        sale.event?.title ?? "",
        sale.event?.payoutMode ?? "",
        (sale.subtotalCents / 100).toFixed(2),
        (sale.discountCents / 100).toFixed(2),
        (sale.platformFeeCents / 100).toFixed(2),
        (sale.totalCents / 100).toFixed(2),
        (sale.netCents / 100).toFixed(2),
        sale.lines?.reduce((s, l) => s + l.quantity, 0) ?? 0,
      ]),
    ];

    const csvContent = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invoices.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDateChange = (which: "from" | "to", value: string) => {
    router.push(`/organizador${toQuery({ tab: "invoices", organizerId, from: which === "from" ? value : from, to: which === "to" ? value : to })}`);
  };

  const stateCard = (() => {
    if (isLoading) {
      return (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-4 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white/10 animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-white/10 animate-pulse" />
              <div className="h-3 w-32 rounded bg-white/10 animate-pulse" />
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className="h-16 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
            ))}
          </div>
        </div>
      );
    }
    if (!data || data.ok === false) {
      return (
        <div className="rounded-3xl border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-50 shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
          <p className="font-semibold">Não foi possível carregar faturação.</p>
          <p className="text-red-100/80">Tenta novamente ou ajusta o intervalo.</p>
          <button
            type="button"
            onClick={() => mutate()}
            className="mt-3 rounded-full border border-red-200/60 px-3 py-1 text-[12px] text-red-50 hover:bg-red-500/15"
          >
            Recarregar
          </button>
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
          Ainda não existem vendas neste intervalo. Ajusta as datas ou volta mais tarde.
        </div>
      );
    }
    return null;
  })();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6 text-white">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0b1021] via-[#0d1530] to-[#0f1c3d] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Faturação</p>
            <h1 className="text-3xl font-semibold">Resumo de vendas</h1>
            <p className="text-sm text-white/65">Bruto, taxas (Stripe + ORYA) e líquido por evento. Exporta CSV quando precisares.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            {[
              { key: "7d", label: "7d" },
              { key: "30d", label: "30d" },
              { key: "90d", label: "90d" },
              { key: "all", label: "Sempre" },
            ].map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() =>
                  router.push(
                    `/organizador${toQuery({
                      tab: "invoices",
                      organizerId,
                      from: preset.key === "all" ? "" : new Date(Date.now() - (preset.key === "7d" ? 7 : preset.key === "30d" ? 30 : 90) * 86400000)
                        .toISOString()
                        .slice(0, 10),
                      to: preset.key === "all" ? "" : new Date().toISOString().slice(0, 10),
                    })}`,
                  )
                }
                className={`rounded-full px-3 py-1.5 transition ${
                  preset.key !== "all" && from && to
                    ? "bg-gradient-to-r from-[#FF00C8]/20 via-[#6BFFFF]/15 to-[#1646F5]/20 text-white shadow-[0_0_12px_rgba(107,255,255,0.25)]"
                    : "border border-white/20 text-white/75 hover:bg-white/5"
                }`}
              >
                {preset.label}
              </button>
            ))}
            <input
              type="date"
              value={from}
              onChange={(e) => handleDateChange("from", e.target.value)}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => handleDateChange("to", e.target.value)}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
            />
            <button
              type="button"
              onClick={downloadCsv}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white shadow hover:bg-white/10 disabled:opacity-50"
              disabled={!items.length}
            >
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      {stateCard}

      {data?.ok && items.length > 0 && (
        <>
          <div className="grid gap-3 md:grid-cols-5">
            <SummaryCard label="Receita bruta" value={formatMoney(summary.grossCents / 100)} tone="bright" />
            <SummaryCard label="Descontos" value={formatMoney(summary.discountCents / 100)} tone="muted" />
            <SummaryCard label="Taxas" value={formatMoney(summary.platformFeeCents / 100)} tone="muted" helper="Inclui Stripe + ORYA (se aplicável)." />
            <SummaryCard label="Líquido" value={formatMoney(summary.netCents / 100)} tone="success" helper="Valor que recebes." />
            <SummaryCard label="Bilhetes" value={`${totalTickets}`} tone="slate" helper="Total no intervalo." />
          </div>

          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-black/40 to-[#0a1327] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.6)] overflow-x-auto">
            <table className="min-w-full text-sm text-white/80">
              <thead className="text-left text-[11px] uppercase tracking-[0.16em] text-white/60">
                <tr>
                  <th className="py-2 pr-3">Evento</th>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Bilhetes</th>
                  <th className="py-2 pr-3">Bruto</th>
                  <th className="py-2 pr-3">Descontos</th>
                  <th className="py-2 pr-3">Taxas</th>
                  <th className="py-2 pr-3">Líquido</th>
                  <th className="py-2 pr-3">Modo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {items.map((sale) => {
                  const tickets = sale.lines?.reduce((s, l) => s + l.quantity, 0) ?? 0;
                  return (
                    <tr key={sale.id} className="hover:bg-white/5 transition">
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-white">{sale.event?.title ?? "Evento"}</div>
                        <div className="text-[11px] text-white/60">{sale.event?.slug ?? "—"}</div>
                      </td>
                      <td className="py-3 pr-3 text-[12px] text-white/70">{formatDateTime(sale.createdAt)}</td>
                      <td className="py-3 pr-3 text-[12px]">{tickets}</td>
                      <td className="py-3 pr-3">{formatMoney(sale.subtotalCents / 100)}</td>
                      <td className="py-3 pr-3">{formatMoney(sale.discountCents / 100)}</td>
                      <td className="py-3 pr-3">{formatMoney(sale.platformFeeCents / 100)}</td>
                      <td className="py-3 pr-3 font-semibold">{formatMoney(sale.netCents / 100)}</td>
                      <td className="py-3 pr-3 text-[11px]">
                        <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-white/70">
                          {sale.event?.payoutMode ?? "STANDARD"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
  helper,
}: {
  label: string;
  value: string;
  tone?: "default" | "muted" | "bright" | "success" | "slate";
  helper?: string;
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-500/10 border-emerald-400/40 text-emerald-50"
      : tone === "bright"
        ? "bg-gradient-to-r from-[#FF00C8]/15 via-[#6BFFFF]/10 to-[#1646F5]/15 border-white/15 text-white"
        : tone === "muted"
          ? "bg-white/5 text-white/65"
          : tone === "slate"
            ? "bg-white/8 text-white/80"
            : "bg-white/10 text-white";

  return (
    <div className={`rounded-2xl border p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/70">{label}</p>
      <p className="text-xl font-semibold leading-tight">{value}</p>
      {helper && <p className="text-[11px] text-white/55 mt-1">{helper}</p>}
    </div>
  );
}
