"use client";

import useSWR from "swr";
import { cn } from "@/lib/utils";
import { CTA_SECONDARY } from "@/app/organizacao/dashboardUi";

type ReconciliationEvent = {
  id: number;
  title: string;
  startsAt: string | null;
  status: string | null;
  payoutMode: string | null;
  grossCents: number;
  feesCents: number;
  netCents: number;
  refundsCents: number;
  netAfterRefundsCents: number;
  holdCents: number;
  holdReason: string | null;
  releaseAt: string | null;
};

type ReconciliationResponse =
  | {
      ok: true;
      summary: {
        grossCents: number;
        feesCents: number;
        netCents: number;
        refundsCents: number;
        netAfterRefundsCents: number;
        holdCents: number;
      };
      events: ReconciliationEvent[];
    }
  | { ok: false; error?: string };

const fetcher = (url: string) => fetch(url).then((res) => res.json() as Promise<ReconciliationResponse>);

const formatMoney = (cents: number) => `${(cents / 100).toFixed(2)} €`;

const formatDateOnly = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
};

export default function ReconciliationPanel() {
  const { data, isLoading } = useSWR<ReconciliationResponse>("/api/organizacao/finance/reconciliation", fetcher, {
    revalidateOnFocus: false,
  });

  const summary = data && data.ok ? data.summary : null;
  const events = data && data.ok ? data.events : [];

  const downloadCsv = () => {
    if (!events.length) return;
    const rows = [
      ["Evento", "Data", "Bruto", "Taxas", "Reembolsos", "Liquido", "Liquido apos reembolso", "Hold", "Payout", "Estado"],
      ...events.map((row) => [
        row.title,
        row.startsAt ?? "",
        (row.grossCents / 100).toFixed(2),
        (row.feesCents / 100).toFixed(2),
        (row.refundsCents / 100).toFixed(2),
        (row.netCents / 100).toFixed(2),
        (row.netAfterRefundsCents / 100).toFixed(2),
        (row.holdCents / 100).toFixed(2),
        row.payoutMode ?? "",
        row.status ?? "",
      ]),
    ];
    const csvContent = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "reconciliacao.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/92 backdrop-blur-3xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-white">Reconciliação por evento</h3>
          <p className="text-[12px] text-white/65">Bruto, taxas, reembolsos e hold.</p>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          disabled={!events.length}
          className={cn(CTA_SECONDARY, "px-3 py-1 text-[11px] disabled:opacity-50")}
        >
          Exportar CSV
        </button>
      </div>

      {summary && (
        <div className="grid gap-2 sm:grid-cols-3 text-[12px] text-white/70">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] text-white/60">Bruto</p>
            <p className="text-white font-semibold">{formatMoney(summary.grossCents)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] text-white/60">Reembolsos</p>
            <p className="text-white font-semibold">{formatMoney(summary.refundsCents)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] text-white/60">Líquido após reembolsos</p>
            <p className="text-white font-semibold">{formatMoney(summary.netAfterRefundsCents)}</p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-[12px] text-white/70">
          A carregar reconciliação...
        </div>
      )}

      {!isLoading && data && data.ok === false && (
        <div className="rounded-2xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-100">
          {data.error || "Erro ao carregar reconciliação."}
        </div>
      )}

      {!isLoading && data && data.ok && events.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-[12px] text-white/70">
          Sem vendas para reconciliar.
        </div>
      )}

      {events.length > 0 && (
        <div className="overflow-auto">
          <table className="min-w-full text-sm text-white/80">
            <thead className="text-left text-[11px] uppercase tracking-wide text-white/60">
              <tr>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Bruto</th>
                <th className="px-4 py-3">Taxas</th>
                <th className="px-4 py-3">Reembolsos</th>
                <th className="px-4 py-3">Líquido</th>
                <th className="px-4 py-3">Hold</th>
                <th className="px-4 py-3">Payout</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {events.map((row) => (
                <tr key={row.id} className="hover:bg-white/5 transition">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-white">{row.title}</span>
                      <span className="text-[11px] text-white/60">{formatDateOnly(row.startsAt)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px]">{formatMoney(row.grossCents)}</td>
                  <td className="px-4 py-3 text-[12px]">{formatMoney(row.feesCents)}</td>
                  <td className="px-4 py-3 text-[12px]">{formatMoney(row.refundsCents)}</td>
                  <td className="px-4 py-3 text-[12px]">{formatMoney(row.netAfterRefundsCents)}</td>
                  <td className="px-4 py-3 text-[11px]">
                    {row.holdCents > 0 ? (
                      <span className="rounded-full border border-amber-300/40 bg-amber-500/10 px-2 py-0.5 text-amber-100">
                        {formatMoney(row.holdCents)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-[11px]">
                    <span className="rounded-full border border-white/20 px-2 py-0.5 text-white/70">
                      {row.payoutMode ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[11px]">
                    <span className="rounded-full border border-white/20 px-2 py-0.5 text-white/70">
                      {row.status ?? "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
