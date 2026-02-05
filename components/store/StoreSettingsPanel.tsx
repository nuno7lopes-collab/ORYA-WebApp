"use client";

import { useEffect, useState } from "react";

type StoreSettings = {
  supportEmail: string | null;
  supportPhone: string | null;
  returnPolicy: string | null;
  privacyPolicy: string | null;
  termsUrl: string | null;
};

type StoreSettingsPanelProps = {
  endpoint: string;
  storeEnabled: boolean;
};

async function assertJsonOk(res: Response, fallback: string) {
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || fallback);
  }
  return json;
}

function normalizeField(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}

export default function StoreSettingsPanel({ endpoint, storeEnabled }: StoreSettingsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    supportEmail: "",
    supportPhone: "",
    returnPolicy: "",
    privacyPolicy: "",
    termsUrl: "",
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao carregar definições.");
      }
      const settings = (json.settings ?? {}) as StoreSettings;
      setForm({
        supportEmail: settings.supportEmail ?? "",
        supportPhone: settings.supportPhone ?? "",
        returnPolicy: settings.returnPolicy ?? "",
        privacyPolicy: settings.privacyPolicy ?? "",
        termsUrl: settings.termsUrl ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [endpoint]);

  const handleSave = async () => {
    if (!storeEnabled || saving) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        supportEmail: normalizeField(form.supportEmail) || null,
        supportPhone: normalizeField(form.supportPhone) || null,
        returnPolicy: normalizeField(form.returnPolicy) || null,
        privacyPolicy: normalizeField(form.privacyPolicy) || null,
        termsUrl: normalizeField(form.termsUrl) || null,
      };
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await assertJsonOk(res, "Erro ao guardar definições.");
      const settings = (json.settings ?? {}) as StoreSettings;
      setForm({
        supportEmail: settings.supportEmail ?? "",
        supportPhone: settings.supportPhone ?? "",
        returnPolicy: settings.returnPolicy ?? "",
        privacyPolicy: settings.privacyPolicy ?? "",
        termsUrl: settings.termsUrl ?? "",
      });
      setMessage("Definições guardadas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      {!storeEnabled ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          A funcionalidade da loja está desativada globalmente. Define `STORE_ENABLED=true` para continuar.
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Contactos</p>
        <p className="mt-1 text-sm text-white/65">Dados usados em emails e na página de tracking.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-white/60">Email de suporte</span>
            <input
              type="email"
              value={form.supportEmail}
              onChange={(e) => setForm((prev) => ({ ...prev, supportEmail: e.target.value }))}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder="suporte@marca.pt"
              disabled={!storeEnabled || loading}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-white/60">Telefone de suporte</span>
            <input
              type="tel"
              value={form.supportPhone}
              onChange={(e) => setForm((prev) => ({ ...prev, supportPhone: e.target.value }))}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder="+351 9xx xxx xxx"
              disabled={!storeEnabled || loading}
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Políticas</p>
        <p className="mt-1 text-sm text-white/65">Informação exibida no checkout da loja.</p>
        <div className="mt-4 grid gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-white/60">URL de termos</span>
            <input
              type="url"
              value={form.termsUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, termsUrl: e.target.value }))}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder="https://.../termos"
              disabled={!storeEnabled || loading}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-white/60">Política de devoluções</span>
            <textarea
              value={form.returnPolicy}
              onChange={(e) => setForm((prev) => ({ ...prev, returnPolicy: e.target.value }))}
              className="min-h-[90px] rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder="Ex: Aceitamos devoluções até 14 dias..."
              disabled={!storeEnabled || loading}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-white/60">Política de privacidade</span>
            <textarea
              value={form.privacyPolicy}
              onChange={(e) => setForm((prev) => ({ ...prev, privacyPolicy: e.target.value }))}
              className="min-h-[90px] rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              placeholder="Ex: Os dados são usados apenas para..."
              disabled={!storeEnabled || loading}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!storeEnabled || saving || loading}
          className="rounded-full border border-white/20 bg-white/90 px-5 py-2 text-xs font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] disabled:opacity-60"
        >
          {saving ? "A guardar..." : "Guardar definições"}
        </button>
        {message ? <span className="text-xs text-emerald-200">{message}</span> : null}
        {error ? <span className="text-xs text-rose-200">{error}</span> : null}
      </div>
    </section>
  );
}
