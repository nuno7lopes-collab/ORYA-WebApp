"use client";

import useSWR from "swr";
import { useSearchParams, useRouter } from "next/navigation";
import { useMemo, useEffect } from "react";
import { formatEuro } from "@/lib/money";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/app/organizacao/dashboardUi";

type InvoiceLine = { quantity: number };
type InvoiceEvent = { id: number; title: string; slug?: string | null; payoutMode?: string | null };
type InvoiceItem = {
  id: number;
  createdAt: string;
  subtotalCents: number;
  discountCents: number;
  platformFeeCents: number;
  cardPlatformFeeCents?: number | null;
  totalCents: number;
  netCents: number;
  event?: InvoiceEvent | null;
  lines?: InvoiceLine[];
};
type InvoiceSummary = { grossCents: number; discountCents: number; platformFeeCents: number; netCents: number; tickets: number };
type InvoiceResponse =
  | { ok: true; items: InvoiceItem[]; summary: InvoiceSummary }
  | { ok: false; error?: string };
type OrganizationMeResponse = { organization?: { id?: number | null } | null };

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<InvoiceResponse>);
const orgFetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<OrganizationMeResponse>);

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

type InvoicesClientProps = {
  basePath?: string;
  fullWidth?: boolean;
  organizationId?: number | null;
};

export default function InvoicesClient({
  basePath = "/organizacao/pagamentos/invoices",
  fullWidth = true,
  organizationId: organizationIdProp = null,
}: InvoicesClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const organizationIdParam = searchParams?.get("organizationId") ?? null;
  const from = searchParams?.get("from") ?? "";
  const to = searchParams?.get("to") ?? "";
  const organizationIdQuery = organizationIdParam ? Number(organizationIdParam) : null;
  const shouldFetchOrganization = !organizationIdProp && !organizationIdQuery;
  const { data: organizationData } = useSWR<OrganizationMeResponse>(
    () => (shouldFetchOrganization ? "/api/organizacao/me" : null),
    orgFetcher,
  );
  const organizationIdFromMe = organizationData?.organization?.id ?? null;
  const organizationId =
    organizationIdProp ??
    (organizationIdQuery && !Number.isNaN(organizationIdQuery) ? organizationIdQuery : null) ??
    organizationIdFromMe ??
    null;
  const qs = toQuery({ organizationId, from, to });
  const { data, isLoading, mutate } = useSWR(
    () => (organizationId ? `/api/organizacao/pagamentos/invoices${qs}` : null),
    fetcher,
    { revalidateOnFocus: false },
  );

  const summary: InvoiceSummary = data?.ok ? data.summary : { grossCents: 0, discountCents: 0, platformFeeCents: 0, netCents: 0, tickets: 0 };
  const items: InvoiceItem[] = data?.ok ? data.items : [];
  const totalTickets = useMemo(
    () => (data?.ok ? data.items.reduce((acc, sale) => acc + (sale.lines?.reduce((s, l) => s + l.quantity, 0) ?? 0), 0) : 0),
    [data],
  );
  const formatPayoutMode = (mode?: string | null) =>
    mode === "PLATFORM" ? "Conta ORYA" : mode === "ORGANIZATION" ? "Conta do clube" : "N/D";

  const withQuery = (path: string, params: Record<string, string | number | null | undefined>) => {
    const query = toQuery(params);
    if (!query) return path;
    return path.includes("?") ? `${path}&${query.slice(1)}` : `${path}${query}`;
  };

  // Se houver organizationId mas não na query, sincroniza a URL.
  useEffect(() => {
    if (!organizationIdParam && organizationId) {
      router.replace(withQuery(basePath, { organizationId, from, to }));
    }
  }, [organizationIdParam, organizationId, router, from, to, basePath]);

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
    router.push(
      withQuery(basePath, {
        organizationId,
        from: which === "from" ? value : from,
        to: which === "to" ? value : to,
      }),
    );
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
    if (!organizationId) {
      return (
        <div className="rounded-3xl border border-white/12 bg-white/5 p-5 text-sm text-white/75 shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
          A carregar organização...
        </div>
      );
    }
    if (!data || data.ok === false) {
      const errorCode = data && "error" in data ? data.error : null;
      if (errorCode && ["UNAUTHENTICATED", "FORBIDDEN"].includes(errorCode)) {
        return (
          <div className="rounded-3xl border border-white/12 bg-white/5 p-5 text-sm text-white/75 shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
            Não tens permissões para ver a faturação desta organização.
          </div>
        );
      }
      if (errorCode && errorCode !== "INTERNAL_ERROR") {
        return (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
            Ainda não há faturação para mostrar. Quando houver vendas, vais ver tudo aqui.
          </div>
        );
      }
      return (
        <div className="rounded-3xl border border-white/15 bg-red-500/10 p-5 text-sm text-white/80 shadow-[0_18px_50px_rgba(0,0,0,0.55)]">
          <p className="font-semibold text-white">Não foi possível carregar faturação.</p>
          <p className="text-white/65">Tenta novamente ou ajusta o intervalo.</p>
          <button
            type="button"
            onClick={() => mutate()}
            className={`${CTA_SECONDARY} mt-3 text-[12px]`}
          >
            Recarregar
          </button>
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
          Sem vendas neste intervalo. Ajusta as datas.
        </div>
      );
    }
    return null;
  })();

  return (
    <div className={fullWidth ? "w-full space-y-6 text-white" : "mx-auto max-w-6xl px-4 py-6 space-y-6 text-white"}>
      <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/10 via-[#0d1530]/75 to-[#050912]/90 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.6)] backdrop-blur-3xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
              Faturação
            </div>
            <h1 className="text-3xl font-semibold drop-shadow-[0_12px_40px_rgba(0,0,0,0.55)]">Receitas e taxas.</h1>
            <p className="text-sm text-white/70">Bruto, descontos e líquido. CSV num clique.</p>
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
                    withQuery(basePath, {
                      organizationId,
                      from: preset.key === "all" ? "" : new Date(Date.now() - (preset.key === "7d" ? 7 : preset.key === "30d" ? 30 : 90) * 86400000)
                        .toISOString()
                        .slice(0, 10),
                      to: preset.key === "all" ? "" : new Date().toISOString().slice(0, 10),
                    }),
                  )
                }
                className={`rounded-full px-3 py-1.5 transition ${
                  preset.key !== "all" && from && to
                    ? "bg-gradient-to-r from-[#FF00C8]/25 via-[#6BFFFF]/20 to-[#1646F5]/25 text-white shadow-[0_0_14px_rgba(107,255,255,0.35)]"
                    : "border border-white/20 text-white/75 hover:bg-white/10"
                }`}
              >
                {preset.label}
              </button>
            ))}
            <input
              type="date"
              value={from}
              onChange={(e) => handleDateChange("from", e.target.value)}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/50"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => handleDateChange("to", e.target.value)}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF] focus:ring-1 focus:ring-[#6BFFFF]/50"
            />
            <button
              type="button"
              onClick={downloadCsv}
              className={`${CTA_PRIMARY} disabled:opacity-50`}
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
            <SummaryCard label="Receita bruta" value={formatEuro(summary.grossCents / 100)} tone="bright" />
            <SummaryCard label="Descontos" value={formatEuro(summary.discountCents / 100)} tone="muted" />
            <SummaryCard label="Taxas" value={formatEuro(summary.platformFeeCents / 100)} tone="muted" helper="Inclui Stripe + ORYA (se aplicável)." />
            <SummaryCard label="Líquido" value={formatEuro(summary.netCents / 100)} tone="success" helper="Valor que recebes." />
            <SummaryCard label="Bilhetes" value={`${totalTickets}`} tone="slate" helper="Total no intervalo." />
          </div>

          <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/75 to-[#050810]/92 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.6)] overflow-x-auto backdrop-blur-2xl">
            <table className="min-w-full text-sm text-white/85">
              <thead className="text-left text-[11px] uppercase tracking-[0.18em] text-white/60">
                <tr className="border-b border-white/10">
                  <th className="py-2 pr-3">Evento</th>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Bilhetes</th>
                  <th className="py-2 pr-3">Bruto</th>
                  <th className="py-2 pr-3">Descontos</th>
                  <th className="py-2 pr-3">Taxas</th>
                  <th className="py-2 pr-3">Líquido</th>
                  <th className="py-2 pr-3">Conta</th>
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
                      <td className="py-3 pr-3">{formatEuro(sale.subtotalCents / 100)}</td>
                      <td className="py-3 pr-3">{formatEuro(sale.discountCents / 100)}</td>
                      <td className="py-3 pr-3">
                        {formatEuro(sale.platformFeeCents / 100)}
                      </td>
                      <td className="py-3 pr-3 font-semibold text-white">{formatEuro(sale.netCents / 100)}</td>
                      <td className="py-3 pr-3 text-[11px]">
                        <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-white shadow-[0_8px_18px_rgba(0,0,0,0.35)]">
                          {formatPayoutMode(sale.event?.payoutMode)}
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
      ? "bg-gradient-to-br from-emerald-400/25 via-emerald-500/20 to-teal-500/25 border-emerald-300/45 text-emerald-50"
      : tone === "bright"
        ? "bg-gradient-to-r from-[#FF00C8]/30 via-[#6BFFFF]/18 to-[#1646F5]/28 border-white/18 text-white"
        : tone === "muted"
          ? "bg-white/6 text-white/70 border-white/12"
          : tone === "slate"
            ? "bg-gradient-to-br from-white/12 via-white/6 to-white/4 text-white/80 border-white/14"
            : "bg-white/8 text-white border-white/12";

  return (
    <div className={`rounded-2xl border p-4 shadow-[0_16px_50px_rgba(0,0,0,0.38)] backdrop-blur-2xl ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/75">{label}</p>
      <p className="text-xl font-semibold leading-tight drop-shadow-[0_10px_25px_rgba(0,0,0,0.4)]">{value}</p>
      {helper && <p className="text-[11px] text-white/60 mt-1">{helper}</p>}
    </div>
  );
}
