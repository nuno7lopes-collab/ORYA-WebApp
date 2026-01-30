"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { AdminLayout } from "@/app/admin/components/AdminLayout";
import { AdminPageHeader } from "@/app/admin/components/AdminPageHeader";

type FeesResponse =
  | {
      ok: true;
      orya: { feeBps: number; feeFixedCents: number };
      stripe: { feeBps: number; feeFixedCents: number; region: string };
    }
  | { ok: false; error?: string };
type PlatformEmailResponse =
  | { ok: true; email: string | null }
  | { ok: false; error?: string };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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
  const {
    data: platformEmailData,
    isLoading: isPlatformEmailLoading,
    mutate: mutatePlatformEmail,
  } = useSWR<PlatformEmailResponse>("/api/admin/config/platform-email", fetcher, {
    revalidateOnFocus: false,
  });

  const [platformPercent, setPlatformPercent] = useState("8.00");
  const [platformFixed, setPlatformFixed] = useState("0.30");
  const [stripePercent, setStripePercent] = useState("1.40");
  const [stripeFixed, setStripeFixed] = useState("0.25");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [platformEmail, setPlatformEmail] = useState("");
  const [platformEmailSaving, setPlatformEmailSaving] = useState(false);
  const [platformEmailError, setPlatformEmailError] = useState<string | null>(null);
  const [platformEmailSuccess, setPlatformEmailSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (data && data.ok) {
      setPlatformPercent((data.orya.feeBps / 100).toFixed(2));
      setPlatformFixed((data.orya.feeFixedCents / 100).toFixed(2));
      setStripePercent((data.stripe.feeBps / 100).toFixed(2));
      setStripeFixed((data.stripe.feeFixedCents / 100).toFixed(2));
    }
  }, [data]);

  useEffect(() => {
    if (platformEmailData && platformEmailData.ok) {
      setPlatformEmail(platformEmailData.email ?? "");
    }
  }, [platformEmailData]);

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
  const organizationNetOnTop = Math.max(0, sampleBase - stripeFeeOnTopCents);
  const organizationNetIncluded = Math.max(0, sampleBase - oryaFeeCents - stripeFeeIncludedCents);

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

  const handleSavePlatformEmail = async () => {
    setPlatformEmailError(null);
    setPlatformEmailSuccess(null);
    setPlatformEmailSaving(true);
    try {
      const res = await fetch("/api/admin/config/platform-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: platformEmail.trim() }),
      });
      const json = (await res.json().catch(() => null)) as PlatformEmailResponse | null;
      if (!res.ok || !json || !("ok" in json) || !json.ok) {
        const msg = (json && "error" in json && typeof json.error === "string")
          ? json.error
          : "Não foi possível guardar o email.";
        setPlatformEmailError(msg);
        return;
      }
      setPlatformEmailSuccess("Email da plataforma atualizado.");
      await mutatePlatformEmail();
    } catch (err) {
      console.error("Erro a guardar email da plataforma", err);
      setPlatformEmailError("Erro inesperado ao guardar.");
    } finally {
      setPlatformEmailSaving(false);
    }
  };

  return (
    <AdminLayout title="Configurações" subtitle="Taxas globais de plataforma e Stripe.">
      <section className="space-y-6">
        <AdminPageHeader
          title="Taxas configuradas"
          subtitle="Valores globais definidos pela ORYA e Stripe para cálculos internos e previews."
          eyebrow="Admin • Configurações"
        />

        <div className="flex flex-col gap-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Pagamentos</p>
          <h2 className="text-lg font-semibold text-white/90">Parâmetros atuais</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="admin-card p-4">
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
                  className="admin-input w-28 text-right"
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
                  className="admin-input w-28 text-right"
                />
              </label>
              <p className="text-[11px] text-white/60">
                Estes valores são usados em todos os cálculos (checkout, previews, dashboards) em tempo real.
              </p>
            </div>
          </div>

          <div className="admin-card p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Stripe</p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              Taxa base ({data && data.ok ? data.stripe.region : "UE"})
            </h2>
            <div className="mt-3 space-y-3 text-sm text-white/80">
              <label className="flex items-center justify-between gap-3">
                <span>Percentual</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={stripePercent}
                  onChange={(e) => setStripePercent(e.target.value)}
                  className="admin-input w-28 text-right"
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
                  className="admin-input w-28 text-right"
                />
              </label>
              <p className="text-[11px] text-white/60">
                Valor informativo para cartões UE. O valor real é apurado em cada transação pela Stripe.
              </p>
            </div>
          </div>
        </div>

        <div className="admin-card p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Operações</p>
              <h3 className="text-sm font-semibold text-white">Gestão de pagamentos</h3>
              <p className="text-[12px] text-white/60">
                Acede rapidamente às secções financeiras para reprocessar, libertar ou reembolsar.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/finance#pagamentos" className="admin-button-secondary px-3 py-1.5 text-[11px]">
                Pagamentos
              </Link>
              <Link href="/admin/finance#payouts" className="admin-button-secondary px-3 py-1.5 text-[11px]">
                Payouts
              </Link>
              <Link href="/admin/finance#reembolsos" className="admin-button-secondary px-3 py-1.5 text-[11px]">
                Reembolsos
              </Link>
            </div>
          </div>
        </div>

        <div className="admin-card p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h3 className="text-sm font-semibold text-white">Exemplo rápido (bilhete 10 €)</h3>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="admin-button px-3 py-1.5 text-sm disabled:opacity-60"
            >
              {saving ? "A guardar…" : "Guardar alterações"}
            </button>
          </div>

          <div className="grid gap-3 pt-3 text-sm text-white/85 md:grid-cols-2">
            <div className="admin-card-soft p-3">
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
                <span>Recebe organização (após Stripe)</span>
                <span>{formatEur(organizationNetOnTop)}</span>
              </p>
              <p className="mt-1 text-[11px] text-white/60">Stripe cobra sobre o total.</p>
            </div>
            <div className="admin-card-soft p-3">
              <p className="mb-2 text-xs uppercase tracking-[0.15em] text-white/60">Organização absorve (INCLUDED)</p>
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
                <span>Recebe organização (após Stripe)</span>
                <span>{formatEur(organizationNetIncluded)}</span>
              </p>
              <p className="text-[11px] text-white/60">Taxa ORYA deduzida. Stripe deduz no payout.</p>
            </div>
          </div>
          {isLoading && <p className="mt-3 text-[11px] text-white/60">A carregar valores...</p>}
          {saveSuccess && <p className="mt-3 text-[11px] text-emerald-300">{saveSuccess}</p>}
          {saveError && <p className="mt-3 text-[11px] text-red-300">{saveError}</p>}
          {data && !data.ok && <p className="mt-3 text-[11px] text-red-300">Erro a carregar fees.</p>}
        </div>

        <div className="admin-card p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Identidade</p>
              <h3 className="text-sm font-semibold text-white">Email oficial da plataforma</h3>
              <p className="text-[12px] text-white/60">
                Endereço usado em comunicações oficiais e validações internas.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSavePlatformEmail}
              disabled={platformEmailSaving || isPlatformEmailLoading}
              className="admin-button px-3 py-1.5 text-sm disabled:opacity-60"
            >
              {platformEmailSaving ? "A guardar…" : "Guardar email"}
            </button>
          </div>

          <div className="mt-3 space-y-3 text-sm text-white/85">
            <label className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <span>Email da plataforma</span>
              <input
                type="email"
                value={platformEmail}
                onChange={(e) => setPlatformEmail(e.target.value)}
                placeholder="admin@orya.pt"
                className="admin-input w-full md:w-72"
                disabled={isPlatformEmailLoading}
              />
            </label>
            {isPlatformEmailLoading && (
              <p className="text-[12px] text-white/60">A carregar email atual…</p>
            )}
            {platformEmailError && (
              <p className="text-[12px] text-red-200">{platformEmailError}</p>
            )}
            {platformEmailSuccess && (
              <p className="text-[12px] text-emerald-200">{platformEmailSuccess}</p>
            )}
          </div>
        </div>
      </section>
    </AdminLayout>
  );
}
