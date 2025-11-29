

"use client";

import { useState, useMemo, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { formatEuro, centsToEuro } from "@/lib/money";

type OrganizerPayload = {
  id: number;
  displayName: string | null;
  stripeAccountId: string | null;
  status: string;
  stripeChargesEnabled?: boolean;
  stripePayoutsEnabled?: boolean;
  feeMode?: "ADDED" | "INCLUDED";
  platformFeeBps?: number;
  platformFeeFixedCents?: number;
};

type OrganizerMeResponse = {
  ok: boolean;
  organizer: OrganizerPayload | null;
  profile: unknown;
  platformFees?: {
    feeBps: number;
    feeFixedCents: number;
  };
};

type PayoutSummaryResponse =
  | {
      ok: true;
      ticketsSold: number;
      revenueCents: number;
      grossCents: number;
      platformFeesCents: number;
      eventsWithSales: number;
      estimatedPayoutCents: number;
    }
  | { ok: false; error?: string };

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function OrganizerPaymentsPage() {
  const { user } = useUser();
  const { openModal } = useAuthModal();
  const { data, isLoading, mutate } = useSWR<OrganizerMeResponse>(
    user ? "/api/organizador/me" : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const organizer = data?.organizer ?? null;
  const { data: summary } = useSWR<PayoutSummaryResponse>(
    organizer?.status === "ACTIVE" ? "/api/organizador/payouts/summary" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const [ctaLoading, setCtaLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feeMode, setFeeMode] = useState<"ADDED" | "INCLUDED">("ADDED");
  const [feeBps, setFeeBps] = useState<string>("200");
  const [feeFixed, setFeeFixed] = useState<string>("0");
  const [savingFees, setSavingFees] = useState(false);
  const [feesMessage, setFeesMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!organizer) return;
    if (organizer.feeMode) setFeeMode(organizer.feeMode);
    if (typeof organizer.platformFeeBps === "number") setFeeBps(String(organizer.platformFeeBps));
    if (typeof organizer.platformFeeFixedCents === "number") setFeeFixed(String(organizer.platformFeeFixedCents));
  }, [organizer]);

  const feeText = useMemo(() => {
    if (!organizer) return "—";
    const mode = organizer.feeMode === "INCLUDED" ? "Incluída no preço" : "Taxa adicionada";
    const percSource =
      organizer.platformFeeBps != null
        ? organizer.platformFeeBps
        : data?.platformFees?.feeBps;
    const fixedSource =
      organizer.platformFeeFixedCents != null
        ? organizer.platformFeeFixedCents
        : data?.platformFees?.feeFixedCents ?? 0;
    const perc = percSource != null ? percSource / 100 : 0;
    const fixed = fixedSource ?? 0;
    const parts = [`${mode}`];
    if (perc) parts.push(`${perc.toFixed(2)}%`);
    if (fixed) parts.push(`+ ${(fixed / 100).toFixed(2)} €`);
    return parts.join(" · ");
  }, [organizer, data?.platformFees]);

  async function handleConnect() {
    setError(null);
    setCtaLoading(true);
    try {
      const res = await fetch("/api/organizador/payouts/connect", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json?.ok || !json.url) {
        setError(json?.error || "Não foi possível gerar o link de onboarding.");
        setCtaLoading(false);
        return;
      }
      window.location.href = json.url;
    } catch (err) {
      console.error(err);
      setError("Erro inesperado ao gerar link de onboarding.");
      setCtaLoading(false);
    }
  }

  async function handleSaveFees() {
    if (!organizer) return;
    setFeesMessage(null);
    setSavingFees(true);
    const feeBpsNumber = Number(feeBps);
    const feeFixedNumber = Number(feeFixed);

    if (!Number.isFinite(feeBpsNumber) || feeBpsNumber < 0) {
      setFeesMessage("Fee (%) inválida.");
      setSavingFees(false);
      return;
    }
    if (!Number.isFinite(feeFixedNumber) || feeFixedNumber < 0) {
      setFeesMessage("Fee fixa inválida.");
      setSavingFees(false);
      return;
    }

    try {
      const res = await fetch("/api/organizador/payouts/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeMode,
          platformFeeBps: Math.floor(feeBpsNumber),
          platformFeeFixedCents: Math.floor(feeFixedNumber),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setFeesMessage(json?.error || "Erro ao guardar comissões.");
      } else {
        setFeesMessage("Guardado com sucesso.");
        await mutate();
      }
    } catch (err) {
      console.error(err);
      setFeesMessage("Erro inesperado ao guardar comissões.");
    } finally {
      setSavingFees(false);
    }
  }

  const statusCard = (() => {
    if (!user) return "Precisas de iniciar sessão.";
    if (isLoading) return "A carregar...";
    if (!organizer) return "Ainda não tens conta de organizador aprovada.";
    if (organizer.status === "PENDING") return "Candidatura em revisão.";
    if (organizer.status !== "ACTIVE") return `Estado atual: ${organizer.status}`;
    if (!organizer.stripeAccountId) return "Liga a tua conta Stripe para começar a vender.";
    if (!organizer.stripeChargesEnabled) return "Conta Stripe criada. Falta concluir o onboarding.";
    return "Stripe ligado e ativo para vender.";
  })();

  const summaryData = summary && "ok" in summary && summary.ok ? summary : null;

  const stripeStatusLabel = organizer?.stripeChargesEnabled
    ? "Ativo para pagamentos"
    : organizer?.stripeAccountId
      ? "Onboarding incompleto"
      : "Por ligar";

  if (!user) {
    return (
      <main className="orya-body-bg min-h-screen text-white">
        <section className="mx-auto max-w-3xl px-4 py-10 space-y-4">
          <h1 className="text-2xl font-semibold">Pagamentos</h1>
          <p className="text-sm text-white/70">Entra para ligar a tua conta Stripe.</p>
          <button
            type="button"
            onClick={() => openModal({ mode: "login", redirectTo: "/organizador/pagamentos" })}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] font-semibold text-black shadow-lg"
          >
            Entrar / Criar conta
          </button>
        </section>
      </main>
    );
  }

  if (!organizer || organizer.status !== "ACTIVE") {
    return (
      <main className="orya-body-bg min-h-screen text-white">
        <section className="mx-auto max-w-3xl px-4 py-10 space-y-4">
          <h1 className="text-2xl font-semibold">Pagamentos</h1>
          <p className="text-sm text-white/70">
            A tua conta de organizador ainda não está ativa. Aprovação: {organizer?.status ?? "PENDING"}.
          </p>
          <Link
            href="/organizador"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-white/80 hover:bg-white/10"
          >
            Voltar ao painel do organizador
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="orya-body-bg min-h-screen text-white">
      <section className="mx-auto max-w-4xl px-4 py-10 space-y-6">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">
            Pagamentos · Stripe Connect
          </p>
          <h1 className="text-3xl font-bold leading-tight">Liga a tua conta Stripe e recebe diretamente</h1>
          <p className="text-sm text-white/70">{statusCard}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 space-y-3 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Estado Stripe</h2>
              <button
                type="button"
                onClick={() => mutate()}
                className="text-[11px] rounded-full border border-white/20 px-2 py-1 text-white/80 hover:bg-white/10"
              >
                Atualizar estado
              </button>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-sm space-y-1">
              <p className="text-white/60">Conta</p>
              <p className="font-semibold">
                {organizer.stripeAccountId
                  ? `Stripe ${organizer.stripeAccountId.slice(-6)}`
                  : "Por ligar"}
              </p>
              <p className="text-[12px] text-white/60">Charges: {organizer.stripeChargesEnabled ? "Ativo" : "Inativo"}</p>
              <p className="text-[12px] text-white/60">Payouts: {organizer.stripePayoutsEnabled ? "Ativo" : "Inativo"}</p>
              <p className="text-[12px] text-white/60">Modo de fees: {feeText}</p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                disabled={ctaLoading}
                onClick={handleConnect}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#10B981] to-[#34D399] px-4 py-2 text-sm font-semibold text-black shadow disabled:opacity-60"
              >
                {ctaLoading ? "A gerar link..." : "Ligar / continuar onboarding"}
              </button>
              {error && <p className="text-xs text-red-300">{error}</p>}
              <p className="text-[11px] text-white/60">
                O Stripe vai abrir numa nova janela para completares o KYC. Se já ligaste e faltou algo, usa o botão para
                voltar ao onboarding.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/30 backdrop-blur-xl p-4 space-y-3 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
            <h2 className="text-lg font-semibold text-white">Resumo</h2>
            <div className="rounded-2xl border border-white/12 bg-white/5 p-3 text-sm text-white/75 space-y-2">
              <p>Organizer: {organizer.displayName || `#${organizer.id}`}</p>
              <p>Estado de aprovação: {organizer.status}</p>
              <p>Stripe: {stripeStatusLabel}</p>
              <p>Recebes diretamente na tua conta Stripe; a ORYA retém a fee configurada.</p>
            </div>
            {summaryData && (
              <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/80 sm:grid-cols-2">
                <div>
                  <p className="text-white/60">Bilhetes vendidos</p>
                  <p className="text-base font-semibold text-white">{summaryData.ticketsSold}</p>
                </div>
                <div>
                  <p className="text-white/60">Receita bruta</p>
                  <p className="text-base font-semibold text-white">{formatEuro(centsToEuro(summaryData.revenueCents))}</p>
                </div>
                <div>
                  <p className="text-white/60">Total pago</p>
                  <p className="text-base font-semibold text-white">{formatEuro(centsToEuro(summaryData.grossCents))}</p>
                </div>
                <div>
                  <p className="text-white/60">Payout estimado</p>
                  <p className="text-base font-semibold text-white">
                    {formatEuro(centsToEuro(summaryData.estimatedPayoutCents))}
                  </p>
                </div>
              </div>
            )}
            <div className="text-[11px] text-white/60">
              Precisas de ajuda? Contacta a equipa ORYA para rever o onboarding ou ajustar a comissão do teu clube.
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 space-y-4 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Configuração de fees</h2>
              <p className="text-[11px] text-white/65">
                Padrão plataforma:{" "}
                {data?.platformFees
                  ? `${(data.platformFees.feeBps / 100).toFixed(2)}% + ${(data.platformFees.feeFixedCents / 100).toFixed(2)} €`
                  : "—"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveFees}
              disabled={savingFees}
              className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-sm font-semibold text-black shadow disabled:opacity-60"
            >
              {savingFees ? "A guardar..." : "Guardar fees"}
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Modo</label>
              <select
                value={feeMode}
                onChange={(e) => setFeeMode(e.target.value as "ADDED" | "INCLUDED")}
                className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              >
                <option value="ADDED">Taxa adicionada em cima</option>
                <option value="INCLUDED">Taxa incluída no preço</option>
              </select>
              <p className="text-[11px] text-white/60">Define se o cliente vê a taxa separada.</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Fee % (bps)</label>
              <input
                type="number"
                min={0}
                max={5000}
                value={feeBps}
                onChange={(e) => setFeeBps(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              />
              <p className="text-[11px] text-white/60">Basis points (200 = 2%).</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Fee fixa (cêntimos)</label>
              <input
                type="number"
                min={0}
                max={5000}
                value={feeFixed}
                onChange={(e) => setFeeFixed(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              />
              <p className="text-[11px] text-white/60">Valor fixo retido pela ORYA.</p>
            </div>
          </div>
          {feesMessage && <p className="text-[11px] text-white/80">{feesMessage}</p>}
        </div>
      </section>
    </main>
  );
}
