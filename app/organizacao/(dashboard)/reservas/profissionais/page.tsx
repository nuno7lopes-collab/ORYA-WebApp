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
  const [userId, setUserId] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const [priority, setPriority] = useState("0");
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
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/organizacao/reservas/profissionais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          roleTitle,
          userId: userId.trim() || null,
          priority: Number(priority) || 0,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao criar profissional.");
      }
      setName("");
      setRoleTitle("");
      setUserId("");
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

  const handleEdit = async (item: ProfessionalItem) => {
    const nextName = window.prompt("Nome do profissional", item.name);
    if (!nextName) return;
    const nextRole = window.prompt("Titulo/funcao (opcional)", item.roleTitle ?? "");
    try {
      const res = await fetch(`/api/organizacao/reservas/profissionais/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName, roleTitle: nextRole ?? "" }),
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

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-3")}>
        <div>
          <h2 className="text-base font-semibold text-white">Novo profissional</h2>
          <p className={DASHBOARD_MUTED}>Opcional: associar a um utilizador da organizacao.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <input
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="Titulo (opcional)"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
          />
          <input
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            placeholder="User ID (opcional)"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              className="w-24 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              placeholder="Prior."
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
            <button type="button" className={CTA_PRIMARY} onClick={handleCreate} disabled={saving}>
              {saving ? "A guardar..." : "Criar"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="min-w-[220px] rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
            value={memberUserId}
            onChange={(event) => setMemberUserId(event.target.value)}
          >
            <option value="">Adicionar da equipa</option>
            {availableMembers.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.fullName || member.username || "Sem nome"} · {member.role}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={CTA_SECONDARY}
            onClick={handleAddMember}
            disabled={!memberUserId || saving}
          >
            Adicionar
          </button>
          {membersReady && availableMembers.length === 0 && (
            <span className="text-[12px] text-white/50">Todos os membros já estão na equipa.</span>
          )}
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
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
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
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
