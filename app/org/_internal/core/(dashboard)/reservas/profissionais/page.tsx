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

type ProfessionalItem = {
  id: number;
  name: string;
  roleTitle: string | null;
  isActive: boolean;
  priority: number;
  isTrainer?: boolean;
  user?: { id: string; fullName: string | null; username: string | null; avatarUrl: string | null } | null;
};

type MemberItem = {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  role: string;
  rolePack?: string | null;
};

export default function ProfissionaisPage() {
  const params = useParams();
  const orgIdRaw = Array.isArray(params?.orgId) ? params?.orgId[0] : params?.orgId;
  const organizationId = Number(orgIdRaw);
  const canonicalOrganizationId = Number.isFinite(organizationId) && organizationId > 0 ? organizationId : null;

  const { data, mutate } = useSWR<{ ok: boolean; items: ProfessionalItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/reservas/profissionais"),
    fetcher,
  );
  const { data: membersData } = useSWR<{ ok: boolean; items: MemberItem[] }>(
    canonicalOrganizationId
      ? resolveCanonicalOrgApiPath(`/api/org-hub/organizations/members?organizationId=${canonicalOrganizationId}`)
      : null,
    fetcher,
  );
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRoleTitle, setMemberRoleTitle] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string; roleTitle: string } | null>(null);
  const [editSavingId, setEditSavingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = data?.items ?? [];
  const members = membersData?.items ?? [];
  const membersReady = Array.isArray(membersData?.items);
  const availableMembers = members.filter(
    (member) => !items.some((item) => item.user?.id === member.userId),
  );

  const handleToggle = async (item: ProfessionalItem) => {
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas/profissionais/${item.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar profissional.");
      }
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar profissional.");
    }
  };

  const handleAddMember = async () => {
    if (!memberUserId || saving) return;
    const member = availableMembers.find((item) => item.userId === memberUserId);
    if (!member) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/reservas/profissionais"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: member.userId,
          name: member.fullName || member.username || "Equipa",
          roleTitle: memberRoleTitle.trim(),
          priority: 0,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao adicionar profissional.");
      }
      setMemberUserId("");
      setMemberRoleTitle("");
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar profissional.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: ProfessionalItem) => {
    setError(null);
    setEditing({ id: item.id, name: item.name, roleTitle: item.roleTitle ?? "" });
  };

  const handleSaveEdit = async () => {
    if (!editing || editSavingId) return;
    const trimmedName = editing.name.trim();
    if (!trimmedName) {
      setError("Indica o nome do profissional.");
      return;
    }
    setEditSavingId(editing.id);
    setError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/reservas/profissionais/${editing.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, roleTitle: editing.roleTitle.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar profissional.");
      }
      setEditing(null);
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar profissional.");
    } finally {
      setEditSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={DASHBOARD_LABEL}>Reservas</p>
          <h1 className="text-xl font-semibold text-white">Profissionais</h1>
          <p className={DASHBOARD_MUTED}>Gere equipa associada aos serviços e disponibilidade.</p>
        </div>
        <Link href={appendOrganizationIdToHref("/org/bookings/operations", canonicalOrganizationId)} className={CTA_SECONDARY}>
          Operações
        </Link>
      </div>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
        <div>
          <h2 className="text-base font-semibold text-white">Novo profissional</h2>
          <p className={DASHBOARD_MUTED}>Adicionar a partir dos membros atuais da equipa.</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-white/70">
            Membro da equipa
            <select
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={memberUserId}
              onChange={(event) => setMemberUserId(event.target.value)}
            >
              <option value="">Seleciona um membro</option>
              {availableMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.fullName || member.username || "Sem nome"} · {member.role}
                  {member.rolePack ? ` (${member.rolePack})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-white/70">
            Função interna (opcional)
            <input
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="Ex: Treinador principal"
              value={memberRoleTitle}
              onChange={(e) => setMemberRoleTitle(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={CTA_PRIMARY}
            onClick={handleAddMember}
            disabled={!memberUserId || saving}
          >
            Adicionar
          </button>
          {membersReady && availableMembers.length === 0 && (
            <span className="text-[12px] text-white/50">Todos os membros já estão na equipa.</span>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-white/60">
          Profissionais externos não são criados aqui. Convites e gestão de pessoas são feitos em Equipa.
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        )}
      </section>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-3")}>
        <div>
          <h2 className="text-base font-semibold text-white">Equipa</h2>
          <p className={DASHBOARD_MUTED}>Seleciona para editar ou definir disponibilidade.</p>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-white/60">Sem profissionais.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const editingEntry = editing?.id === item.id ? editing : null;
              return (
                <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  {editingEntry ? (
                    <div className="grid gap-3 md:grid-cols-3">
                      <input
                        className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                        value={editingEntry.name}
                        onChange={(e) =>
                          setEditing((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                        }
                      />
                      <input
                        className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                        value={editingEntry.roleTitle}
                        onChange={(e) =>
                          setEditing((prev) => (prev ? { ...prev, roleTitle: e.target.value } : prev))
                        }
                        placeholder="Função (opcional)"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={CTA_PRIMARY}
                          onClick={handleSaveEdit}
                          disabled={editSavingId === item.id}
                        >
                          {editSavingId === item.id ? "A guardar..." : "Guardar"}
                        </button>
                        <button
                          type="button"
                          className={CTA_SECONDARY}
                          onClick={() => setEditing(null)}
                          disabled={editSavingId === item.id}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.name}</p>
                        <p className="text-[12px] text-white/60">
                          {item.roleTitle || "Sem titulo"}
                          {item.user?.fullName ? ` · ${item.user.fullName}` : ""}
                        </p>
                        {item.isTrainer && (
                          <span className="mt-1 inline-flex rounded-full border border-sky-300/40 bg-sky-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-sky-100">
                            Treinador
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={CTA_SECONDARY} onClick={() => handleEdit(item)}>
                          Editar
                        </button>
                        <button type="button" className={CTA_SECONDARY} onClick={() => handleToggle(item)}>
                          {item.isActive ? "Desativar" : "Ativar"}
                        </button>
                        <Link
                          href={appendOrganizationIdToHref(
                            `/org/calendar/availability?scopeType=PROFESSIONAL&scopeId=${item.id}`,
                            canonicalOrganizationId,
                          )}
                          className={CTA_PRIMARY}
                        >
                          Disponibilidade
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
