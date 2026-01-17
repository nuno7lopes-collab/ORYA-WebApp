// app/organizacao/tournaments/[id]/finance/page.tsx
import { notFound, redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabaseServer";
import ObjectiveSubnav from "@/app/organizacao/ObjectiveSubnav";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

type PageProps = { params: Promise<{ id: string }> };

async function fetchFinance(tournamentId: number, cookieHeader: string | null) {
  const baseUrl = getAppBaseUrl();
  const res = await fetch(`${baseUrl}/api/organizacao/tournaments/${tournamentId}/finance`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function TournamentFinancePage({ params }: PageProps) {
  const resolved = await params;
  const tournamentId = Number(resolved.id);
  if (!Number.isFinite(tournamentId)) notFound();

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) redirect("/login");

  const baseUrl = getAppBaseUrl();
  const cookie = (await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: "" } })).headers.get("set-cookie");
  const finance = await fetchFinance(tournamentId, cookie);
  if (!finance?.ok) {
    if (finance?.error === "FORBIDDEN") redirect("/organizacao");
    notFound();
  }

  const summary = finance.summary || {};
  const recent = finance.recent || [];
  const kycIncomplete = summary.payoutMode !== "PLATFORM" && (summary.holdReason || summary.holdCents > 0);
  const payoutLabel =
    summary.payoutMode === "PLATFORM"
      ? "Conta ORYA"
      : summary.payoutMode === "ORGANIZATION"
        ? "Conta do clube"
        : "N/D";

  return (
    <div className="space-y-4">
      <ObjectiveSubnav objective="analyze" activeId="financas" />
      <div className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-4">
        <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Torneio</p>
          <h1 className="text-xl font-semibold text-white">Receita & Payouts</h1>
          <p className="text-white/70 text-sm">
            Disponível: {summary.releaseAt ? new Date(summary.releaseAt).toLocaleDateString("pt-PT") : "N/D"}
          </p>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80">
          <p>Total bruto: {(summary.totalCents ?? 0) / 100} €</p>
          <p>Net: {(summary.netCents ?? 0) / 100} €</p>
          <p>Taxa plataforma: {(summary.platformFeeCents ?? 0) / 100} €</p>
        </div>
        </div>

        {kycIncomplete && (
          <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 p-3 text-sm text-amber-100">
            <p className="font-semibold">Stripe/KYC pendente</p>
            <p className="text-amber-100/80 text-[12px]">Liga a Stripe para payouts.</p>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1 text-sm text-white/80">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Resumo</p>
            <p>Vendas: {summary.countSales ?? 0}</p>
            <p>Em reserva: {(summary.holdCents ?? 0) / 100} € {summary.holdReason ? `(${summary.holdReason})` : ""}</p>
            <p>Modo payout: {payoutLabel}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1 text-sm text-white/80">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Recentes</p>
            {recent.length === 0 && <p className="text-white/60 text-sm">Sem vendas.</p>}
            {recent.map((r: any) => (
              <div key={r.id} className="rounded border border-white/10 bg-black/30 px-2 py-1 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm">{r.purchaseId || r.paymentIntentId || `#${r.id}`}</p>
                  <p className="text-[11px] text-white/60">{new Date(r.createdAt).toLocaleString("pt-PT")}</p>
                </div>
                <p className="text-white font-semibold text-sm">{(r.totalCents ?? 0) / 100} €</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
