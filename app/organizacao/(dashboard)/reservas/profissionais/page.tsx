"use client";

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
} from "@/app/organizacao/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ProfessionalItem = {
  id: number;
  name: string;
  roleTitle: string | null;
  isActive: boolean;
  priority: number;
  user?: { id: string; fullName: string | null; username: string | null; avatarUrl: string | null } | null;
};

type MemberItem = {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  role: string;
};

export default function ProfissionaisPage() {
  const { data, mutate } = useSWR<{ ok: boolean; items: ProfessionalItem[] }>(
    "/api/organizacao/reservas/profissionais",
    fetcher,
  );
  const { data: membersData } = useSWR<{ ok: boolean; items: MemberItem[] }>(
    "/api/organizacao/organizations/members",
    fetcher,
  );
  const [name, setName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const [priority, setPriority] = useState("0");
  const [createMode, setCreateMode] = useState<"member" | "external">("member");
  const [showAdvanced, setShowAdvanced] = useState(false);
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

  const handleCreate = async () => {
    if (saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Indica o nome do profissional.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/organizacao/reservas/profissionais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          roleTitle: roleTitle.trim(),
          userId: null,
          priority: Number(priority) || 0,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar profissional.");
      }
      setName("");
      setRoleTitle("");
      setPriority("0");
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar profissional.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item: ProfessionalItem) => {
    try {
      const res = await fetch(`/api/organizacao/reservas/profissionais/${item.id}`, {
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
      const res = await fetch("/api/organizacao/reservas/profissionais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: member.userId,
          name: member.fullName || member.username || "Staff",
          roleTitle: "",
          priority: 0,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao adicionar profissional.");
      }
      setMemberUserId("");
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
      const res = await fetch(`/api/organizacao/reservas/profissionais/${editing.id}`, {
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
          <h1 className={DASHBOARD_TITLE}>Profissionais</h1>
          <p className={DASHBOARD_MUTED}>Gere equipa e disponibilidade.</p>
        </div>
        <Link href="/organizacao/reservas" className={CTA_SECONDARY}>
          Voltar
        </Link>
      </div>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
        <div>
          <h2 className="text-base font-semibold text-white">Novo profissional</h2>
          <p className={DASHBOARD_MUTED}>Escolhe entre equipa existente ou profissional externo.</p>
        </div>

        <div className="inline-flex rounded-full border border-white/15 bg-white/5 p-1 text-[12px]">
          {[
            { key: "member", label: "Da equipa" },
            { key: "external", label: "Externo" },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setCreateMode(option.key as "member" | "external")}
              className={`rounded-full px-4 py-1.5 transition ${
                createMode === option.key
                  ? "bg-white text-black font-semibold shadow"
                  : "text-white/70 hover:bg-white/10"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {createMode === "member" ? (
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
                  </option>
                ))}
              </select>
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
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-4">
              <input
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                placeholder="Nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                placeholder="Função (opcional)"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
              />
              {showAdvanced ? (
                <input
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  placeholder="Prioridade"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                />
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/60">
                  Prioridade: normal
                </div>
              )}
              <button type="button" className={CTA_PRIMARY} onClick={handleCreate} disabled={saving || !name.trim()}>
                {saving ? "A guardar..." : "Criar"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
              <button
                type="button"
                onClick={() => setShowAdvanced((prev) => !prev)}
                className="rounded-full border border-white/20 px-3 py-1 text-white/70 hover:border-white/40"
              >
                {showAdvanced ? "Ocultar opções avançadas" : "Mostrar opções avançadas"}
              </button>
              <span>Define prioridade se precisares de dar preferência nas marcações.</span>
            </div>
          </div>
        )}

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
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={CTA_SECONDARY} onClick={() => handleEdit(item)}>
                          Editar
                        </button>
                        <button type="button" className={CTA_SECONDARY} onClick={() => handleToggle(item)}>
                          {item.isActive ? "Desativar" : "Ativar"}
                        </button>
                        <Link href={`/organizacao/reservas/profissionais/${item.id}`} className={CTA_PRIMARY}>
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
