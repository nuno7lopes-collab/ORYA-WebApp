"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";

type FinanceAlertsPanelProps = {
  organization: {
    id?: number | null;
    alertsEmail?: string | null;
    alertsSalesEnabled?: boolean | null;
    alertsPayoutEnabled?: boolean | null;
  } | null;
  canEdit?: boolean;
  onSaved?: () => void;
};

export default function FinanceAlertsPanel({ organization, canEdit = false, onSaved }: FinanceAlertsPanelProps) {
  const [alertsEmail, setAlertsEmail] = useState("");
  const [alertsSalesEnabled, setAlertsSalesEnabled] = useState(true);
  const [alertsPayoutEnabled, setAlertsPayoutEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!organization) return;
    setAlertsEmail(organization.alertsEmail ?? "");
    setAlertsSalesEnabled(organization.alertsSalesEnabled ?? true);
    setAlertsPayoutEnabled(organization.alertsPayoutEnabled ?? false);
    setMessage(null);
  }, [organization]);

  const handleSave = async () => {
    if (!canEdit) return;
    const organizationId = organization?.id ?? null;
    if (!organizationId) {
      setMessage("Seleciona uma organização primeiro.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/organizacao/me?organizationId=${organizationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertsEmail: alertsEmail.trim() || null,
          alertsSalesEnabled,
          alertsPayoutEnabled,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Não foi possível guardar alertas.");
      }
      setMessage("Alertas atualizados.");
      if (onSaved) onSaved();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao guardar alertas.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/92 backdrop-blur-3xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-white">Alertas financeiros</h3>
          <p className="text-[12px] text-white/65">Configura email e notificações críticas.</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canEdit || saving}
          className={cn(CTA_PRIMARY, "px-4 py-2 text-[11px] disabled:opacity-50")}
        >
          {saving ? "A guardar..." : "Guardar"}
        </button>
      </div>

      {!canEdit && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/70">
          Apenas owners/admins podem editar alertas.
        </div>
      )}

      <label className="flex flex-col gap-1 text-[12px] text-white/70">
        Email de alertas
        <input
          type="email"
          value={alertsEmail}
          onChange={(event) => setAlertsEmail(event.target.value)}
          placeholder="ex: financeiro@clube.pt"
          className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white placeholder:text-white/40"
          disabled={!canEdit}
        />
      </label>

      <div className="grid gap-2 sm:grid-cols-2 text-[12px] text-white/70">
        <button
          type="button"
          onClick={() => canEdit && setAlertsSalesEnabled((prev) => !prev)}
          className={cn(
            "rounded-2xl border px-3 py-2 text-left transition",
            alertsSalesEnabled ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-white/5",
            !canEdit && "opacity-60 cursor-not-allowed",
          )}
        >
          Alertas de vendas
          <p className="text-[11px] text-white/60">Recebe avisos de vendas relevantes.</p>
        </button>
        <button
          type="button"
          onClick={() => canEdit && setAlertsPayoutEnabled((prev) => !prev)}
          className={cn(
            "rounded-2xl border px-3 py-2 text-left transition",
            alertsPayoutEnabled ? "border-sky-400/50 bg-sky-500/10 text-sky-100" : "border-white/10 bg-white/5",
            !canEdit && "opacity-60 cursor-not-allowed",
          )}
        >
          Alertas de payouts
          <p className="text-[11px] text-white/60">Falhas e ações pendentes no Stripe.</p>
        </button>
      </div>

      {message && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/70">
          {message}
        </div>
      )}

      <p className="text-[11px] text-white/60">
        Os alertas usam as definições da organização e notificações internas.
      </p>
    </section>
  );
}
