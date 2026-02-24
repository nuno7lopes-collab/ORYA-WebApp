"use client";

import Link from "next/link";
import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildOrgHref, buildOrgHubHref } from "@/lib/organizationIdUtils";
import type {
  OrgHubGroupOpenRequest,
  OrgHubGroupOwnerTransfer,
  OrgHubGroupPayload,
} from "@/lib/orgHub/listGroupsForUser";
import { resolveGroupDisplayName } from "@/lib/orgHub/groupDisplayName";
import { cn } from "@/lib/utils";
import OrgHubTopNav from "@/app/org/_internal/core/organizations/OrgHubTopNav";

type Props = {
  group: OrgHubGroupPayload;
};

type CodesState = {
  groupOwnerCode?: string;
  orgOwnerCode?: string;
  targetOwnerCode?: string;
};

type FeedbackTone = "ok" | "error";

type ExitMode = "KEEP_OWNER" | "TRANSFER_OWNER";

const REQUEST_TYPE_META: Record<string, { label: string; badge: string }> = {
  JOIN: {
    label: "Entrada no grupo",
    badge: "border-emerald-300/50 bg-emerald-300/14 text-emerald-100",
  },
  EXIT_KEEP_OWNER: {
    label: "Saída (mantém owner)",
    badge: "border-amber-300/50 bg-amber-300/14 text-amber-100",
  },
  EXIT_TRANSFER_OWNER: {
    label: "Saída (transfere owner)",
    badge: "border-orange-300/50 bg-orange-300/14 text-orange-100",
  },
};

const REQUEST_STATUS_META: Record<string, { label: string; badge: string }> = {
  PENDING_CODES: {
    label: "Aguarda códigos",
    badge: "border-cyan-300/45 bg-cyan-300/14 text-cyan-100",
  },
  PENDING_EMAIL_CONFIRMATIONS: {
    label: "Aguarda emails",
    badge: "border-blue-300/45 bg-blue-300/14 text-blue-100",
  },
  LOCKED: {
    label: "Bloqueado",
    badge: "border-red-300/45 bg-red-300/14 text-red-100",
  },
};

const ORG_STATUS_META: Record<string, string> = {
  ACTIVE: "border-emerald-300/45 bg-emerald-300/14 text-emerald-100",
  SUSPENDED: "border-red-300/45 bg-red-300/14 text-red-100",
};

const ROLE_META: Record<string, string> = {
  OWNER: "border-cyan-300/45 bg-cyan-300/14 text-cyan-100",
  CO_OWNER: "border-sky-300/45 bg-sky-300/14 text-sky-100",
  ADMIN: "border-indigo-300/45 bg-indigo-300/14 text-indigo-100",
  STAFF: "border-violet-300/45 bg-violet-300/14 text-violet-100",
};

const EXIT_MODE_LABELS: Record<ExitMode, string> = {
  KEEP_OWNER: "Saída mantendo owner atual",
  TRANSFER_OWNER: "Saída com transferência de owner",
};

const PARTICIPANT_LABELS: Record<string, string> = {
  groupOwner: "Owner do grupo",
  orgOwner: "Owner da organização",
  targetOwner: "Próximo owner",
  GROUP_OWNER: "Owner do grupo",
  ORG_OWNER: "Owner da organização",
  TARGET_OWNER: "Próximo owner",
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTypeMeta(type: string) {
  return REQUEST_TYPE_META[type] ?? {
    label: type,
    badge: "border-white/20 bg-white/8 text-white/75",
  };
}

function getStatusMeta(status: string) {
  return REQUEST_STATUS_META[status] ?? {
    label: status,
    badge: "border-white/20 bg-white/8 text-white/75",
  };
}

function toneForStatus(status: string | null) {
  const key = (status || "").toUpperCase();
  return ORG_STATUS_META[key] ?? "border-white/20 bg-white/8 text-white/75";
}

function toneForRole(role: string | null) {
  if (!role) return "border-white/20 bg-white/8 text-white/75";
  const key = role.toUpperCase();
  return ROLE_META[key] ?? "border-white/20 bg-white/8 text-white/75";
}

export default function GroupGovernanceClient({ group }: Props) {
  const router = useRouter();
  const initialGroups = useMemo(() => [group], [group]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; tone: FeedbackTone } | null>(null);

  const [joinOrganizationByGroup, setJoinOrganizationByGroup] = useState<Record<number, string>>({});
  const [exitOrganizationByGroup, setExitOrganizationByGroup] = useState<Record<number, string>>({});
  const [exitModeByGroup, setExitModeByGroup] = useState<Record<number, ExitMode>>({});
  const [exitTargetByGroup, setExitTargetByGroup] = useState<Record<number, string>>({});
  const [transferTargetByGroup, setTransferTargetByGroup] = useState<Record<number, string>>({});
  const [transferTokenById, setTransferTokenById] = useState<Record<string, string>>({});

  const [participantByRequest, setParticipantByRequest] = useState<Record<string, string>>({});
  const [codesByRequest, setCodesByRequest] = useState<Record<string, CodesState>>({});
  const [tokenByRequest, setTokenByRequest] = useState<Record<string, string>>({});
  const [groupNameById, setGroupNameById] = useState<Record<number, string>>({});
  const [governanceInviteByGroup, setGovernanceInviteByGroup] = useState<Record<number, string>>({});
  const [governanceRoleByGroup, setGovernanceRoleByGroup] = useState<Record<number, string>>({});
  const [governanceRoleByMember, setGovernanceRoleByMember] = useState<Record<string, string>>({});
  const [linkedOrganizationsVisibilityByGroup, setLinkedOrganizationsVisibilityByGroup] = useState<Record<number, boolean>>({});

  const summary = useMemo(() => {
    const organizations = initialGroups.reduce((sum, group) => sum + group.organizations.length, 0);
    const openRequests = initialGroups.reduce((sum, group) => sum + group.openRequests.length, 0);
    const pendingTransfers = initialGroups.reduce((sum, group) => sum + group.pendingTransfers.length, 0);
    const actionable = initialGroups.reduce(
      (sum, group) => sum + group.actionableRequestCount + group.pendingTransfers.filter((item) => item.isActionable).length,
      0,
    );
    return { organizations, openRequests, pendingTransfers, actionable };
  }, [initialGroups]);

  const groupDashboardHref = useMemo(() => buildOrgHubHref(`/groups/${group.groupId}`), [group.groupId]);

  const isBusy = (key: string) => busyKey === key;

  const submitJson = async (path: string, body?: unknown, method: "POST" | "PATCH" | "DELETE" = "POST") => {
    const response = await fetch(resolveCanonicalOrgApiPath(path), {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || json?.ok === false) {
      throw new Error(json?.error || json?.message || json?.errorCode || "Operação falhou");
    }
    return json;
  };

  const runAction = async (key: string, action: () => Promise<string | null>) => {
    if (busyKey) return;
    setBusyKey(key);
    setFeedback(null);
    try {
      const message = await action();
      setFeedback({ text: message ?? "Operação concluída.", tone: "ok" });
      router.refresh();
    } catch (err) {
      setFeedback({ text: err instanceof Error ? err.message : "Erro inesperado.", tone: "error" });
    } finally {
      setBusyKey(null);
    }
  };

  const startJoinRequest = (groupId: number) => {
    const selected = Number(joinOrganizationByGroup[groupId] ?? "0");
    if (!Number.isInteger(selected) || selected <= 0) {
      setFeedback({ text: "Seleciona uma organização para entrada.", tone: "error" });
      return;
    }

    const group = initialGroups.find((item) => item.groupId === groupId);
    const candidate = group?.joinCandidates.find((item) => item.organizationId === selected) ?? null;
    if (candidate?.hasOpenJoinRequest) {
      setFeedback({ text: "Já existe um pedido de entrada aberto para essa organização.", tone: "error" });
      return;
    }

    void runAction(`join:${groupId}`, async () => {
      await submitJson("/api/org-hub/groups/join-requests", {
        groupId,
        organizationId: selected,
      });
      return "Pedido de entrada iniciado.";
    });
  };

  const startExitRequest = (groupId: number) => {
    const selectedOrgId = Number(exitOrganizationByGroup[groupId] ?? "0");
    if (!Number.isInteger(selectedOrgId) || selectedOrgId <= 0) {
      setFeedback({ text: "Seleciona a organização para saída.", tone: "error" });
      return;
    }

    const selectedMode = exitModeByGroup[groupId] ?? "KEEP_OWNER";
    const targetOwnerIdentifier = (exitTargetByGroup[groupId] ?? "").trim();
    if (selectedMode === "TRANSFER_OWNER" && !targetOwnerIdentifier) {
      setFeedback({ text: "Indica o utilizador/email do próximo owner.", tone: "error" });
      return;
    }

    void runAction(`exit:${groupId}`, async () => {
      await submitJson("/api/org-hub/groups/exit-requests", {
        groupId,
        organizationId: selectedOrgId,
        mode: selectedMode,
        targetOwnerIdentifier: selectedMode === "TRANSFER_OWNER" ? targetOwnerIdentifier : undefined,
      });
      return "Pedido de saída iniciado.";
    });
  };

  const startOwnerTransfer = (groupId: number) => {
    const targetUserId = (transferTargetByGroup[groupId] ?? "").trim();
    if (!targetUserId) {
      setFeedback({ text: "Indica o utilizador/email para transferência do owner.", tone: "error" });
      return;
    }

    void runAction(`transfer:start:${groupId}`, async () => {
      await submitJson(`/api/org-hub/groups/${groupId}/owner/transfer/start`, { targetUserId });
      return "Transferência de owner iniciada (confirmação por email).";
    });
  };

  const cancelOwnerTransfer = (transfer: OrgHubGroupOwnerTransfer) => {
    void runAction(`transfer:cancel:${transfer.id}`, async () => {
      await submitJson(`/api/org-hub/groups/${transfer.groupId}/owner/transfer/cancel`, {
        transferId: transfer.id,
      });
      return "Transferência cancelada.";
    });
  };

  const confirmOwnerTransfer = (transfer: OrgHubGroupOwnerTransfer) => {
    const token = (transferTokenById[transfer.id] ?? "").trim();
    if (!token) {
      setFeedback({ text: "Indica o token da transferência de owner.", tone: "error" });
      return;
    }
    void runAction(`transfer:confirm:${transfer.id}`, async () => {
      await submitJson(`/api/org-hub/groups/${transfer.groupId}/owner/transfer/confirm`, { token });
      return "Transferência de owner confirmada.";
    });
  };

  const generateCode = (request: OrgHubGroupOpenRequest, participantOverride?: string) => {
    const base = request.type === "JOIN" ? "join-requests" : "exit-requests";
    const participant =
      participantOverride ?? (participantByRequest[request.id] ? participantByRequest[request.id] : undefined);

    void runAction(`request:code:${request.id}`, async () => {
      const result = await submitJson(`/api/org-hub/groups/${base}/${request.id}/generate-code`, {
        participant,
      });
      const code = typeof result?.code === "string" ? result.code : null;
      const participantLabel = typeof result?.participant === "string" ? result.participant : "participant";
      return code ? `Código (${formatParticipantLabel(participantLabel)}): ${code}` : "Código gerado.";
    });
  };

  const verifyCodes = (request: OrgHubGroupOpenRequest) => {
    if (request.type === "EXIT_KEEP_OWNER") {
      setFeedback({ text: "Este pedido não usa validação por códigos.", tone: "error" });
      return;
    }

    const base = request.type === "JOIN" ? "join-requests" : "exit-requests";
    const codes = codesByRequest[request.id] ?? {};

    const payload =
      request.type === "JOIN"
        ? {
            groupOwnerCode: codes.groupOwnerCode?.trim(),
            orgOwnerCode: codes.orgOwnerCode?.trim(),
          }
        : {
            orgOwnerCode: codes.orgOwnerCode?.trim(),
            targetOwnerCode: codes.targetOwnerCode?.trim(),
          };

    void runAction(`request:verify:${request.id}`, async () => {
      await submitJson(`/api/org-hub/groups/${base}/${request.id}/verify-codes`, payload);
      return "Códigos validados.";
    });
  };

  const resendEmails = (request: OrgHubGroupOpenRequest) => {
    const base = request.type === "JOIN" ? "join-requests" : "exit-requests";
    void runAction(`request:email:${request.id}`, async () => {
      await submitJson(`/api/org-hub/groups/${base}/${request.id}/email/resend`);
      return "Emails reenviados.";
    });
  };

  const confirmToken = (request: OrgHubGroupOpenRequest) => {
    const base = request.type === "JOIN" ? "join-requests" : "exit-requests";
    const token = (tokenByRequest[request.id] ?? "").trim();
    if (!token) {
      setFeedback({ text: "Indica o token do email.", tone: "error" });
      return;
    }

    void runAction(`request:confirm:${request.id}`, async () => {
      await submitJson(`/api/org-hub/groups/${base}/${request.id}/email/confirm`, { token });
      return "Token confirmado.";
    });
  };

  const formatParticipantLabel = (raw: string) => PARTICIPANT_LABELS[raw] ?? raw;

  const renameGroup = (groupId: number, currentName: string | null) => {
    const name = (groupNameById[groupId] ?? currentName ?? "").trim();
    if (!name) {
      setFeedback({ text: "Indica um nome para o grupo.", tone: "error" });
      return;
    }
    void runAction(`group:rename:${groupId}`, async () => {
      await submitJson(`/api/org-hub/groups/${groupId}/governance`, { name }, "PATCH");
      return "Nome do grupo atualizado.";
    });
  };

  const saveLinkedOrganizationsVisibility = (groupId: number, currentValue: boolean) => {
    const showLinkedOrganizationsPublicly =
      linkedOrganizationsVisibilityByGroup[groupId] ?? currentValue;
    void runAction(`group:visibility:${groupId}`, async () => {
      await submitJson(
        `/api/org-hub/groups/${groupId}/governance`,
        { showLinkedOrganizationsPublicly },
        "PATCH",
      );
      return showLinkedOrganizationsPublicly
        ? "Perfis associados visíveis no perfil público."
        : "Perfis associados ocultos no perfil público.";
    });
  };

  const addGovernanceMember = (groupId: number) => {
    const userIdentifier = (governanceInviteByGroup[groupId] ?? "").trim();
    const role = (governanceRoleByGroup[groupId] ?? "CO_OWNER").toUpperCase();
    if (!userIdentifier) {
      setFeedback({ text: "Indica o utilizador ou email.", tone: "error" });
      return;
    }
    if (!["CO_OWNER", "ADMIN"].includes(role)) {
      setFeedback({ text: "Seleciona um papel válido.", tone: "error" });
      return;
    }
    void runAction(`group:gov:add:${groupId}`, async () => {
      await submitJson(`/api/org-hub/groups/${groupId}/governance/members`, { userIdentifier, role }, "POST");
      return "Governança atualizada.";
    });
  };

  const updateGovernanceMember = (groupId: number, userId: string, currentRole: string) => {
    const key = `${groupId}:${userId}`;
    const role = (governanceRoleByMember[key] ?? currentRole).toUpperCase();
    if (!["CO_OWNER", "ADMIN"].includes(role)) {
      setFeedback({ text: "Seleciona um papel válido.", tone: "error" });
      return;
    }
    void runAction(`group:gov:update:${groupId}:${userId}`, async () => {
      await submitJson(`/api/org-hub/groups/${groupId}/governance/members`, { userId, role }, "PATCH");
      return "Papel atualizado.";
    });
  };

  const removeGovernanceMember = (groupId: number, userId: string) => {
    void runAction(`group:gov:remove:${groupId}:${userId}`, async () => {
      await submitJson(`/api/org-hub/groups/${groupId}/governance/members`, { userId }, "DELETE");
      return "Membro removido.";
    });
  };

  if (initialGroups.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1240px] px-4 py-12 text-white sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <OrgHubTopNav />
          <h1 className="mt-4 text-2xl font-semibold">Gestão de grupos</h1>
          <p className="mt-2 text-sm text-white/70">
            Ainda não tens grupos ativos para gerir. Cria ou entra numa organização para começar.
          </p>
          <button
            type="button"
            onClick={() => router.push(buildOrgHubHref("/organizations"))}
            className="mt-4 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55"
          >
            Ir para organizações
          </button>
        </section>
      </div>
    );
  }

  return (
    <div
      aria-busy={Boolean(busyKey)}
      className="mx-auto w-full max-w-[1240px] px-4 py-10 text-white sm:px-6 md:py-12 lg:px-8"
    >
      <div className="space-y-6">
        <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-6">
          <OrgHubTopNav />

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[30px] font-semibold leading-tight">Governança do grupo</h1>
              <p className="mt-1 text-sm text-white/75">Renomeia o grupo, gere membros de governança e controla operações.</p>
            </div>
            <Link
              href={groupDashboardHref}
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55"
            >
              Abrir dashboard
            </Link>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/14 bg-white/6 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Organizações</p>
              <p className="mt-1 text-xl font-semibold">{summary.organizations}</p>
            </div>
            <div className="rounded-2xl border border-white/14 bg-white/6 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Pedidos abertos</p>
              <p className="mt-1 text-xl font-semibold">{summary.openRequests}</p>
            </div>
            <div className="rounded-2xl border border-white/14 bg-white/6 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Transferências</p>
              <p className="mt-1 text-xl font-semibold">{summary.pendingTransfers}</p>
            </div>
            <div className="rounded-2xl border border-[#22D3EE]/32 bg-[#22D3EE]/10 p-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#B5F9FF]">Ações pendentes</p>
              <p className="mt-1 text-xl font-semibold text-[#DEFDFF]">{summary.actionable}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="#resumo"
              className="rounded-full border border-white/20 bg-white/8 px-3 py-1.5 text-[11px] font-semibold text-white/75 transition hover:bg-white/12"
            >
              Resumo
            </a>
            <a
              href="#governanca"
              className="rounded-full border border-white/20 bg-white/8 px-3 py-1.5 text-[11px] font-semibold text-white/75 transition hover:bg-white/12"
            >
              Governança
            </a>
            <a
              href="#operacoes"
              className="rounded-full border border-white/20 bg-white/8 px-3 py-1.5 text-[11px] font-semibold text-white/75 transition hover:bg-white/12"
            >
              Operações
            </a>
            <a
              href="#pedidos"
              className="rounded-full border border-white/20 bg-white/8 px-3 py-1.5 text-[11px] font-semibold text-white/75 transition hover:bg-white/12"
            >
              Pedidos
            </a>
          </div>
        </section>

        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "rounded-2xl border px-4 py-2 text-sm",
              feedback.tone === "ok"
                ? "border-emerald-300/45 bg-emerald-300/14 text-emerald-100"
                : "border-red-300/45 bg-red-300/14 text-red-100",
            )}
          >
            {feedback.text}
          </div>
        )}

        {initialGroups.map((group) => {
          const exitMode = exitModeByGroup[group.groupId] ?? "KEEP_OWNER";
          const selectedJoinCandidateId = Number(joinOrganizationByGroup[group.groupId] ?? "0") || null;
          const selectedJoinCandidate =
            typeof selectedJoinCandidateId === "number"
              ? group.joinCandidates.find((candidate) => candidate.organizationId === selectedJoinCandidateId) ?? null
              : null;
          const selectedExitOrgId = Number(exitOrganizationByGroup[group.groupId] ?? "0") || null;
          const selectedExitOrg =
            typeof selectedExitOrgId === "number"
              ? group.organizations.find((organization) => organization.organizationId === selectedExitOrgId)
              : null;
          const defaultGroupOrgHref = group.organizations[0]
            ? buildOrgHref(group.organizations[0].organizationId, "/team")
            : null;
          const groupDisplayName = resolveGroupDisplayName(group.groupName, group.groupId);
          const groupNameValue = groupNameById[group.groupId] ?? group.groupName ?? "";
          const linkedOrganizationsVisibleValue =
            linkedOrganizationsVisibilityByGroup[group.groupId] ?? group.showLinkedOrganizationsPublicly;
          const governanceMembers = group.governanceMembers ?? [];
          const ownerMember = governanceMembers.find((member) => member.role === "OWNER") ?? null;
          const actionableOpenRequests = group.openRequests.filter((request) => request.isActionable).length;

          return (
            <article
              id="resumo"
              key={group.groupId}
              className="rounded-3xl border border-white/15 bg-[linear-gradient(145deg,rgba(12,21,38,0.74),rgba(6,11,24,0.84))] p-4 shadow-[0_18px_66px_rgba(0,0,0,0.47)] sm:p-5"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold text-white">{groupDisplayName}</h2>
                  <p className="text-[12px] text-white/72">
                    {group.organizationCount} subsidiária{group.organizationCount === 1 ? "" : "s"} ·{" "}
                    {group.openRequests.length} pedido(s)
                  </p>
                  <p className="text-[12px] text-white/62">{group.viewerIsGroupOwner ? "Owner do grupo" : "Membro de governança"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {defaultGroupOrgHref && (
                    <button
                      type="button"
                      onClick={() => router.push(defaultGroupOrgHref)}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55"
                    >
                      Abrir equipa
                    </button>
                  )}
                  {group.viewerIsGroupOwner && (
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`${buildOrgHubHref("/create")}?groupMode=EXISTING_GROUP&groupId=${group.groupId}`)
                      }
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55"
                    >
                      Nova org no grupo
                    </button>
                  )}
                </div>
              </div>
              <div id="governanca" className="mb-4 rounded-2xl border border-white/12 bg-white/6 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-white/78">
                      Owner {ownerMember ? 1 : 0} · Co-owners {group.governance.coOwnerCount} · Admins{" "}
                      {group.governance.adminCount}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr),320px]">
                  <div className="rounded-2xl border border-white/10 bg-white/4 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Equipa de governança</p>
                    {governanceMembers.length === 0 ? (
                      <p className="mt-2 text-sm text-white/60">Sem membros de governança registados.</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {governanceMembers.map((member) => {
                          const memberKey = `${group.groupId}:${member.userId}`;
                          const roleLabel = member.role === "OWNER" ? "Owner" : member.role === "CO_OWNER" ? "Co-owner" : "Admin";
                          return (
                            <div
                              key={memberKey}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/6 px-3 py-2"
                            >
                              <div>
                                <p className="text-sm font-semibold text-white">
                                  {member.fullName || member.username || member.userId}
                                </p>
                                <p className="text-[11px] text-white/60">
                                  {member.username ? `@${member.username}` : "Sem username"}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]", toneForRole(member.role))}>
                                  {roleLabel}
                                </span>
                                {group.viewerIsGroupOwner && member.role !== "OWNER" && (
                                  <>
                                    <select
                                      value={governanceRoleByMember[memberKey] ?? member.role}
                                      onChange={(event) =>
                                        setGovernanceRoleByMember((prev) => ({ ...prev, [memberKey]: event.target.value }))
                                      }
                                      className="rounded-full border border-white/20 bg-black/30 px-2 py-1 text-[11px] text-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55"
                                    >
                                      <option value="CO_OWNER">Co-owner</option>
                                      <option value="ADMIN">Admin</option>
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => updateGovernanceMember(group.groupId, member.userId, member.role)}
                                      className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55"
                                    >
                                      Atualizar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeGovernanceMember(group.groupId, member.userId)}
                                      className="rounded-full border border-red-300/40 bg-red-300/10 px-2.5 py-1 text-[11px] font-semibold text-red-100 transition hover:bg-red-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/55"
                                    >
                                      Remover
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {!group.viewerIsGroupOwner && group.viewerIsGovernance && (
                      <p className="mt-3 text-[12px] text-white/60">
                        Apenas o owner do grupo pode alterar governança.
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/4 p-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/55">Ações do owner</p>
                    <div className="space-y-2">
                      <label className="text-[11px] text-white/60">Nome do grupo</label>
                      <input
                        type="text"
                        value={groupNameValue}
                        onChange={(event) =>
                          setGroupNameById((prev) => ({ ...prev, [group.groupId]: event.target.value }))
                        }
                        placeholder="Ex: Grupo Norte"
                        disabled={!group.viewerIsGroupOwner}
                        className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => renameGroup(group.groupId, group.groupName)}
                        disabled={!group.viewerIsGroupOwner}
                        className="w-full rounded-full border border-white/20 bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Guardar nome
                      </button>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] text-white/60">Visibilidade pública de perfis associados</label>
                      <select
                        value={linkedOrganizationsVisibleValue ? "VISIBLE" : "HIDDEN"}
                        onChange={(event) =>
                          setLinkedOrganizationsVisibilityByGroup((prev) => ({
                            ...prev,
                            [group.groupId]: event.target.value === "VISIBLE",
                          }))
                        }
                        disabled={!group.viewerIsGroupOwner}
                        className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="VISIBLE">Mostrar no perfil público</option>
                        <option value="HIDDEN">Ocultar no perfil público</option>
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          saveLinkedOrganizationsVisibility(group.groupId, group.showLinkedOrganizationsPublicly)
                        }
                        disabled={!group.viewerIsGroupOwner}
                        className="w-full rounded-full border border-white/20 bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Guardar visibilidade
                      </button>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] text-white/60">Adicionar co-owner/admin</label>
                      <input
                        type="text"
                        value={governanceInviteByGroup[group.groupId] ?? ""}
                        onChange={(event) =>
                          setGovernanceInviteByGroup((prev) => ({ ...prev, [group.groupId]: event.target.value }))
                        }
                        placeholder="email ou username"
                        disabled={!group.viewerIsGroupOwner}
                        className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <div className="flex gap-2">
                        <select
                          value={governanceRoleByGroup[group.groupId] ?? "CO_OWNER"}
                          onChange={(event) =>
                            setGovernanceRoleByGroup((prev) => ({ ...prev, [group.groupId]: event.target.value }))
                          }
                          disabled={!group.viewerIsGroupOwner}
                          className="flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="CO_OWNER">Co-owner</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => addGovernanceMember(group.groupId)}
                          disabled={!group.viewerIsGroupOwner}
                          className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
                <section className="rounded-2xl border border-white/15 bg-white/[0.07] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/80">Organizações no grupo</h3>
                    <span className="text-[11px] text-white/55">{group.organizations.length} visíveis</span>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {group.organizations.map((organization) => {
                      const orgOverviewHref = buildOrgHref(organization.organizationId, "/overview");

                      return (
                        <div
                          key={organization.organizationId}
                          className="rounded-2xl border border-white/12 bg-black/25 p-3"
                        >
                          <p className="text-sm font-semibold text-white">{organization.name}</p>
                          <p className="text-[12px] text-white/65">
                            {organization.username ? `@${organization.username}` : "Sem username"}
                            {organization.entityType ? ` · ${organization.entityType}` : ""}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1 text-[10px] uppercase tracking-[0.16em]">
                            <span className={cn("rounded-full border px-2 py-1", toneForStatus(organization.status))}>
                              {organization.status || "Sem estado"}
                            </span>
                            {organization.viewerRole && (
                              <span className={cn("rounded-full border px-2 py-1", toneForRole(organization.viewerRole))}>
                                {organization.viewerRole}
                              </span>
                            )}
                          </div>
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => router.push(orgOverviewHref)}
                              className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold text-white/80 transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55"
                            >
                              Entrar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <details id="operacoes" className="rounded-2xl border border-white/15 bg-white/[0.07] p-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-[0.16em] text-white/80">
                    Operações
                  </summary>
                  <p className="mt-1 text-[12px] text-white/60">Entradas, saídas e transferência de owner.</p>
                  <div className="mt-3 space-y-4">

	                  <div className="space-y-2 rounded-2xl border border-white/12 bg-black/25 p-3">
	                    <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/75">Entrada de organização</p>
	                    {group.viewerIsGroupOwner ? (
	                      <>
	                        <label htmlFor={`join-org-${group.groupId}`} className="sr-only">
	                          Organização para entrada no grupo
	                        </label>
	                        <select
	                          id={`join-org-${group.groupId}`}
	                          value={joinOrganizationByGroup[group.groupId] ?? ""}
	                          onChange={(event) =>
	                            setJoinOrganizationByGroup((prev) => ({ ...prev, [group.groupId]: event.target.value }))
	                          }
	                          className="w-full rounded-xl border border-white/14 bg-black/45 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/35"
	                        >
	                          <option value="">Seleciona organização owner tua</option>
	                          {group.joinCandidates.map((candidate) => (
	                            <option
                              key={candidate.organizationId}
                              value={candidate.organizationId}
                              disabled={candidate.hasOpenJoinRequest}
                            >
                              {candidate.name}
                              {candidate.hasOpenJoinRequest ? " (pedido já aberto)" : ""}
                            </option>
                          ))}
                        </select>
                        {selectedJoinCandidate?.hasOpenJoinRequest && (
                          <p className="text-[12px] text-amber-200">
                            Já existe um pedido de entrada aberto para esta organização.
                          </p>
                        )}
	                        <button
	                          type="button"
	                          onClick={() => startJoinRequest(group.groupId)}
	                          disabled={
	                            isBusy(`join:${group.groupId}`) ||
	                            group.joinCandidates.length === 0 ||
	                            Boolean(selectedJoinCandidate?.hasOpenJoinRequest)
	                          }
	                          className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55 disabled:opacity-50"
	                        >
	                          {isBusy(`join:${group.groupId}`) ? "A iniciar..." : "Iniciar entrada"}
	                        </button>
	                      </>
	                    ) : (
                      <p className="text-sm text-white/66">Só o owner do grupo pode iniciar entradas.</p>
                    )}
                  </div>

	                  <div className="space-y-2 rounded-2xl border border-white/12 bg-black/25 p-3">
	                    <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/75">Saída de organização</p>
	                    {group.viewerIsGroupOwner ? (
	                      <>
	                        <label htmlFor={`exit-org-${group.groupId}`} className="sr-only">
	                          Organização para saída do grupo
	                        </label>
	                        <select
	                          id={`exit-org-${group.groupId}`}
	                          value={exitOrganizationByGroup[group.groupId] ?? ""}
	                          onChange={(event) =>
	                            setExitOrganizationByGroup((prev) => ({ ...prev, [group.groupId]: event.target.value }))
	                          }
	                          className="w-full rounded-xl border border-white/14 bg-black/45 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/35"
	                        >
	                          <option value="">Seleciona organização para saída</option>
	                          {group.organizations.map((organization) => (
	                            <option key={organization.organizationId} value={organization.organizationId}>
                              {organization.name}
                            </option>
                          ))}
                        </select>

	                        <label htmlFor={`exit-mode-${group.groupId}`} className="sr-only">
	                          Modo de saída
	                        </label>
	                        <select
	                          id={`exit-mode-${group.groupId}`}
	                          value={exitMode}
	                          onChange={(event) =>
	                            setExitModeByGroup((prev) => ({
	                              ...prev,
	                              [group.groupId]: event.target.value === "TRANSFER_OWNER" ? "TRANSFER_OWNER" : "KEEP_OWNER",
	                            }))
	                          }
	                          className="w-full rounded-xl border border-white/14 bg-black/45 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/35"
	                        >
	                          <option value="KEEP_OWNER">{EXIT_MODE_LABELS.KEEP_OWNER}</option>
	                          <option value="TRANSFER_OWNER">{EXIT_MODE_LABELS.TRANSFER_OWNER}</option>
	                        </select>

	                        {exitMode === "TRANSFER_OWNER" && (
	                          <>
	                            <label htmlFor={`exit-target-${group.groupId}`} className="sr-only">
	                              Identificador do próximo owner
	                            </label>
	                          <input
	                            id={`exit-target-${group.groupId}`}
	                            value={exitTargetByGroup[group.groupId] ?? ""}
	                            onChange={(event) =>
	                              setExitTargetByGroup((prev) => ({ ...prev, [group.groupId]: event.target.value }))
	                            }
	                            className="w-full rounded-xl border border-white/14 bg-black/45 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/35"
	                            placeholder="Username/email do próximo owner"
	                          />
	                          </>
	                        )}

                        {selectedExitOrg?.viewerIsOrgOwner && exitMode === "KEEP_OWNER" && (
                          <p className="text-[12px] text-amber-200">
                            Organização já pertence ao teu owner. Em muitos casos usa TRANSFER_OWNER.
                          </p>
                        )}

	                        <button
	                          type="button"
	                          onClick={() => startExitRequest(group.groupId)}
	                          disabled={isBusy(`exit:${group.groupId}`) || group.organizations.length === 0}
	                          className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55 disabled:opacity-50"
	                        >
	                          {isBusy(`exit:${group.groupId}`) ? "A iniciar..." : "Iniciar saída"}
	                        </button>
	                      </>
	                    ) : (
                      <p className="text-sm text-white/66">Só o owner do grupo pode iniciar saídas.</p>
                    )}
                  </div>

	                  {group.viewerIsGroupOwner && (
	                    <div className="space-y-2 rounded-2xl border border-white/12 bg-black/25 p-3">
	                      <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/75">Transferência de owner</p>
	                      <label htmlFor={`transfer-target-${group.groupId}`} className="sr-only">
	                        Identificador do próximo owner
	                      </label>
	                      <input
	                        id={`transfer-target-${group.groupId}`}
	                        value={transferTargetByGroup[group.groupId] ?? ""}
	                        onChange={(event) =>
	                          setTransferTargetByGroup((prev) => ({ ...prev, [group.groupId]: event.target.value }))
	                        }
	                        className="w-full rounded-xl border border-white/14 bg-black/45 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/35"
	                        placeholder="Username/email do próximo owner"
	                      />
	                      <button
	                        type="button"
	                        onClick={() => startOwnerTransfer(group.groupId)}
	                        disabled={isBusy(`transfer:start:${group.groupId}`)}
	                        className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55 disabled:opacity-50"
	                      >
	                        {isBusy(`transfer:start:${group.groupId}`) ? "A iniciar..." : "Transferir owner"}
	                      </button>
	                    </div>
	                  )}
                  </div>
                </details>
              </div>

              {group.pendingTransfers.length > 0 && (
                <details className="mt-4 rounded-2xl border border-white/14 bg-white/6 p-4">
                  <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-[0.16em] text-white/80">
                    Transferências pendentes ({group.pendingTransfers.length})
                  </summary>
                  <div className="mt-3 space-y-2">
                    {group.pendingTransfers.map((transfer) => (
                      <div key={transfer.id} className="rounded-xl border border-white/12 bg-black/25 p-3 text-sm text-white/82">
                        <p>
                          {transfer.fromLabel} {"->"} {transfer.toLabel}
                        </p>
                        <p className="text-[12px] text-white/60">Expira em {formatDateTime(transfer.expiresAt)}</p>
                        {transfer.toLabel === "Tu" && (
                          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                            <label htmlFor={`transfer-token-${transfer.id}`} className="sr-only">
                              Token de confirmação da transferência
                            </label>
                            <input
                              id={`transfer-token-${transfer.id}`}
                              value={transferTokenById[transfer.id] ?? ""}
                              onChange={(event) =>
                                setTransferTokenById((prev) => ({ ...prev, [transfer.id]: event.target.value }))
                              }
                              className="w-full rounded-xl border border-white/14 bg-black/45 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/35"
                              placeholder="Token de confirmação recebido por email"
                            />
                            <button
                              type="button"
                              onClick={() => confirmOwnerTransfer(transfer)}
                              disabled={isBusy(`transfer:confirm:${transfer.id}`)}
                              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55 disabled:opacity-50"
                            >
                              {isBusy(`transfer:confirm:${transfer.id}`) ? "A confirmar..." : "Confirmar owner"}
                            </button>
                          </div>
                        )}
                        {group.viewerIsGroupOwner && transfer.fromUserId === group.ownerUserId && (
                          <button
                            type="button"
                            onClick={() => cancelOwnerTransfer(transfer)}
                            disabled={isBusy(`transfer:cancel:${transfer.id}`)}
                            className="mt-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55 disabled:opacity-50"
                          >
                            {isBusy(`transfer:cancel:${transfer.id}`) ? "A cancelar..." : "Cancelar transferência"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <details id="pedidos" className="mt-4 rounded-2xl border border-white/14 bg-white/6 p-4">
                <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-[0.16em] text-white/80">
                  Pedidos em aberto ({group.openRequests.length}){actionableOpenRequests > 0 ? ` · ${actionableOpenRequests} com ação tua` : ""}
                </summary>
                <div className="mt-3 space-y-3">
                  {group.openRequests.length === 0 && (
                    <p className="text-sm text-white/66">Sem pedidos abertos neste grupo.</p>
                  )}
                  {group.openRequests.map((request) => {
                  const codeState = codesByRequest[request.id] ?? {};
                  const isJoin = request.type === "JOIN";
                  const usesCodes = request.type !== "EXIT_KEEP_OWNER";
                  const participantOptions = isJoin
                    ? ["GROUP_OWNER", "ORG_OWNER"]
                    : request.type === "EXIT_TRANSFER_OWNER"
                      ? ["ORG_OWNER", "TARGET_OWNER"]
                      : [];
                  const allowedParticipants = participantOptions.filter((participant) => {
                    if (participant === "GROUP_OWNER") return request.canActAsGroupOwner;
                    if (participant === "ORG_OWNER") return request.canActAsOrgOwner;
                    if (participant === "TARGET_OWNER") return request.canActAsTargetOwner;
                    return false;
                  });
                  const selectedParticipant = participantByRequest[request.id] ?? "";
                  const resolvedParticipant =
                    allowedParticipants.length === 1 ? allowedParticipants[0] : selectedParticipant;
                  const typeMeta = getTypeMeta(request.type);
                  const statusMeta = getStatusMeta(request.status);

                  return (
                    <div key={request.id} className="rounded-2xl border border-white/12 bg-black/25 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            <span className={cn("rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]", typeMeta.badge)}>
                              {typeMeta.label}
                            </span>
                            <span className={cn("rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]", statusMeta.badge)}>
                              {statusMeta.label}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-white">{request.organizationName}</p>
                          <p className="text-[11px] text-white/56">
                            Criado {formatDateTime(request.createdAt)} · Expira {formatDateTime(request.expiresAt)}
                          </p>
                          <p className="text-[11px] text-white/50">
                            Códigos: {formatDateTime(request.codeExpiresAt)} · Email token: {formatDateTime(request.emailTokenExpiresAt)} · Reenvios: {request.resendCount}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1 text-[10px] uppercase tracking-[0.16em]">
                          {request.canActAsGroupOwner && (
                            <span className="rounded-full border border-[#22D3EE]/45 bg-[#22D3EE]/12 px-2 py-1 text-[#CCFCFF]">Owner do grupo</span>
                          )}
                          {request.canActAsOrgOwner && (
                            <span className="rounded-full border border-white/20 bg-white/8 px-2 py-1 text-white/75">Owner da org</span>
                          )}
                          {request.canActAsTargetOwner && (
                            <span className="rounded-full border border-white/20 bg-white/8 px-2 py-1 text-white/75">Próximo owner</span>
                          )}
                        </div>
                      </div>

                      {!request.isActionable ? (
                        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/70">
                          Sem ações disponíveis para ti neste pedido.
                        </div>
                      ) : (
                        <>
                          {request.type === "EXIT_KEEP_OWNER" ? (
                            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/70">
                              Este pedido não usa códigos. Confirma por email quando receberes o token.
                            </div>
                          ) : (
                            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                                Códigos
                              </p>
                              <div className="mt-2 grid gap-2 lg:grid-cols-2">
                                {allowedParticipants.length > 1 && (
                                  <>
                                    <label htmlFor={`participant-${request.id}`} className="sr-only">
                                      Seleciona o teu papel
                                    </label>
                                  <select
                                    id={`participant-${request.id}`}
                                    value={selectedParticipant}
                                    onChange={(event) =>
                                      setParticipantByRequest((prev) => ({
                                        ...prev,
                                        [request.id]: event.target.value,
                                      }))
                                    }
                                    className="w-full rounded-xl border border-white/14 bg-black/45 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/35"
                                  >
                                    <option value="">Seleciona o teu papel</option>
                                    {allowedParticipants.map((option) => (
                                      <option key={option} value={option}>
                                        {formatParticipantLabel(option)}
                                      </option>
                                    ))}
                                  </select>
                                  </>
                                )}

                                {allowedParticipants.length === 1 && (
                                  <div className="flex items-center rounded-xl border border-white/14 bg-black/35 px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/78">
                                    {formatParticipantLabel(allowedParticipants[0])}
                                  </div>
                                )}

                                <button
                                  type="button"
                                  onClick={() => generateCode(request, resolvedParticipant || undefined)}
                                  disabled={
                                    isBusy(`request:code:${request.id}`) ||
                                    !usesCodes ||
                                    allowedParticipants.length === 0 ||
                                    (allowedParticipants.length > 1 && !resolvedParticipant)
                                  }
                                  className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55 disabled:opacity-50"
                                >
                                  {isBusy(`request:code:${request.id}`) ? "A gerar..." : "Gerar código"}
                                </button>
                              </div>

                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                <input
                                  value={codeState.orgOwnerCode ?? ""}
                                  onChange={(event) =>
                                    setCodesByRequest((prev) => ({
                                      ...prev,
                                      [request.id]: { ...prev[request.id], orgOwnerCode: event.target.value },
                                    }))
                                  }
                                  placeholder="Código owner da org"
                                  className="w-full rounded-xl border border-white/14 bg-black/45 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/35"
                                />
                                {isJoin ? (
                                  <input
                                    value={codeState.groupOwnerCode ?? ""}
                                    onChange={(event) =>
                                      setCodesByRequest((prev) => ({
                                        ...prev,
                                        [request.id]: { ...prev[request.id], groupOwnerCode: event.target.value },
                                      }))
                                    }
                                    placeholder="Código owner do grupo"
                                    className="w-full rounded-xl border border-white/14 bg-black/45 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/35"
                                  />
                                ) : (
                                  <input
                                    value={codeState.targetOwnerCode ?? ""}
                                    onChange={(event) =>
                                      setCodesByRequest((prev) => ({
                                        ...prev,
                                        [request.id]: { ...prev[request.id], targetOwnerCode: event.target.value },
                                      }))
                                    }
                                    placeholder="Código próximo owner"
                                    className="w-full rounded-xl border border-white/14 bg-black/45 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/35"
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() => verifyCodes(request)}
                                  disabled={isBusy(`request:verify:${request.id}`)}
                                  className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55 disabled:opacity-50 sm:col-span-2"
                                >
                                  {isBusy(`request:verify:${request.id}`) ? "A validar..." : "Verificar códigos"}
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                              Email e confirmação
                            </p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              <button
                                type="button"
                                onClick={() => resendEmails(request)}
                                disabled={isBusy(`request:email:${request.id}`)}
                                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55 disabled:opacity-50"
                              >
                                {isBusy(`request:email:${request.id}`) ? "A enviar..." : "Reenviar emails"}
                              </button>
                              <label htmlFor={`email-token-${request.id}`} className="sr-only">
                                Token recebido por email
                              </label>
                              <input
                                id={`email-token-${request.id}`}
                                value={tokenByRequest[request.id] ?? ""}
                                onChange={(event) =>
                                  setTokenByRequest((prev) => ({ ...prev, [request.id]: event.target.value }))
                                }
                                placeholder="Token recebido por email"
                                className="w-full rounded-xl border border-white/14 bg-black/45 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/35"
                              />
                              <button
                                type="button"
                                onClick={() => confirmToken(request)}
                                disabled={isBusy(`request:confirm:${request.id}`)}
                                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/55 disabled:opacity-50 sm:col-span-2"
                              >
                                {isBusy(`request:confirm:${request.id}`) ? "A confirmar..." : "Confirmar token"}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                  })}
                </div>
              </details>
            </article>
          );
        })}
      </div>
    </div>
  );
}
