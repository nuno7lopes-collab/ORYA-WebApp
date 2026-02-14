"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import {
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
  DASHBOARD_TITLE,
} from "@/app/org/_shared/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ResourceItem = {
  id: number;
  label: string;
  capacity: number;
  isActive: boolean;
  priority: number;
};

export default function RecursosPage() {
  const { data, mutate } = useSWR<{ ok: boolean; items: ResourceItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/reservas/recursos"),
    fetcher,
  );
  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [priority, setPriority] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = data?.items ?? [];

  const handleCreate = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/reservas/recursos"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          capacity: Number(capacity) || 1,
          priority: Number(priority) || 0,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar recurso.");
      }
      setLabel("");
      setCapacity("2");
      setPriority("0");
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar recurso.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item: ResourceItem) => {
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas/recursos/${item.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar recurso.");
      }
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar recurso.");
    }
  };

  const handleEdit = async (item: ResourceItem) => {
    const nextLabel = window.prompt("Etiqueta do recurso", item.label);
    if (!nextLabel) return;
    const nextCapacity = window.prompt("Capacidade", String(item.capacity));
    const nextPriority = window.prompt("Prioridade", String(item.priority));
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas/recursos/${item.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: nextLabel,
          capacity: Number(nextCapacity) || item.capacity,
          priority: Number(nextPriority) || item.priority,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar recurso.");
      }
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar recurso.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={DASHBOARD_LABEL}>Reservas</p>
          <h1 className={DASHBOARD_TITLE}>Recursos</h1>
          <p className={DASHBOARD_MUTED}>Mesas, salas ou recursos reservaveis.</p>
        </div>
        <Link href="/organizacao/reservas" className={CTA_SECONDARY}>
          Voltar
        </Link>
      </div>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-3")}>
        <div>
          <h2 className="text-base font-semibold text-white">Novo recurso</h2>
          <p className={DASHBOARD_MUTED}>Define etiqueta e capacidade.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <input
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="Etiqueta"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="Capacidade"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
          <input
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="Prioridade"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          />
          <button type="button" className={CTA_PRIMARY} onClick={handleCreate} disabled={saving}>
            {saving ? "A guardar..." : "Criar"}
          </button>
        </div>
        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        )}
      </section>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-3")}>
        <div>
          <h2 className="text-base font-semibold text-white">Recursos ativos</h2>
          <p className={DASHBOARD_MUTED}>Define disponibilidade e prioridade.</p>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-white/60">Sem recursos.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="text-[12px] text-white/60">Capacidade {item.capacity}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={CTA_SECONDARY} onClick={() => handleEdit(item)}>
                      Editar
                    </button>
                    <button type="button" className={CTA_SECONDARY} onClick={() => handleToggle(item)}>
                      {item.isActive ? "Desativar" : "Ativar"}
                    </button>
                    <Link href={`/organizacao/reservas/recursos/${item.id}`} className={CTA_PRIMARY}>
                      Disponibilidade
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
