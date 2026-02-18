"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import {
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
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
  const params = useParams();
  const orgIdRaw = Array.isArray(params?.orgId) ? params?.orgId[0] : params?.orgId;
  const organizationId = Number(orgIdRaw);
  const canonicalOrganizationId = Number.isFinite(organizationId) && organizationId > 0 ? organizationId : null;

  const { data, mutate } = useSWR<{ ok: boolean; items: ResourceItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/reservas/recursos"),
    fetcher,
  );
  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [priority, setPriority] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editCapacity, setEditCapacity] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editSavingId, setEditSavingId] = useState<number | null>(null);

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

  const handleEditStart = (item: ResourceItem) => {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditCapacity(String(item.capacity));
    setEditPriority(String(item.priority));
    setError(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditLabel("");
    setEditCapacity("");
    setEditPriority("");
    setEditSavingId(null);
  };

  const handleEditSave = async (item: ResourceItem) => {
    if (editSavingId) return;
    const nextLabel = editLabel.trim();
    if (!nextLabel) {
      setError("Indica a etiqueta do recurso.");
      return;
    }
    const nextCapacity = Number(editCapacity);
    if (!Number.isFinite(nextCapacity) || nextCapacity <= 0) {
      setError("Capacidade inválida.");
      return;
    }
    const nextPriority = Number(editPriority);
    if (!Number.isFinite(nextPriority)) {
      setError("Prioridade inválida.");
      return;
    }
    setEditSavingId(item.id);
    setError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas/recursos/${item.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: nextLabel,
          capacity: Math.round(nextCapacity),
          priority: Math.round(nextPriority),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar recurso.");
      }
      handleEditCancel();
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar recurso.");
    } finally {
      setEditSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={DASHBOARD_LABEL}>Reservas</p>
          <h1 className="text-xl font-semibold text-white">Recursos</h1>
          <p className={DASHBOARD_MUTED}>Mesas, salas ou recursos reserváveis.</p>
        </div>
        <Link href={appendOrganizationIdToHref("/org/bookings/operations", canonicalOrganizationId)} className={CTA_SECONDARY}>
          Operações
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
                {editingId === item.id ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="text-[12px] text-white/70">
                        Etiqueta
                        <input
                          className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                        />
                      </label>
                      <label className="text-[12px] text-white/70">
                        Capacidade
                        <input
                          className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                          value={editCapacity}
                          onChange={(e) => setEditCapacity(e.target.value)}
                        />
                      </label>
                      <label className="text-[12px] text-white/70">
                        Prioridade
                        <input
                          className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                          value={editPriority}
                          onChange={(e) => setEditPriority(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={CTA_PRIMARY}
                        onClick={() => handleEditSave(item)}
                        disabled={editSavingId === item.id || !editLabel.trim()}
                      >
                        {editSavingId === item.id ? "A guardar..." : "Guardar"}
                      </button>
                      <button type="button" className={CTA_SECONDARY} onClick={handleEditCancel}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.label}</p>
                      <p className="text-[12px] text-white/60">Capacidade {item.capacity} · Prioridade {item.priority}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={CTA_SECONDARY} onClick={() => handleEditStart(item)}>
                        Editar
                      </button>
                      <button type="button" className={CTA_SECONDARY} onClick={() => handleToggle(item)}>
                        {item.isActive ? "Desativar" : "Ativar"}
                      </button>
                      <Link
                        href={appendOrganizationIdToHref(`/org/bookings/resources/${item.id}`, canonicalOrganizationId)}
                        className={CTA_PRIMARY}
                      >
                        Disponibilidade
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
