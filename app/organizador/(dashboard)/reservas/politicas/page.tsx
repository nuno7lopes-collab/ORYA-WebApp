"use client";

import { useState } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import {
  CTA_DANGER,
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
} from "@/app/organizador/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Policy = {
  id: number;
  name: string;
  policyType: string;
  cancellationWindowMinutes: number | null;
};

export default function PoliticasReservaPage() {
  const { data, mutate } = useSWR<{ ok: boolean; items: Policy[] }>("/api/organizador/policies", fetcher);
  const policies = data?.items ?? [];

  const [name, setName] = useState("");
  const [windowHours, setWindowHours] = useState("24");
  const [policyType, setPolicyType] = useState("CUSTOM");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editWindowHours, setEditWindowHours] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      const minutes = windowHours ? Math.max(0, Math.round(Number(windowHours) * 60)) : null;
      const res = await fetch("/api/organizador/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          policyType,
          cancellationWindowMinutes: minutes,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar política.");
      }
      setName("");
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar política.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (policyId: number) => {
    try {
      await fetch(`/api/organizador/policies/${policyId}`, { method: "DELETE" });
      mutate();
    } catch {
      // ignore
    }
  };

  const startEdit = (policy: Policy) => {
    setEditingId(policy.id);
    setEditName(policy.name);
    setEditWindowHours(
      policy.cancellationWindowMinutes != null ? String(Math.round(policy.cancellationWindowMinutes / 60)) : "",
    );
    setEditError(null);
  };

  const handleEditSave = async (policyId: number) => {
    setEditSaving(true);
    setEditError(null);
    try {
      const minutes =
        editWindowHours.trim() === ""
          ? null
          : Math.max(0, Math.round(Number(editWindowHours) * 60));
      const res = await fetch(`/api/organizador/policies/${policyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          cancellationWindowMinutes: minutes,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar política.");
      }
      setEditingId(null);
      mutate();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erro ao atualizar política.");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className={DASHBOARD_LABEL}>Reservas</p>
        <h1 className="text-2xl font-semibold text-white">Políticas de cancelamento</h1>
        <p className={DASHBOARD_MUTED}>Define regras para cancelamentos e no-show.</p>
      </div>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
        <div>
          <h2 className="text-base font-semibold text-white">Nova política</h2>
          <p className={DASHBOARD_MUTED}>Cria uma política personalizada para serviços.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-sm text-white/80">Nome</label>
            <input
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Cancelamento 24h"
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Janela (horas)</label>
            <input
              type="number"
              min="0"
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={windowHours}
              onChange={(e) => setWindowHours(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Tipo</label>
            <select
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={policyType}
              onChange={(e) => setPolicyType(e.target.value)}
            >
              <option value="CUSTOM">Personalizada</option>
              <option value="FLEXIBLE">Flexível</option>
              <option value="MODERATE">Moderada</option>
              <option value="RIGID">Rígida</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        <button type="button" className={CTA_PRIMARY} onClick={handleCreate} disabled={saving}>
          {saving ? "A guardar..." : "Criar política"}
        </button>
      </section>

      <section className={cn(DASHBOARD_CARD, "p-5")}>
        <div>
          <h2 className="text-base font-semibold text-white">Políticas ativas</h2>
          <p className={DASHBOARD_MUTED}>Aplica estas políticas aos serviços.</p>
        </div>

        <div className="mt-4 space-y-2">
          {policies.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              Ainda não tens políticas.
            </div>
          )}
          {policies.map((policy) => (
            <div key={policy.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              {editingId === policy.id ? (
                <div className="space-y-3">
                  <div className="grid gap-2 md:grid-cols-3">
                    <div>
                      <label className="text-[12px] text-white/70">Nome</label>
                      <input
                        className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[12px] text-white/70">Janela (horas)</label>
                      <input
                        type="number"
                        min="0"
                        className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                        value={editWindowHours}
                        onChange={(e) => setEditWindowHours(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[12px] text-white/70">Tipo</label>
                      <div className="mt-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/70">
                        {policy.policyType}
                      </div>
                    </div>
                  </div>

                  {editError && (
                    <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                      {editError}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={CTA_PRIMARY}
                      onClick={() => handleEditSave(policy.id)}
                      disabled={editSaving}
                    >
                      {editSaving ? "A guardar..." : "Guardar"}
                    </button>
                    <button
                      type="button"
                      className={CTA_SECONDARY}
                      onClick={() => setEditingId(null)}
                      disabled={editSaving}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{policy.name}</p>
                    <p className="text-[12px] text-white/60">
                      {policy.policyType}
                      {policy.cancellationWindowMinutes != null
                        ? ` · ${Math.round(policy.cancellationWindowMinutes / 60)}h`
                        : ""}
                    </p>
                  </div>
                  {policy.policyType === "CUSTOM" && (
                    <div className="flex items-center gap-2">
                      <button type="button" className={CTA_PRIMARY} onClick={() => startEdit(policy)}>
                        Editar
                      </button>
                      <button type="button" className={CTA_DANGER} onClick={() => handleDelete(policy.id)}>
                        Remover
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
