"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";

type SettingsResponse =
  | { ok: true; feeBps: number; feeFixedCents: number }
  | { ok: false; error?: string };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function AdminSettingsPage() {
  const { data, isLoading, mutate } = useSWR<SettingsResponse>("/api/admin/settings/platform", fetcher, {
    revalidateOnFocus: false,
  });

  const [feeBps, setFeeBps] = useState<number | string>(data && "ok" in data && data.ok ? data.feeBps : 200);
  const [feeFixed, setFeeFixed] = useState<number | string>(
    data && "ok" in data && data.ok ? data.feeFixedCents : 0,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings/platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeBps: Number(feeBps),
          feeFixedCents: Number(feeFixed),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setMessage(json?.error || "Erro ao guardar configurações.");
      } else {
        setMessage("Guardado com sucesso.");
        await mutate();
      }
    } catch (err) {
      console.error(err);
      setMessage("Erro inesperado ao guardar.");
    } finally {
      setSaving(false);
    }
  }

  const feeBpsValue = data && "ok" in data && data.ok ? data.feeBps : 200;
  const feeFixedValue = data && "ok" in data && data.ok ? data.feeFixedCents : 0;

  return (
    <main className="orya-body-bg min-h-screen text-white pb-16">
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-extrabold tracking-[0.15em]">
              AD
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Admin · Configuração</p>
              <p className="text-sm text-white/85">Taxas da plataforma</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <Link
              href="/admin"
              className="rounded-full border border-white/20 px-3 py-1.5 text-white/75 hover:bg-white/10 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 pt-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Taxas da plataforma</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/70">
            Define o fee padrão aplicado a eventos/organizadores. Valores guardados em DB (platform_settings).
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <form className="space-y-4" onSubmit={handleSave}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] text-white/70">Fee (%) em basis points</label>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={feeBps}
                  onChange={(e) => setFeeBps(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                />
                <p className="mt-1 text-[10px] text-white/60">Ex.: 200 bps = 2%.</p>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-white/70">Fee fixa (cêntimos)</label>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={feeFixed}
                  onChange={(e) => setFeeFixed(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                />
                <p className="mt-1 text-[10px] text-white/60">Ex.: 50 = 0,50 €.</p>
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-4 py-2 text-sm font-semibold text-black shadow disabled:opacity-60"
            >
              {saving ? "A guardar..." : "Guardar"}
            </button>
            {message && <p className="text-[11px] text-white/80">{message}</p>}
          </form>
        </div>

        <div className="text-[11px] text-white/60">
          <p>Valores atuais (DB):</p>
          <p>Percentagem (bps): {feeBpsValue}</p>
          <p>Fixo (cêntimos): {feeFixedValue}</p>
        </div>
      </section>
    </main>
  );
}
