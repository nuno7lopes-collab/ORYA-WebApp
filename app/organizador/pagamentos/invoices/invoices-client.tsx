"use client";

import useSWR from "swr";
import { useSearchParams, useRouter } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { useUser } from "@/app/hooks/useUser";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function toQuery(params: Record<string, string | number | null | undefined>) {
  const url = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && String(v).trim() !== "") {
      url.set(k, String(v));
    }
  });
  const qs = url.toString();
  return qs ? `?${qs}` : "";
}

export default function InvoicesClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { organizerId: orgIdFromProfile } = useUser()?.organizer ?? {};
  const organizerIdParam = searchParams?.get("organizerId") ?? (orgIdFromProfile ? String(orgIdFromProfile) : null);
  const from = searchParams?.get("from") ?? "";
  const to = searchParams?.get("to") ?? "";
  const organizerId = organizerIdParam ? Number(organizerIdParam) : null;
  const qs = toQuery({ organizerId, from, to });
  const { data, isLoading } = useSWR(() => (organizerId ? `/api/organizador/pagamentos/invoices${qs}` : null), fetcher, {
    revalidateOnFocus: false,
  });

  const summary = data?.summary ?? { grossCents: 0, discountCents: 0, platformFeeCents: 0, netCents: 0, tickets: 0 };

  const downloadCsv = () => {
    const rows = [
      ["Data", "Evento", "Payout Mode", "Subtotal", "Desconto", "Taxas", "Total", "Líquido", "Bilhetes"],
      ...(data?.items || []).map((sale: any) => [
        sale.createdAt,
        sale.event?.title ?? "",
        sale.event?.payoutMode ?? "",
        (sale.subtotalCents / 100).toFixed(2),
        (sale.discountCents / 100).toFixed(2),
        (sale.platformFeeCents / 100).toFixed(2),
        (sale.totalCents / 100).toFixed(2),
        (sale.netCents / 100).toFixed(2),
        sale.lines?.reduce((s: number, l: any) => s + l.quantity, 0) ?? 0,
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-5 text-white">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Faturação / organizer</p>
          <h1 className="text-3xl font-semibold">Invoices</h1>
          <p className="text-sm text-white/65">Resumo das vendas (sale_summaries/sale_lines) com filtros básicos.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[12px]">
          <input
            type="date"
            value={from}
            onChange={(e) => router.push(`/organizador/pagamentos/invoices${toQuery({ organizerId, from: e.target.value, to })}`)}
            className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => router.push(`/organizador/pagamentos/invoices${toQuery({ organizerId, from, to: e.target.value })}`)}
            className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#6BFFFF]"
          />
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-4 text-white/70">A carregar faturação…</div>
      ) : !data || data.ok === false ? (
        <div className="p-4 text-white/80">
          Não foi possível carregar faturação.
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard label="Receita bruta" value={formatMoney(summary.grossCents, "EUR")} />
            <SummaryCard label="Descontos" value={formatMoney(summary.discountCents, "EUR")} muted />
            <SummaryCard label="Taxa ORYA" value={formatMoney(summary.platformFeeCents, "EUR")} muted />
            <SummaryCard label="Líquido" value={formatMoney(summary.netCents, "EUR")} highlight />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.55)] overflow-x-auto">
            <table className="min-w-full text-sm text-white/80">
              <thead className="text-left text-[11px] uppercase tracking-[0.16em] text-white/60">
                <tr>
                  <th className="py-2 pr-3">Evento</th>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Subtotal</th>
                  <th className="py-2 pr-3">Taxas</th>
                  <th className="py-2 pr-3">Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.items.map((sale: any) => (
                  <tr key={sale.id}>
                    <td className="py-2 pr-3">
                      <div className="font-semibold">{sale.event?.title ?? "Evento"}</div>
                      <div className="text-[11px] text-white/60">{sale.event?.payoutMode ?? ""}</div>
                    </td>
                    <td className="py-2 pr-3 text-[12px] text-white/70">{new Date(sale.createdAt).toLocaleString("pt-PT")}</td>
                    <td className="py-2 pr-3">{formatMoney(sale.subtotalCents, "EUR")}</td>
                    <td className="py-2 pr-3">{formatMoney(sale.platformFeeCents, "EUR")}</td>
                    <td className="py-2 pr-3 font-semibold">{formatMoney(sale.netCents, "EUR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, muted, highlight }: { label: string; value: string; muted?: boolean; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 p-4 shadow-sm ${
        highlight ? "bg-emerald-500/10 border-emerald-400/30 text-emerald-50" : muted ? "bg-white/5 text-white/60" : "bg-white/10 text-white"
      }`}
    >
      <p className="text-[12px] uppercase tracking-[0.2em]">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
