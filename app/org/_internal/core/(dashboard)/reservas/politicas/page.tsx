"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";

import { useEffect, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  CTA_PRIMARY,
  CTA_SECONDARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
  DASHBOARD_MUTED,
} from "@/app/org/_shared/dashboardUi";

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
  guestBookingAllowed: boolean;
  noShowFeeCents: number;
};

type PoliciesPayload = {
  ok: boolean;
  items: PolicyItem[];
  organizationPolicy?: {
    orgRescheduleWindowMinutes?: number | null;
  } | null;
};

function formatWindow(minutes: number | null) {
  if (minutes == null) return "Sem cancelamento";
  if (minutes === 0) return "Até à hora";
  if (minutes % 1440 === 0) return `${minutes / 1440} dias`;
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${minutes} min`;
}

export default function PoliticasReservaPage() {
  const params = useParams();
  const orgIdRaw = Array.isArray(params?.orgId) ? params?.orgId[0] : params?.orgId;
  const organizationId = Number(orgIdRaw);
  const canonicalOrganizationId = Number.isFinite(organizationId) && organizationId > 0 ? organizationId : null;

  const { data, mutate } = useSWR<PoliciesPayload>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/policies"),
    fetcher,
  );
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("2880");
  const [guestBookingAllowed, setGuestBookingAllowed] = useState(false);
  const [noShowFeeCents, setNoShowFeeCents] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [globalPolicySaving, setGlobalPolicySaving] = useState(false);
  const [globalPolicyError, setGlobalPolicyError] = useState<string | null>(null);
  const [orgRescheduleWindowMinutes, setOrgRescheduleWindowMinutes] = useState("240");
  const [editing, setEditing] = useState<PolicyItem | null>(null);
  const [editDraft, setEditDraft] = useState<{
    name: string;
    allowCancellation: boolean;
    cancellationWindowMinutes: string;
    allowReschedule: boolean;
    rescheduleWindowMinutes: string;
    guestBookingAllowed: boolean;
    noShowFeeCents: string;
    saving: boolean;
    error: string | null;
  } | null>(null);

  const items = data?.items ?? [];

  const resolvedOrgRescheduleWindowMinutes =
    typeof data?.organizationPolicy?.orgRescheduleWindowMinutes === "number"
      ? data.organizationPolicy.orgRescheduleWindowMinutes
      : 240;

  useEffect(() => {
    setOrgRescheduleWindowMinutes(String(resolvedOrgRescheduleWindowMinutes));
  }, [resolvedOrgRescheduleWindowMinutes]);

  const handleCreate = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        policyType: "CUSTOM",
        cancellationWindowMinutes: minutes.trim() ? Number(minutes) : null,
        cancellationPenaltyBps: 0,
        allowCancellation: true,
        allowReschedule: true,
        rescheduleWindowMinutes: minutes.trim() ? Number(minutes) : null,
        guestBookingAllowed,
        noShowFeeCents: noShowFeeCents.trim() ? Number(noShowFeeCents) : 0,
      };
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/policies"), {
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
      setGuestBookingAllowed(false);
      setNoShowFeeCents("0");
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
      allowReschedule: policy.allowReschedule,
      rescheduleWindowMinutes: policy.rescheduleWindowMinutes === null ? "" : String(policy.rescheduleWindowMinutes),
      guestBookingAllowed: Boolean(policy.guestBookingAllowed),
      noShowFeeCents: String(policy.noShowFeeCents ?? 0),
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
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/policies/${editing.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editDraft.name.trim(),
          allowCancellation: editDraft.allowCancellation,
          cancellationWindowMinutes: editDraft.cancellationWindowMinutes.trim()
            ? Number(editDraft.cancellationWindowMinutes)
            : null,
          cancellationPenaltyBps: 0,
          allowReschedule: editDraft.allowReschedule,
          rescheduleWindowMinutes: editDraft.rescheduleWindowMinutes.trim()
            ? Number(editDraft.rescheduleWindowMinutes)
            : null,
          guestBookingAllowed: editDraft.guestBookingAllowed,
          noShowFeeCents: editDraft.noShowFeeCents.trim() ? Number(editDraft.noShowFeeCents) : 0,
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

  const saveGlobalPolicy = async () => {
    if (globalPolicySaving) return;
    setGlobalPolicySaving(true);
    setGlobalPolicyError(null);
    try {
      const parsed = Number(orgRescheduleWindowMinutes);
      if (!Number.isFinite(parsed)) {
        throw new Error("Janela global de reagendamento inválida.");
      }
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/policies"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgRescheduleWindowMinutes: Math.max(0, Math.round(parsed)) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "Erro ao atualizar política global.");
      }
      mutate();
    } catch (err) {
      setGlobalPolicyError(err instanceof Error ? err.message : "Erro ao atualizar política global.");
    } finally {
      setGlobalPolicySaving(false);
    }
  };

  const handleDelete = async (policy: PolicyItem) => {
    const confirmed = window.confirm(`Remover a política "${policy.name}"?`);
    if (!confirmed) return;
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/policies/${policy.id}`), { method: "DELETE" });
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
        <div className="grid gap-3 md:grid-cols-[1.6fr_1fr_auto]">
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
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
            <span>Permitir reservas de convidado</span>
            <input
              type="checkbox"
              checked={guestBookingAllowed}
              onChange={(event) => setGuestBookingAllowed(event.target.checked)}
              disabled={saving}
            />
          </label>
          <input
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="No-show fee (cêntimos)"
            value={noShowFeeCents}
            onChange={(event) => setNoShowFeeCents(event.target.value)}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-[1.6fr_auto]">
          <input
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="Janela global de reagendamento da organização (min)"
            value={orgRescheduleWindowMinutes}
            onChange={(event) => setOrgRescheduleWindowMinutes(event.target.value)}
          />
          <button type="button" className={CTA_SECONDARY} onClick={saveGlobalPolicy} disabled={globalPolicySaving}>
            {globalPolicySaving ? "A guardar..." : "Guardar política global"}
          </button>
        </div>
        {globalPolicyError && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {globalPolicyError}
          </div>
        )}

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
                      Penalizacao 0%
                      {" · "}
                      {policy.guestBookingAllowed ? "Convidados permitidos" : "Convidados bloqueados"}
                      {" · "}
                      No-show {policy.noShowFeeCents ?? 0} cêntimos
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
          <p>A politica define cancelamento e reagendamento (janelas) com penalizacao fixa de 0%.</p>
          <p className="mt-2">
            No cancelamento do cliente, retem-se apenas a fee real de processamento do pagamento.
          </p>
        </div>

        <Link href={appendOrganizationIdToHref("/org/bookings", canonicalOrganizationId)} className={CTA_SECONDARY}>
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
                Penalizacao
                <input
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/70 outline-none"
                  value="0% (fixo)"
                  disabled
                />
              </label>
              <label className="text-[12px] text-white/70">
                No-show fee (cêntimos)
                <input
                  className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  value={editDraft.noShowFeeCents}
                  onChange={(e) => setEditDraft({ ...editDraft, noShowFeeCents: e.target.value })}
                  disabled={editDraft.saving}
                />
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
                <span>Permitir reservas de convidado</span>
                <input
                  type="checkbox"
                  checked={editDraft.guestBookingAllowed}
                  onChange={(e) => setEditDraft({ ...editDraft, guestBookingAllowed: e.target.checked })}
                  disabled={editDraft.saving}
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
              <p className="font-semibold text-white">Pré-visualização</p>
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
                Penalizacao: 0%
              </p>
              <p className="mt-1">
                No-show fee: {Number(editDraft.noShowFeeCents || "0") || 0} cêntimos
              </p>
              <p className="mt-1">
                Convidados: {editDraft.guestBookingAllowed ? "permitidos" : "bloqueados"}
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
