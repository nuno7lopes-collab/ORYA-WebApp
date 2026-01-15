"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
} from "@/app/organizacao/dashboardUi";

type LocationMode = "FIXED" | "CHOOSE_AT_BOOKING";
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_CURRENCY = "EUR";
const DEFAULT_LOCATION_MODE: LocationMode = "FIXED";

export default function NovoServicoPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("20");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/organizacao/servicos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          durationMinutes: DEFAULT_DURATION_MINUTES,
          unitPriceCents: Math.round(Number(unitPrice) * 100),
          currency: DEFAULT_CURRENCY,
          categoryTag: null,
          locationMode: DEFAULT_LOCATION_MODE,
          defaultLocationText: null,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar serviço.");
      }

      router.push(`/organizacao/reservas/${json.service.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar serviço.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className={DASHBOARD_LABEL}>Reservas</p>
        <h1 className="text-2xl font-semibold text-white">Novo serviço</h1>
        <p className={DASHBOARD_MUTED}>Define o serviço.</p>
      </div>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
        <div>
          <label className="text-sm text-white/80">Título</label>
          <input
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Corte + barba"
          />
        </div>

        <div>
          <label className="text-sm text-white/80">Descrição</label>
          <textarea
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Resumo"
          />
        </div>

        <div>
          <label className="text-sm text-white/80">Preço</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" className={CTA_PRIMARY} onClick={handleSubmit} disabled={saving}>
            {saving ? "A criar..." : "Criar serviço"}
          </button>
          <button type="button" className={CTA_SECONDARY} onClick={() => router.push("/organizacao/reservas")}>
            Cancelar
          </button>
        </div>
      </section>
    </div>
  );
}
