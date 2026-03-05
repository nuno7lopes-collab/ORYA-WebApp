"use client";

import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";
import { getRolePackLabel, parseOrganizationRolePack } from "@/lib/organizationRolePackPolicy";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";

import { useMemo, useState } from "react";
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
} from "@/app/org/_internal/core/dashboardUi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ProfessionalItem = {
  id: number;
  name: string;
  isActive: boolean;
  priority: number;
  isCoach?: boolean;
  membershipRole?: "OWNER" | "CO_OWNER" | "ADMIN" | "STAFF" | null;
  membershipRolePack?: string | null;
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

const ELIGIBLE_TEAM_ROLES = new Set(["OWNER", "CO_OWNER", "ADMIN", "STAFF"]);

function formatRolePackLabel(rolePack?: string | null) {
  const parsedRolePack = parseOrganizationRolePack(rolePack);
  if (!parsedRolePack) return rolePack?.trim() || null;
  return getRolePackLabel(parsedRolePack);
}

function formatMemberRole(role?: string | null) {
  const normalized = String(role ?? "").trim().toUpperCase();
  if (normalized === "OWNER") return "Owner";
  if (normalized === "CO_OWNER") return "Co-owner";
  if (normalized === "ADMIN") return "Admin";
  if (normalized === "STAFF") return "Staff";
  return normalized || "Sem papel";
}

export default function AcademyTrainersPage() {
  const params = useParams();
  const orgIdRaw = Array.isArray(params?.orgId) ? params?.orgId[0] : params?.orgId;
  const organizationId = Number(orgIdRaw);
  const canonicalOrganizationId = Number.isFinite(organizationId) && organizationId > 0 ? organizationId : null;

  const { data, mutate } = useSWR<{ ok: boolean; items: ProfessionalItem[] }>(
    resolveCanonicalOrgApiPath("/api/org/[orgId]/academy/trainers"),
    fetcher,
  );
  const { data: membersData } = useSWR<{ ok: boolean; items: MemberItem[] }>(
    canonicalOrganizationId
      ? resolveCanonicalOrgApiPath(`/api/org-hub/organizations/members?organizationId=${canonicalOrganizationId}`)
      : null,
    fetcher,
  );

  const [memberUserId, setMemberUserId] = useState("");
  const [deleteSavingId, setDeleteSavingId] = useState<number | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<ProfessionalItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [hygieneRunning, setHygieneRunning] = useState(false);
  const [hygieneSummary, setHygieneSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const items = data?.items ?? [];
  const members = membersData?.items ?? [];
  const membersReady = Array.isArray(membersData?.items);
  const activeItemsCount = items.filter((item) => item.isActive).length;

  const eligibleMembers = useMemo(
    () => members.filter((member) => ELIGIBLE_TEAM_ROLES.has(member.role)),
    [members],
  );

  const availableMembers = useMemo(
    () =>
      eligibleMembers.filter((member) => !items.some((item) => item.user?.id === member.userId)),
    [eligibleMembers, items],
  );

  const handleToggle = async (item: ProfessionalItem) => {
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/trainers/${item.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao atualizar treinador.");
      }
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar treinador.");
    }
  };

  const handleAddMember = async () => {
    if (!memberUserId || saving) return;
    const member = availableMembers.find((item) => item.userId === memberUserId);
    if (!member) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/academy/trainers"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: member.userId,
          isActive: true,
          priority: 0,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao adicionar treinador.");
      }
      setMemberUserId("");
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar treinador.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteItem || deleteSavingId === pendingDeleteItem.id) return;
    setDeleteSavingId(pendingDeleteItem.id);
    setError(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath(`/api/org/[orgId]/academy/trainers/${pendingDeleteItem.id}`), {
        method: "DELETE",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Erro ao remover treinador.");
      }
      mutate();
      setPendingDeleteItem(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover treinador.");
    } finally {
      setDeleteSavingId(null);
    }
  };

  const handleHygiene = async () => {
    if (hygieneRunning) return;
    setHygieneRunning(true);
    setError(null);
    setHygieneSummary(null);
    try {
      const res = await fetch(resolveCanonicalOrgApiPath("/api/org/[orgId]/academy/hygiene"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !json?.summary) {
        throw new Error(json?.error || "Erro ao executar higienização.");
      }
      const summary = json.summary as {
        invalidProfessionals?: number;
        deactivatedProfessionals?: number;
        purgedProfessionals?: number;
        classServiceLinksRemoved?: number;
        classSeriesUnlinked?: number;
        futureClassSessionsUnlinked?: number;
      };
      setHygieneSummary(
        `Higienização concluída: ${summary.invalidProfessionals ?? 0} inválidos, ${
          summary.deactivatedProfessionals ?? 0
        } desativados, ${summary.purgedProfessionals ?? 0} purgados, ${
          summary.classServiceLinksRemoved ?? 0
        } links removidos, ${
          summary.classSeriesUnlinked ?? 0
        } séries limpas, ${summary.futureClassSessionsUnlinked ?? 0} sessões futuras limpas.`,
      );
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao executar higienização.");
    } finally {
      setHygieneRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={DASHBOARD_LABEL}>Academia</p>
          <h1 className="text-xl font-semibold text-white">Treinadores</h1>
          <p className={DASHBOARD_MUTED}>Fonte única: Equipa.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/65">
            <span className="rounded-full border border-emerald-300/35 bg-emerald-400/10 px-2 py-0.5 text-emerald-100">
              {activeItemsCount} ativos
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
              {items.length} total
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={appendOrganizationIdToHref("/org/academy/classes", canonicalOrganizationId)} className={CTA_SECONDARY}>
            Aulas
          </Link>
          <Link href={appendOrganizationIdToHref("/org/academy/students", canonicalOrganizationId)} className={CTA_SECONDARY}>
            Alunos
          </Link>
          <button type="button" className={CTA_SECONDARY} onClick={handleHygiene} disabled={hygieneRunning}>
            {hygieneRunning ? "A higienizar..." : "Higienizar"}
          </button>
        </div>
      </div>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-4")}>
        <div>
          <h2 className="text-base font-semibold text-white">Adicionar da Equipa</h2>
          <p className={DASHBOARD_MUTED}>Sem criação manual de perfil.</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[260px] flex-1 flex-col gap-1 text-xs text-white/70">
            Membro elegível
            <select
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
              value={memberUserId}
              onChange={(event) => setMemberUserId(event.target.value)}
            >
              <option value="">Seleciona um membro</option>
              {availableMembers.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.fullName || member.username || "Sem nome"} · {formatMemberRole(member.role)}
                  {member.rolePack ? ` (${formatRolePackLabel(member.rolePack)})` : ""}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={CTA_PRIMARY} onClick={handleAddMember} disabled={!memberUserId || saving}>
            {saving ? "A adicionar..." : "Adicionar"}
          </button>
          {membersReady && availableMembers.length === 0 && (
            <span className="text-[12px] text-white/50">
              Todos os elegíveis já estão adicionados.
            </span>
          )}
        </div>

        {membersReady && availableMembers.length === 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/60">
            <span>Precisas de mais treinadores?</span>
            <Link href={appendOrganizationIdToHref("/org/team", canonicalOrganizationId)} className={CTA_SECONDARY}>
              Gerir Equipa
            </Link>
          </div>
        ) : null}

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        )}
        {hygieneSummary && (
          <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            {hygieneSummary}
          </div>
        )}
      </section>

      <section className={cn(DASHBOARD_CARD, "p-5 space-y-3")}>
        <div>
          <h2 className="text-base font-semibold text-white">Treinadores na Academia</h2>
          <p className={DASHBOARD_MUTED}>Ligação direta à Equipa.</p>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-white/60">Sem treinadores.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.name}</p>
                    <p className="text-[12px] text-white/60">
                      {item.user?.fullName ? item.user.fullName : item.user?.username ? `@${item.user.username}` : "Sem perfil"}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/75">
                        {formatMemberRole(item.membershipRole)}
                      </span>
                      {item.membershipRolePack ? (
                        <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-white/75">
                          {formatRolePackLabel(item.membershipRolePack)}
                        </span>
                      ) : null}
                      <span className="inline-flex rounded-full border border-sky-300/40 bg-sky-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-sky-100">
                        Treinador
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={appendOrganizationIdToHref(
                        `/org/calendar/availability?scopeType=PROFESSIONAL&scopeId=${item.id}`,
                        canonicalOrganizationId,
                      )}
                      className={CTA_PRIMARY}
                    >
                      Disponibilidade
                    </Link>
                    <button type="button" className={CTA_SECONDARY} onClick={() => handleToggle(item)}>
                      {item.isActive ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-rose-300/40 bg-rose-500/10 px-4 py-2 text-[12px] font-semibold text-rose-100 transition hover:border-rose-200/60 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => setPendingDeleteItem(item)}
                      disabled={deleteSavingId === item.id}
                    >
                      {deleteSavingId === item.id ? "A remover..." : "Remover"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDestructiveActionDialog
        open={Boolean(pendingDeleteItem)}
        title="Remover treinador da Academia?"
        description={
          pendingDeleteItem
            ? `${pendingDeleteItem.name} deixa de estar disponível para novas aulas e séries.`
            : undefined
        }
        confirmLabel={deleteSavingId != null ? "A remover..." : "Remover"}
        cancelLabel="Cancelar"
        dangerLevel="high"
        onClose={() => {
          if (deleteSavingId != null) return;
          setPendingDeleteItem(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
