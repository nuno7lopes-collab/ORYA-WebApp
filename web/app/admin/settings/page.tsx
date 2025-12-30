"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";

type FeesResponse =
  | {
      ok: true;
      orya: { feeBps: number; feeFixedCents: number };
      stripe: { feeBps: number; feeFixedCents: number; region: string };
    }
  | { ok: false; error?: string };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatPercentFromBps(bps: number) {
  return (bps / 100).toFixed(2) + " %";
}

function formatEur(cents: number) {
  return (cents / 100).toFixed(2) + " €";
}

function computeFee(baseCents: number, feeBps: number, feeFixedCents: number) {
  return Math.round((baseCents * feeBps) / 10_000) + feeFixedCents;
}

export default function AdminSettingsPage() {
  const { data, isLoading, mutate } = useSWR<FeesResponse>("/api/admin/fees", fetcher, {
    revalidateOnFocus: false,
  });

  const [platformPercent, setPlatformPercent] = useState("8.00");
  const [platformFixed, setPlatformFixed] = useState("0.30");
  const [stripePercent, setStripePercent] = useState("1.40");
  const [stripeFixed, setStripeFixed] = useState("0.25");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (data && data.ok) {
      setPlatformPercent((data.orya.feeBps / 100).toFixed(2));
      setPlatformFixed((data.orya.feeFixedCents / 100).toFixed(2));
      setStripePercent((data.stripe.feeBps / 100).toFixed(2));
      setStripeFixed((data.stripe.feeFixedCents / 100).toFixed(2));
    }
  }, [data]);

  const parsedPlatformBps = useMemo(
    () => Math.max(0, Math.round(Number(platformPercent || "0") * 100)),
    [platformPercent],
  );
  const parsedPlatformFixedCents = useMemo(
    () => Math.max(0, Math.round(Number(platformFixed || "0") * 100)),
    [platformFixed],
  );
  const parsedStripeBps = useMemo(() => Math.max(0, Math.round(Number(stripePercent || "0") * 100)), [stripePercent]);
  const parsedStripeFixedCents = useMemo(
    () => Math.max(0, Math.round(Number(stripeFixed || "0") * 100)),
    [stripeFixed],
  );

  const sampleBase = 1000; // 10€ em cêntimos
  const oryaFeeCents = computeFee(sampleBase, parsedPlatformBps, parsedPlatformFixedCents);
  const stripeFeeOnTopCents = computeFee(sampleBase + oryaFeeCents, parsedStripeBps, parsedStripeFixedCents);
  const stripeFeeIncludedCents = computeFee(sampleBase, parsedStripeBps, parsedStripeFixedCents);
  const organizerNetOnTop = Math.max(0, sampleBase - stripeFeeOnTopCents);
  const organizerNetIncluded = Math.max(0, sampleBase - oryaFeeCents - stripeFeeIncludedCents);

  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformFeeBps: parsedPlatformBps,
          platformFeeFixedCents: parsedPlatformFixedCents,
          stripeFeeBpsEu: parsedStripeBps,
          stripeFeeFixedCentsEu: parsedStripeFixedCents,
        }),
      });
      const json = (await res.json()) as FeesResponse;
      if (!res.ok || !json || !("ok" in json) || !json.ok) {
        const msg = (typeof json === "object" && json && "error" in json && typeof json.error === "string")
          ? json.error
          : "Não foi possível guardar as taxas.";
        setSaveError(msg);
        return;
      }
      setSaveSuccess("Taxas guardadas. Já estão a ser usadas nos cálculos.");
      await mutate();
    } catch (err) {
      console.error("Erro a guardar taxas", err);
      setSaveError("Erro inesperado ao guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="orya-body-bg min-h-screen text-white pb-16">
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-extrabold tracking-[0.15em]">
              AD
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Admin · Taxas</p>
              <p className="text-sm text-white/85">Overview de fees</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <Link
              href="/admin"
              className="rounded-full border border-white/20 px-3 py-1.5 text-white/75 transition-colors hover:bg-white/10"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl space-y-6 px-5 pt-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Taxas configuradas</h1>
          <p className="max-w-3xl text-sm text-white/70">
            Valores globais definidos pela ORYA. O organizador só decide quem suporta a taxa (cliente paga ou
            organizador absorve). A taxa da Stripe pode variar por método/pais; aqui controlas o valor base usado nos
            cálculos e previews.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/12 bg-white/5 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">ORYA</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Taxa da plataforma</h2>
            <div className="mt-3 space-y-3 text-sm text-white/80">
              <label className="flex items-center justify-between gap-3">
                <span>Percentual</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={platformPercent}
                  onChange={(e) => setPlatformPercent(e.target.value)}
                  className="w-28 rounded-md border border-white/15 bg-black/30 px-2 py-1 text-right text-sm outline-none focus:border-white/60"
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>Fixo</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={platformFixed}
                  onChange={(e) => setPlatformFixed(e.target.value)}
                  className="w-28 rounded-md border border-white/15 bg-black/30 px-2 py-1 text-right text-sm outline-none focus:border-white/60"
                />
              </label>
              <p className="text-[11px] text-white/60">
                Estes valores são usados em todos os cálculos (checkout, previews, dashboards) em tempo real.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/12 bg-white/5 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Stripe</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Taxa base ({data && data.ok ? data.stripe.region : "UE"})</h2>
            <div className="mt-3 space-y-3 text-sm text-white/80">
              <label className="flex items-center justify-between gap-3">
                <span>Percentual</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={stripePercent}
                  onChange={(e) => setStripePercent(e.target.value)}
                  className="w-28 rounded-md border border-white/15 bg-black/30 px-2 py-1 text-right text-sm outline-none focus:border-white/60"
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>Fixo</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={stripeFixed}
                  onChange={(e) => setStripeFixed(e.target.value)}
                  className="w-28 rounded-md border border-white/15 bg-black/30 px-2 py-1 text-right text-sm outline-none focus:border-white/60"
                />
              </label>
              <p className="text-[11px] text-white/60">
                Valor informativo para cartões UE. O valor real é apurado em cada transação pela Stripe.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/12 bg-white/5 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h3 className="text-sm font-semibold text-white">Exemplo rápido (bilhete 10 €)</h3>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-60"
            >
              {saving ? "A guardar…" : "Guardar alterações"}
            </button>
          </div>

          <div className="grid gap-3 pt-3 text-sm text-white/85 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="mb-2 text-xs uppercase tracking-[0.15em] text-white/60">Cliente paga</p>
              <p className="flex justify-between">
                <span>Preço base</span>
                <span>10,00 €</span>
              </p>
              <p className="flex justify-between">
                <span>Taxa ORYA</span>
                <span>{formatEur(oryaFeeCents)}</span>
              </p>
              <p className="flex justify-between">
                <span suppressHydrationWarning>Taxa Stripe (estimada)</span>
                <span suppressHydrationWarning>{formatEur(stripeFeeOnTopCents)}</span>
              </p>
              <p className="flex justify-between font-semibold">
                <span>Total cliente</span>
                <span>{formatEur(sampleBase + oryaFeeCents)}</span>
              </p>
              <p className="flex justify-between text-white/70">
                <span>Recebe organizador (após Stripe)</span>
                <span>{formatEur(organizerNetOnTop)}</span>
              </p>
              <p className="mt-1 text-[11px] text-white/60">Stripe cobra sobre o total (bilhete + taxa ORYA).</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="mb-2 text-xs uppercase tracking-[0.15em] text-white/60">Organizador absorve (INCLUDED)</p>
              <p className="flex justify-between">
                <span>Preço mostrado</span>
                <span>10,00 €</span>
              </p>
              <p className="flex justify-between">
                <span>Taxa ORYA</span>
                <span>{formatEur(oryaFeeCents)}</span>
              </p>
              <p className="flex justify-between">
                <span suppressHydrationWarning>Taxa Stripe (estimada)</span>
                <span suppressHydrationWarning>{formatEur(stripeFeeIncludedCents)}</span>
              </p>
              <p className="flex justify-between font-semibold">
                <span>Recebe organizador (após Stripe)</span>
                <span>{formatEur(organizerNetIncluded)}</span>
              </p>
              <p className="text-[11px] text-white/60">A taxa ORYA é deduzida ao valor. Stripe deduz a sua própria taxa no payout.</p>
            </div>
          </div>
          {isLoading && <p className="mt-3 text-[11px] text-white/60">A carregar valores...</p>}
          {saveSuccess && <p className="mt-3 text-[11px] text-emerald-300">{saveSuccess}</p>}
          {saveError && <p className="mt-3 text-[11px] text-red-300">{saveError}</p>}
          {data && !data.ok && <p className="mt-3 text-[11px] text-red-300">Erro a carregar fees.</p>}
        </div>
      </section>
    </main>
  );
}
