"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
} from "@/app/organizacao/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type PolicyItem = {
  id: number;
  name: string;
  policyType: string;
  cancellationWindowMinutes: number | null;
};

function formatWindow(minutes: number | null) {
  if (minutes == null) return "Sem cancelamento";
  if (minutes === 0) return "Até à hora";
  if (minutes % 1440 === 0) return `${minutes / 1440} dias`;
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${minutes} min`;
}

export default function PoliticasReservaPage() {
  const { data, mutate } = useSWR<{ ok: boolean; items: PolicyItem[] }>(
    "/api/organizacao/policies",
    fetcher,
  );
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("2880");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = data?.items ?? [];

  const handleCreate = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        policyType: "CUSTOM",
        cancellationWindowMinutes: minutes.trim() ? Number(minutes) : null,
      };
      const res = await fetch("/api/organizacao/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar política.");
      }
      setName("");
      setMinutes("2880");
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar política.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (policy: PolicyItem) => {
    const nextName = window.prompt("Nome da política", policy.name);
    if (!nextName) return;
    const nextMinutes = window.prompt(
      "Janela de cancelamento em minutos (vazio = sem cancelamento)",
      policy.cancellationWindowMinutes === null ? "" : String(policy.cancellationWindowMinutes),
    );
    if (nextMinutes === null) return;
    try {
      const res = await fetch(`/api/organizacao/policies/${policy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nextName.trim(),
          cancellationWindowMinutes: nextMinutes.trim() ? Number(nextMinutes) : null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar política.");
      }
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar política.");
    }
  };

  const handleDelete = async (policy: PolicyItem) => {
    const confirmed = window.confirm(`Remover a política "${policy.name}"?`);
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/organizacao/policies/${policy.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao remover política.");
      }
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover política.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className={DASHBOARD_LABEL}>Reservas</p>
        <h1 className="text-2xl font-semibold text-white">Política de cancelamento</h1>
        <p className={DASHBOARD_MUTED}>Define a regra de cancelamento usada nos serviços.</p>
      </div>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
        <div>
          <h2 className="text-base font-semibold text-white">Politica configuravel</h2>
          <p className={DASHBOARD_MUTED}>Aplica-se por servico ou como default da organização.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto]">
          <input
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="Nome da política"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="Minutos (vazio = sem cancelamento)"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
          <button type="button" className={CTA_PRIMARY} onClick={handleCreate} disabled={saving}>
            {saving ? "A criar..." : "Criar"}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-white/60">Sem políticas adicionais.</p>
          ) : (
            items.map((policy) => (
              <div key={policy.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{policy.name}</p>
                    <p className="text-[12px] text-white/60">
                      {policy.policyType} · {formatWindow(policy.cancellationWindowMinutes)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={CTA_SECONDARY} onClick={() => handleEdit(policy)}>
                      Editar
                    </button>
                    <button type="button" className={CTA_SECONDARY} onClick={() => handleDelete(policy)}>
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          <p>O reembolso segue a janela de cancelamento definida na política ativa.</p>
          <p className="mt-2">Se a janela expirar, a reserva mantém-se paga.</p>
        </div>

        <Link href="/organizacao/reservas" className={CTA_SECONDARY}>
          Voltar a Reservas
        </Link>
      </section>
    </div>
  );
}
