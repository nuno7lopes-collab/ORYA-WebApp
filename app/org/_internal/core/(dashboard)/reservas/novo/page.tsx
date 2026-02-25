"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { appendOrganizationIdToHref, parseOrganizationId, parseOrganizationIdFromPathname } from "@/lib/organizationIdUtils";
import { mapPaymentGateUiState, parseApiError } from "@/lib/payments/paymentGateUi";
import {
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
} from "@/app/org/_shared/dashboardUi";

type LocationMode = "FIXED" | "CHOOSE_AT_BOOKING";
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_CURRENCY = "EUR";
const DEFAULT_LOCATION_MODE: LocationMode = "FIXED";
const DURATION_OPTIONS = [30, 60, 90, 120];

export default function NovoServicoPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const organizationIdFromQuery = parseOrganizationId(searchParams?.get("organizationId"));
  const organizationIdFromPath = parseOrganizationIdFromPathname(pathname);
  const organizationId = organizationIdFromQuery ?? organizationIdFromPath;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("20");
  const [durationMinutes, setDurationMinutes] = useState(String(DEFAULT_DURATION_MINUTES));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCtaHref, setErrorCtaHref] = useState<string | null>(null);
  const [errorCtaLabel, setErrorCtaLabel] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Indica o título do serviço.");
      setErrorCtaHref(null);
      setErrorCtaLabel(null);
      return;
    }
    const durationValue = Number(durationMinutes);
    if (!DURATION_OPTIONS.includes(durationValue)) {
      setError("Seleciona a duração.");
      setErrorCtaHref(null);
      setErrorCtaLabel(null);
      return;
    }
    const unitPriceValue = Number(unitPrice.replace(",", "."));
    if (!Number.isFinite(unitPriceValue) || unitPriceValue < 0) {
      setError("Preço inválido.");
      setErrorCtaHref(null);
      setErrorCtaLabel(null);
      return;
    }
    setSaving(true);
    setError(null);
    setErrorCtaHref(null);
    setErrorCtaLabel(null);

    try {
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/servicos"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description,
          durationMinutes: durationValue,
          unitPriceCents: Math.round(unitPriceValue * 100),
          currency: DEFAULT_CURRENCY,
          categoryTag: null,
          locationMode: DEFAULT_LOCATION_MODE,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const parsedError = parseApiError(json, "Erro ao criar serviço.");
        const uiError = mapPaymentGateUiState({
          organizationId,
          errorCode: parsedError.errorCode,
          message: parsedError.message,
          details: parsedError.details,
        });
        setError(uiError.message);
        setErrorCtaHref(uiError.ctaHref);
        setErrorCtaLabel(uiError.ctaLabel);
        return;
      }

      const detailHref = appendOrganizationIdToHref(`/org/bookings/${json.service.id}`, organizationId);
      router.push(detailHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar serviço.");
      setErrorCtaHref(null);
      setErrorCtaLabel(null);
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
          <label className="text-sm text-white/80">Duração</label>
          <select
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
          >
            {DURATION_OPTIONS.map((option) => (
              <option key={option} value={String(option)}>
                {option} min
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm text-white/80">Preço</label>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
          <p className="text-[11px] text-white/50">Usa 0 para gratuito.</p>
        </div>

        <div>
          <label className="text-sm text-white/80">Descrição</label>
          <textarea
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Resumo (opcional)"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            <p>{error}</p>
            {errorCtaHref && errorCtaLabel ? (
              <button
                type="button"
                onClick={() => router.push(errorCtaHref)}
                className="mt-3 rounded-full border border-red-200/50 bg-red-200/15 px-3 py-1.5 text-xs font-semibold text-red-50 transition hover:bg-red-200/25"
              >
                {errorCtaLabel}
              </button>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" className={CTA_PRIMARY} onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving ? "A criar..." : "Criar serviço"}
          </button>
          <button
            type="button"
            className={CTA_SECONDARY}
            onClick={() => router.push(appendOrganizationIdToHref("/org/bookings", organizationId))}
          >
            Cancelar
          </button>
        </div>
      </section>
    </div>
  );
}
