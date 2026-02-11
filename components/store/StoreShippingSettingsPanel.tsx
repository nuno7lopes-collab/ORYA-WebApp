"use client";

import { useEffect, useMemo, useState } from "react";

type ShippingSettings = {
  freeShippingThresholdCents: number | null;
};

type ZoneItem = {
  id: number;
  name: string;
  countries: string[];
  isActive: boolean;
};

type MethodItem = {
  id: number;
  name: string;
  baseRateCents: number | null;
  mode: "FLAT" | "VALUE_TIERS";
  isDefault: boolean;
};

type StoreShippingSettingsPanelProps = {
  endpoint: string;
  storeEnabled: boolean;
};

function parseCurrencyInput(value: string): number | null {
  const cleaned = value.replace(/[^0-9.,]/g, "").replace(",", ".");
  if (!cleaned.trim()) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function formatCurrencyInput(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

const SUPPORTED_COUNTRIES = [
  { code: "PT", label: "Portugal" },
  { code: "disabled", label: "Mais paises em breve", disabled: true },
];

async function assertJsonOk(res: Response, fallback: string) {
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || fallback);
  }
  return json;
}

export default function StoreShippingSettingsPanel({
  endpoint,
  storeEnabled,
}: StoreShippingSettingsPanelProps) {
  const [settings, setSettings] = useState<ShippingSettings | null>(null);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [methodId, setMethodId] = useState<number | null>(null);
  const [form, setForm] = useState({
    countries: "PT",
    baseRate: "",
    freeShippingThreshold: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renderBadge = (label: string, tone: "required" | "optional") => (
    <span
      className={`ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] ${
        tone === "required"
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
          : "border-white/15 bg-white/5 text-white/50"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${tone === "required" ? "bg-emerald-300" : "bg-white/40"}`}
      />
      {label}
    </span>
  );

  const zonesEndpoint = useMemo(() => endpoint.replace(/\/settings$/, "/zones"), [endpoint]);
  const methodsBase = useMemo(() => endpoint.replace(/\/settings$/, "/methods"), [endpoint]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, zonesRes] = await Promise.all([
        fetch(endpoint, { cache: "no-store" }),
        fetch(zonesEndpoint, { cache: "no-store" }),
      ]);
      const settingsJson = await settingsRes.json().catch(() => null);
      const zonesJson = await zonesRes.json().catch(() => null);
      if (!settingsRes.ok || !settingsJson?.ok) {
        throw new Error(settingsJson?.error || "Erro ao carregar settings.");
      }
      const nextSettings = settingsJson.settings as ShippingSettings;
      setSettings(nextSettings);

      const zones = zonesRes.ok && zonesJson?.ok && Array.isArray(zonesJson.items)
        ? (zonesJson.items as ZoneItem[])
        : [];
      const zone = zones.find((item) => item.isActive) ?? zones[0] ?? null;
      setZoneId(zone?.id ?? null);

      let method: MethodItem | null = null;
      if (zone) {
        const methodsRes = await fetch(`${zonesEndpoint}/${zone.id}/methods`, { cache: "no-store" });
        const methodsJson = await methodsRes.json().catch(() => null);
        const methods = methodsRes.ok && methodsJson?.ok && Array.isArray(methodsJson.items)
          ? (methodsJson.items as MethodItem[])
          : [];
        method = methods.find((item) => item.isDefault) ?? methods[0] ?? null;
        setMethodId(method?.id ?? null);
      } else {
        setMethodId(null);
      }

      const resolvedCountry =
        SUPPORTED_COUNTRIES.find(
          (country) => !country.disabled && country.code === (zone?.countries?.[0] ?? ""),
        )?.code ?? "PT";

      setForm({
        countries: resolvedCountry,
        baseRate: formatCurrencyInput(method?.baseRateCents ?? null),
        freeShippingThreshold: formatCurrencyInput(nextSettings.freeShippingThresholdCents),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [endpoint, zonesEndpoint]);

  const ensureZone = async (countries: string[]) => {
    if (zoneId) {
      const res = await fetch(`${zonesEndpoint}/${zoneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Global", countries, isActive: true }),
      });
      await assertJsonOk(res, "Erro ao atualizar zona.");
      return zoneId;
    }

    const res = await fetch(zonesEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Global", countries, isActive: true }),
    });
    const json = await assertJsonOk(res, "Erro ao criar zona.");
    const created = json.item as ZoneItem;
    setZoneId(created.id);
    return created.id;
  };

  const ensureMethod = async (zone: number, baseRateCents: number) => {
    if (methodId) {
      const res = await fetch(`${methodsBase}/${methodId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Standard",
          baseRateCents,
          mode: "FLAT",
          freeOverCents: null,
          isDefault: true,
        }),
      });
      await assertJsonOk(res, "Erro ao atualizar metodo.");
      return methodId;
    }

    const res = await fetch(`${zonesEndpoint}/${zone}/methods`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Standard",
        baseRateCents,
        mode: "FLAT",
        freeOverCents: null,
        isDefault: true,
      }),
    });
    const json = await assertJsonOk(res, "Erro ao criar metodo.");
    const created = json.item as MethodItem;
    setMethodId(created.id);
    return created.id;
  };

  const cleanupExtraShipping = async (activeZoneId: number, activeMethodId: number) => {
    const zonesRes = await fetch(zonesEndpoint, { cache: "no-store" });
    const zonesJson = await assertJsonOk(zonesRes, "Erro ao carregar zonas.");
    const zones = Array.isArray(zonesJson.items) ? (zonesJson.items as ZoneItem[]) : [];

    await Promise.all(
      zones
        .filter((zone) => zone.id !== activeZoneId && zone.isActive)
        .map(async (zone) => {
          const res = await fetch(`${zonesEndpoint}/${zone.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: false }),
          });
          await assertJsonOk(res, "Erro ao desativar zona antiga.");
        }),
    );

    const methodsRes = await fetch(`${zonesEndpoint}/${activeZoneId}/methods`, { cache: "no-store" });
    const methodsJson = await assertJsonOk(methodsRes, "Erro ao carregar metodos.");
    const methods = Array.isArray(methodsJson.items) ? (methodsJson.items as MethodItem[]) : [];

    await Promise.all(
      methods
        .filter((method) => method.id !== activeMethodId)
        .map(async (method) => {
          const res = await fetch(`${methodsBase}/${method.id}`, { method: "DELETE" });
          await assertJsonOk(res, "Erro ao remover metodo antigo.");
        }),
    );
  };

  const handleSave = async () => {
    if (!storeEnabled) return;
    const countries = form.countries ? [form.countries] : [];
    if (countries.length === 0) {
      setError("Indica pelo menos um pais.");
      return;
    }
    const baseRateCents = parseCurrencyInput(form.baseRate);
    if (baseRateCents === null) {
      setError("Portes base invalidos.");
      return;
    }
    const freeShippingThresholdCents = parseCurrencyInput(form.freeShippingThreshold);
    if (form.freeShippingThreshold.trim() && freeShippingThresholdCents === null) {
      setError("Portes gratis invalidos.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const resolvedZoneId = await ensureZone(countries);
      const resolvedMethodId = await ensureMethod(resolvedZoneId, baseRateCents);
      await cleanupExtraShipping(resolvedZoneId, resolvedMethodId);

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freeShippingThresholdCents: freeShippingThresholdCents ?? null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar settings.");
      }
      const nextSettings = json.settings as ShippingSettings;
      setSettings(nextSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-6 rounded-3xl border border-white/12 bg-white/5 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl space-y-4">
      <header className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-white">Portes simples</h2>
        <p className="text-sm text-white/65">Um valor base para a loja inteira.</p>
      </header>

      {!storeEnabled && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          A loja esta desativada globalmente.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/70">
          A carregar settings...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Paises de envio {renderBadge("Obrigatorio", "required")}
            <select
              value={form.countries}
              onChange={(e) => setForm((prev) => ({ ...prev, countries: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            >
              {SUPPORTED_COUNTRIES.map((country) => (
                <option key={country.code} value={country.code} disabled={country.disabled}>
                  {country.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Portes base (EUR) {renderBadge("Obrigatorio", "required")}
            <input
              value={form.baseRate}
              onChange={(e) => setForm((prev) => ({ ...prev, baseRate: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="4.90"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-white/70">
            Portes gratis a partir de {renderBadge("Opcional", "optional")}
            <input
              value={form.freeShippingThreshold}
              onChange={(e) => setForm((prev) => ({ ...prev, freeShippingThreshold: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="50.00"
            />
          </label>
          <div className="md:col-span-3">
            <button
              type="button"
              disabled={!storeEnabled || saving}
              onClick={() => void handleSave()}
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/85 px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_26px_rgba(255,255,255,0.2)] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
            >
              {saving ? "A guardar..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {settings ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/75">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-white/50">Gratis</span>
            <span className="font-semibold text-white">
              {formatCurrencyInput(settings.freeShippingThresholdCents) || "-"} EUR
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
