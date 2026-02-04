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
  allowCancellation: boolean;
  cancellationWindowMinutes: number | null;
  cancellationPenaltyBps: number;
  allowReschedule: boolean;
  rescheduleWindowMinutes: number | null;
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
  const [penaltyBps, setPenaltyBps] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PolicyItem | null>(null);
  const [editDraft, setEditDraft] = useState<{
    name: string;
    allowCancellation: boolean;
    cancellationWindowMinutes: string;
    cancellationPenaltyBps: string;
    allowReschedule: boolean;
    rescheduleWindowMinutes: string;
    saving: boolean;
    error: string | null;
  } | null>(null);

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
        cancellationPenaltyBps: penaltyBps.trim() ? Number(penaltyBps) : 0,
        allowCancellation: true,
        allowReschedule: true,
        rescheduleWindowMinutes: minutes.trim() ? Number(minutes) : null,
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
      setPenaltyBps("0");
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar política.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (policy: PolicyItem) => {
    setEditing(policy);
    setEditDraft({
      name: policy.name,
      allowCancellation: policy.allowCancellation,
      cancellationWindowMinutes: policy.cancellationWindowMinutes === null ? "" : String(policy.cancellationWindowMinutes),
      cancellationPenaltyBps: String(policy.cancellationPenaltyBps ?? 0),
      allowReschedule: policy.allowReschedule,
      rescheduleWindowMinutes: policy.rescheduleWindowMinutes === null ? "" : String(policy.rescheduleWindowMinutes),
      saving: false,
      error: null,
    });
  };

  const closeEdit = () => {
    setEditing(null);
    setEditDraft(null);
  };

  const submitEdit = async () => {
    if (!editing || !editDraft || editDraft.saving) return;
    setEditDraft({ ...editDraft, saving: true, error: null });
    try {
      const res = await fetch(`/api/organizacao/policies/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editDraft.name.trim(),
          allowCancellation: editDraft.allowCancellation,
          cancellationWindowMinutes: editDraft.cancellationWindowMinutes.trim()
            ? Number(editDraft.cancellationWindowMinutes)
            : null,
          cancellationPenaltyBps: editDraft.cancellationPenaltyBps.trim()
            ? Number(editDraft.cancellationPenaltyBps)
            : 0,
          allowReschedule: editDraft.allowReschedule,
          rescheduleWindowMinutes: editDraft.rescheduleWindowMinutes.trim()
            ? Number(editDraft.rescheduleWindowMinutes)
            : null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao atualizar política.");
      }
      closeEdit();
      mutate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar política.";
      setEditDraft((prev) => (prev ? { ...prev, saving: false, error: message } : prev));
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
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
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
          <input
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="Penalização % (0-10000 bps; ex: 500 = 5%)"
            value={penaltyBps}
            onChange={(event) => setPenaltyBps(event.target.value)}
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
                      {policy.policyType} ·{" "}
                      {policy.allowCancellation ? formatWindow(policy.cancellationWindowMinutes) : "Cancelamento desativado"}
                      {" · "}
                      Penalização {((policy.cancellationPenaltyBps ?? 0) / 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={CTA_SECONDARY} onClick={() => startEdit(policy)}>
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
          <p>A política define cancelamento e reagendamento (janelas) e penalização.</p>
          <p className="mt-2">
            No cancelamento do cliente, as fees (ORYA + Stripe) não são devolvidas e pode haver penalização.
          </p>
        </div>

        <Link href="/organizacao/reservas" className={CTA_SECONDARY}>
          Voltar a Reservas
        </Link>
      </section>

      {editing && editDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className={cn(DASHBOARD_CARD, "w-full max-w-2xl p-5 space-y-4")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={DASHBOARD_LABEL}>Editar política</p>
                <h2 className="text-lg font-semibold text-white">{editing.name}</h2>
                <p className={DASHBOARD_MUTED}>Altera regras sem mexer em código.</p>
              </div>
              <button type="button" className={CTA_SECONDARY} onClick={closeEdit} disabled={editDraft.saving}>
                Fechar
              </button>
            </div>

            {editDraft.error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {editDraft.error}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-[12px] text-white/70">
                Nome
                <input
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={editDraft.name}
                  onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  disabled={editDraft.saving}
                />
              </label>
              <label className="text-[12px] text-white/70">
                Penalização (bps)
                <input
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={editDraft.cancellationPenaltyBps}
                  onChange={(e) => setEditDraft({ ...editDraft, cancellationPenaltyBps: e.target.value })}
                  disabled={editDraft.saving}
                />
                <p className="mt-1 text-[11px] text-white/50">
                  Ex.: 500 = 5%. Aplica-se ao preço base do serviço (sem fees).
                </p>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                <span>Permitir cancelamento</span>
                <input
                  type="checkbox"
                  checked={editDraft.allowCancellation}
                  onChange={(e) => setEditDraft({ ...editDraft, allowCancellation: e.target.checked })}
                  disabled={editDraft.saving}
                />
              </label>
              <label className="text-[12px] text-white/70">
                Janela cancelamento (min)
                <input
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  placeholder="vazio = sem cancelamento"
                  value={editDraft.cancellationWindowMinutes}
                  onChange={(e) => setEditDraft({ ...editDraft, cancellationWindowMinutes: e.target.value })}
                  disabled={editDraft.saving || !editDraft.allowCancellation}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                <span>Permitir reagendamento</span>
                <input
                  type="checkbox"
                  checked={editDraft.allowReschedule}
                  onChange={(e) => setEditDraft({ ...editDraft, allowReschedule: e.target.checked })}
                  disabled={editDraft.saving}
                />
              </label>
              <label className="text-[12px] text-white/70">
                Janela reagendamento (min)
                <input
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  placeholder="vazio = sem reagendamento"
                  value={editDraft.rescheduleWindowMinutes}
                  onChange={(e) => setEditDraft({ ...editDraft, rescheduleWindowMinutes: e.target.value })}
                  disabled={editDraft.saving || !editDraft.allowReschedule}
                />
              </label>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              <p className="font-semibold text-white">Preview</p>
              <p className="mt-2">
                Cancelamento:{" "}
                {editDraft.allowCancellation
                  ? editDraft.cancellationWindowMinutes.trim()
                    ? `até ${formatWindow(Number(editDraft.cancellationWindowMinutes))} antes`
                    : "não permitido"
                  : "desativado"}
              </p>
              <p className="mt-1">
                Reagendamento:{" "}
                {editDraft.allowReschedule
                  ? editDraft.rescheduleWindowMinutes.trim()
                    ? `até ${formatWindow(Number(editDraft.rescheduleWindowMinutes))} antes`
                    : "não permitido"
                  : "desativado"}
              </p>
              <p className="mt-1">
                Penalização: {((Number(editDraft.cancellationPenaltyBps || "0") || 0) / 100).toFixed(2)}%
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className={CTA_PRIMARY} onClick={submitEdit} disabled={editDraft.saving}>
                {editDraft.saving ? "A guardar..." : "Guardar"}
              </button>
              <button type="button" className={CTA_SECONDARY} onClick={closeEdit} disabled={editDraft.saving}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
