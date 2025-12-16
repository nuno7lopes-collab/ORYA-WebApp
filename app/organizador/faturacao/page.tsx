// app/organizador/faturacao/page.tsx
"use client";

import useSWR from "swr";
import { useState } from "react";
import { useRouter } from "next/navigation";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function OrganizerFinanceDashboard() {
  const { data, error } = useSWR("/api/organizador/faturacao", fetcher, { revalidateOnFocus: false });
  const router = useRouter();
  const [showTests, setShowTests] = useState(false);

  if (error) return <div className="p-4 text-white/70">Erro ao carregar faturação.</div>;
  if (!data) return <div className="p-4 text-white/70">A carregar…</div>;
  if (!data.ok) {
    if (data.error === "UNAUTHENTICATED") router.push("/login");
    if (data.error === "FORBIDDEN") router.push("/organizador");
    return <div className="p-4 text-white/70">Sem acesso.</div>;
  }

  const summary = data.summary || {};
  const events = (data.events || []).filter((e: any) => showTests || !e.isTest);

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Faturação</p>
          <h1 className="text-xl font-semibold text-white">Receita & Payouts</h1>
          <label className="flex items-center gap-1 text-white/70 text-sm mt-1">
            <input type="checkbox" checked={showTests} onChange={(e) => setShowTests(e.target.checked)} />
            Mostrar eventos de teste
          </label>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80">
          <p>Total bruto: {(summary.totalCents ?? 0) / 100} €</p>
          <p>Net: {(summary.netCents ?? 0) / 100} €</p>
          <p>Taxa plataforma: {(summary.platformFeeCents ?? 0) / 100} €</p>
          <p>Em reserva: {(summary.holdCents ?? 0) / 100} €</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2 text-sm text-white/80">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Eventos</p>
          <span className="text-white/60 text-[12px]">Filtra por “test” no toggle acima</span>
        </div>
        {events.length === 0 && <p className="text-white/60">Sem eventos.</p>}
        <div className="grid gap-2 md:grid-cols-2">
          {events.map((e: any) => {
            const kycIncomplete = e.connectStatus !== "READY";
            return (
              <div key={e.eventId} className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-white font-semibold">{e.title}</p>
                  {e.isTest && <span className="text-[11px] text-white/50">TEST</span>}
                </div>
                <p className="text-white/70 text-[12px]">Total: {(e.totalCents ?? 0) / 100} € · Vendas: {e.countSales}</p>
                <p className="text-white/60 text-[12px]">
                  Release: {e.releaseAt ? new Date(e.releaseAt).toLocaleDateString("pt-PT") : "N/D"} · Hold: {(e.holdCents ?? 0) / 100} €
                </p>
                <p className="text-white/60 text-[12px]">Connect: {e.connectStatus}</p>
                {kycIncomplete && (
                  <div className="rounded border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100">
                    Liga a Stripe/KYC para desbloquear payouts.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
