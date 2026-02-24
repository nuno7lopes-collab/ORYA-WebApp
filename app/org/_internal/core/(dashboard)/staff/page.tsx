"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/app/hooks/useUser";
import { useAuthModal } from "@/app/components/autenticação/AuthModalContext";
import { ConfirmDestructiveActionDialog } from "@/app/components/ConfirmDestructiveActionDialog";
import { trackEvent } from "@/lib/analytics";
import { RoleBadge } from "../../RoleBadge";
import { CTA_DANGER, CTA_GHOST, CTA_NEUTRAL, CTA_PRIMARY, CTA_SECONDARY, CTA_SUCCESS } from "@/app/org/_internal/core/dashboardUi";
import { Avatar } from "@/components/ui/avatar";
import { ViewState } from "@/components/ui/view-state";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";
import { ACCESS_LABELS, MODULE_LABELS, getDefaultModuleAccess, normalizeAccessLevel } from "@/lib/organizationRbac";
import { parseOrganizationIdFromPathname } from "@/lib/organizationIdUtils";
import { resolveInviteActionFeedback } from "@/lib/invites/actionFeedback";
import type { OrganizationModule, OrganizationRolePack } from "@prisma/client";

type MemberRole = "OWNER" | "CO_OWNER" | "ADMIN" | "STAFF" | "PROMOTER";
type StaffTabKey = "membros" | "permissoes" | "auditoria";

type Member = {
  userId: string;
  role: MemberRole;
  rolePack?: OrganizationRolePack | null;
  invitedByUserId: string | null;
  createdAt: string;
  fullName: string | null;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
};

type MembersResponse = {
  ok: boolean;
  items: Member[];
  viewerRole?: MemberRole | null;
  organizationId?: number | null;
  error?: string;
};
type InviteStatus = "PENDING" | "EXPIRED" | "ACCEPTED" | "DECLINED" | "CANCELLED";
type Invite = {
  id: string;
  organizationId: number;
  role: MemberRole;
  rolePack?: OrganizationRolePack | null;
  targetIdentifier: string;
  targetUserId: string | null;
  status: InviteStatus;
  expiresAt: string | null;
  createdAt: string;
  invitedBy: { id: string; username: string | null; fullName: string | null; avatarUrl: string | null } | null;
  targetUser: { id: string; username: string | null; fullName: string | null; avatarUrl: string | null; email: string | null } | null;
  canRespond?: boolean;
};

type InvitesResponse = {
  ok: boolean;
  items: Invite[];
  viewerRole?: MemberRole | null;
  organizationId?: number | null;
  error?: string;
};
type MemberPermission = {
  id: number;
  userId: string;
  moduleKey: OrganizationModule;
  accessLevel: string;
  scopeType: string | null;
  scopeId: string | null;
};
type MemberPermissionsResponse = {
  ok: boolean;
  items: MemberPermission[];
  organizationId?: number | null;
  error?: string;
};
type AuditLogEntry = {
  id: string;
  action: string;
  createdAt: string | null;
  metadata: Record<string, unknown> | null;
  actor: { id: string; fullName?: string | null; username?: string | null; avatarUrl?: string | null } | null;
  fromUser: { id: string; fullName?: string | null; username?: string | null; avatarUrl?: string | null } | null;
  toUser: { id: string; fullName?: string | null; username?: string | null; avatarUrl?: string | null } | null;
};
type AuditLogResponse = {
  ok: boolean;
  items: AuditLogEntry[];
  organizationId?: number | null;
  error?: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const roleLabels: Record<MemberRole, string> = {
  OWNER: "Dono",
  CO_OWNER: "Co-dono",
  ADMIN: "Administrador",
  STAFF: "Colaborador",
  PROMOTER: "Promotor",
};

const roleOrder: Record<MemberRole, number> = {
  OWNER: 0,
  CO_OWNER: 1,
  ADMIN: 2,
  STAFF: 3,
  PROMOTER: 4,
};

const rolePackLabels: Record<OrganizationRolePack, string> = {
  CLUB_MANAGER: "Gestor de Clube",
  TOURNAMENT_DIRECTOR: "Diretor de Torneio",
  FRONT_DESK: "Front Desk",
  COACH: "Coach",
  REFEREE: "Árbitro",
};

const rolePackOptionsByRole: Partial<Record<MemberRole, OrganizationRolePack[]>> = {
  STAFF: ["CLUB_MANAGER", "TOURNAMENT_DIRECTOR", "FRONT_DESK", "COACH", "REFEREE"],
};

const defaultRolePackByRole: Partial<Record<MemberRole, OrganizationRolePack>> = {
  STAFF: "FRONT_DESK",
};

const moduleOrder: OrganizationModule[] = [
  "EVENTOS",
  "RESERVAS",
  "TORNEIOS",
  "INSCRICOES",
  "MENSAGENS",
  "LOJA",
  "MARKETING",
  "CRM",
  "FINANCEIRO",
  "STAFF",
  "PERFIL_PUBLICO",
  "DEFINICOES",
  "ANALYTICS",
];

const auditActionLabels: Record<string, string> = {
  INVITE_CREATED: "Convite enviado",
  INVITE_CANCELLED: "Convite cancelado",
  INVITE_RESENT: "Convite reenviado",
  INVITE_ACCEPTED: "Convite aceite",
  INVITE_DECLINED: "Convite recusado",
  MEMBER_ROLE_UPDATED: "Função atualizada",
  MEMBER_REMOVED: "Membro removido",
  OWNER_PROMOTED: "Dono promovido",
  OWNER_DEMOTED: "Dono despromovido",
  PERMISSION_UPDATED: "Permissao atualizada",
  PERMISSION_CLEARED: "Permissao removida",
};

const statusTone: Record<InviteStatus, string> = {
  PENDING:
    "border-amber-200/60 bg-gradient-to-r from-amber-500/25 via-amber-400/15 to-amber-600/25 text-amber-50 shadow-[0_10px_32px_rgba(251,191,36,0.25)]",
  EXPIRED: "border-white/15 bg-gradient-to-r from-white/8 via-white/4 to-white/6 text-white/60",
  ACCEPTED:
    "border-emerald-300/60 bg-gradient-to-r from-emerald-500/25 via-emerald-400/15 to-emerald-600/25 text-emerald-50 shadow-[0_10px_32px_rgba(52,211,153,0.25)]",
  DECLINED:
    "border-red-300/60 bg-gradient-to-r from-red-500/30 via-red-500/15 to-red-700/25 text-red-100 shadow-[0_10px_32px_rgba(239,68,68,0.25)]",
  CANCELLED: "border-white/15 bg-gradient-to-r from-white/8 via-white/4 to-white/6 text-white/65",
};

function canManageMember(actorRole: MemberRole | null, targetRole: MemberRole) {
  if (!actorRole) return false;
  if (actorRole === "OWNER") return true;
  if (actorRole === "CO_OWNER") return targetRole !== "OWNER";
  if (actorRole === "ADMIN") {
    return targetRole === "ADMIN" || targetRole === "STAFF" || targetRole === "PROMOTER";
  }
  return false;
}

function canAssignRole(actorRole: MemberRole | null, targetRole: MemberRole, desiredRole: MemberRole) {
  if (!actorRole) return false;
  if (actorRole === "OWNER") return true;
  if (actorRole === "CO_OWNER") {
    if (desiredRole === "OWNER") return false;
    return targetRole !== "OWNER";
  }
  if (actorRole === "ADMIN") {
    const allowed = desiredRole === "ADMIN" || desiredRole === "STAFF" || desiredRole === "PROMOTER";
    return allowed && targetRole !== "OWNER" && targetRole !== "CO_OWNER";
  }
  return false;
}

function getRolePackOptions(role: MemberRole) {
  return rolePackOptionsByRole[role] ?? [];
}

function resolveRolePackForRole(
  role: MemberRole,
  rolePack: OrganizationRolePack | null | undefined,
): OrganizationRolePack | null {
  const options = getRolePackOptions(role);
  if (options.length === 0) return null;
  if (rolePack && options.includes(rolePack)) return rolePack;
  return defaultRolePackByRole[role] ?? options[0] ?? null;
}

function resolveUserLabel(
  user: { fullName?: string | null; username?: string | null } | null | undefined,
  fallback: string,
) {
  if (!user) return fallback;
  return user.fullName || user.username || fallback;
}

function formatAuditAction(action: string) {
  return auditActionLabels[action] ?? action.replace(/_/g, " ");
}

function formatAuditMeta(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const parts: string[] = [];
  const fromRole = typeof metadata.fromRole === "string" ? metadata.fromRole : null;
  const toRole = typeof metadata.toRole === "string" ? metadata.toRole : null;
  const newRole = typeof metadata.newRole === "string" ? metadata.newRole : null;
  if (fromRole || toRole) {
    const fromLabel = roleLabels[fromRole as MemberRole] ?? fromRole ?? "";
    const toLabel = roleLabels[toRole as MemberRole] ?? toRole ?? "";
    if (fromLabel && toLabel) {
      parts.push(`Função: ${fromLabel} → ${toLabel}`);
    } else if (fromLabel || toLabel) {
      parts.push(`Função: ${fromLabel || toLabel}`);
    }
  } else if (newRole) {
    const newLabel = roleLabels[newRole as MemberRole] ?? newRole;
    parts.push(`Função: ${newLabel}`);
  }
  const fromRolePack = typeof metadata.fromRolePack === "string" ? metadata.fromRolePack : null;
  const toRolePack = typeof metadata.toRolePack === "string" ? metadata.toRolePack : null;
  const rolePack = typeof metadata.rolePack === "string" ? metadata.rolePack : null;
  if (fromRolePack || toRolePack) {
    const fromPackLabel = fromRolePack
      ? rolePackLabels[fromRolePack as OrganizationRolePack] ?? fromRolePack
      : "";
    const toPackLabel = toRolePack ? rolePackLabels[toRolePack as OrganizationRolePack] ?? toRolePack : "";
    if (fromPackLabel && toPackLabel) {
      parts.push(`Pacote: ${fromPackLabel} → ${toPackLabel}`);
    } else if (fromPackLabel || toPackLabel) {
      parts.push(`Pacote: ${fromPackLabel || toPackLabel}`);
    }
  } else if (rolePack) {
    const rolePackLabel = rolePackLabels[rolePack as OrganizationRolePack] ?? rolePack;
    parts.push(`Pacote: ${rolePackLabel}`);
  }
  const moduleKey = typeof metadata.moduleKey === "string" ? metadata.moduleKey : null;
  if (moduleKey && Object.prototype.hasOwnProperty.call(MODULE_LABELS, moduleKey)) {
    parts.push(`Ferramenta: ${MODULE_LABELS[moduleKey as OrganizationModule]}`);
  }
  const accessLevel = typeof metadata.accessLevel === "string" ? metadata.accessLevel : null;
  const normalizedAccess = normalizeAccessLevel(accessLevel);
  if (normalizedAccess) {
    parts.push(`Acesso: ${ACCESS_LABELS[normalizedAccess]}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatAuditDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function InviteBadge({ status }: { status: InviteStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-[2px] text-[11px] uppercase tracking-[0.16em] ${statusTone[status]}`}>
      {status === "PENDING" ? "Pendente" : status === "EXPIRED" ? "Expirado" : status === "ACCEPTED" ? "Aceite" : status === "DECLINED" ? "Recusado" : "Cancelado"}
    </span>
  );
}

const primaryCta = CTA_PRIMARY;
const glassButton = CTA_SECONDARY;
const ghostButton = CTA_GHOST;
const dangerPill = CTA_DANGER;
const neutralPill = CTA_NEUTRAL;
const acceptPill = CTA_SUCCESS;

type OrganizationStaffPageProps = {
  embedded?: boolean;
};

export default function OrganizationStaffPage({ embedded }: OrganizationStaffPageProps) {
  const { pushToast: publishToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, profile, isLoading: isUserLoading } = useUser();
  const { openModal } = useAuthModal();

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("STAFF");
  const [inviteRolePack, setInviteRolePack] = useState<OrganizationRolePack | null>("FRONT_DESK");
  const [inviteLoading, setInviteLoading] = useState(false);

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferConfirm, setTransferConfirm] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [memberActionLoading, setMemberActionLoading] = useState<string | null>(null);
  const [inviteActionLoading, setInviteActionLoading] = useState<string | null>(null);
  const [roleConfirm, setRoleConfirm] = useState<{ userId: string; newRole: MemberRole; newRolePack: OrganizationRolePack | null; currentRole: MemberRole; label: string }>({
    userId: "",
    newRole: "STAFF",
    newRolePack: "FRONT_DESK",
    currentRole: "STAFF",
    label: "",
  });
  const [roleConfirmOpen, setRoleConfirmOpen] = useState(false);
  const [selectedPermissionUserId, setSelectedPermissionUserId] = useState<string>("");
  const [permissionSavingKey, setPermissionSavingKey] = useState<string | null>(null);
  const [scopeDraftType, setScopeDraftType] = useState<string>("COURT");
  const [scopeDraftId, setScopeDraftId] = useState<string>("");
  const [scopeDraftLevel, setScopeDraftLevel] = useState<string>("VIEW");

  const eventIdParam = searchParams?.get("eventId");
  const eventId = eventIdParam ? Number(eventIdParam) : null;
  const organizationIdParam = searchParams?.get("organizationId") ?? null;
  const organizationIdParsed = organizationIdParam ? Number(organizationIdParam) : null;
  const organizationIdFromPath = parseOrganizationIdFromPathname(pathname);
  const organizationId =
    organizationIdParsed && Number.isFinite(organizationIdParsed)
      ? organizationIdParsed
      : organizationIdFromPath;
  const orgMeUrl = organizationId ? `/api/org/${organizationId}/me` : null;
  const { data: meData } = useSWR<{
    ok: boolean;
    organization?: { id: number; groupId?: number | null; publicName?: string | null } | null;
    orgTransferEnabled?: boolean | null;
  }>(orgMeUrl, fetcher, { revalidateOnFocus: false });
  const staffTabParam = searchParams?.get("staff");
  const activeStaffTab: StaffTabKey =
    staffTabParam === "permissoes" || staffTabParam === "auditoria"
      ? staffTabParam
      : "membros";
  const orgTransferEnabled = meData?.orgTransferEnabled ?? false;
  const resolvedGroupId =
    meData?.organization?.groupId && Number.isFinite(meData.organization.groupId)
      ? meData.organization.groupId
      : null;

  const membersKey = useMemo(() => {
    if (!user) return null;
    if (organizationId) return `/api/org-hub/organizations/members?organizationId=${organizationId}`;
    if (eventId && !Number.isNaN(eventId)) return `/api/org-hub/organizations/members?eventId=${eventId}`;
    return null;
  }, [user, organizationId, eventId]);

  const invitesKey = useMemo(() => {
    if (!user) return null;
    if (organizationId) return `/api/org-hub/organizations/members/invites?organizationId=${organizationId}`;
    if (eventId && !Number.isNaN(eventId)) return `/api/org-hub/organizations/members/invites?eventId=${eventId}`;
    return null;
  }, [user, organizationId, eventId]);

  const { data: invitesData, isLoading: isInvitesLoading, mutate: mutateInvites } = useSWR<InvitesResponse>(
    invitesKey,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { data: membersData, isLoading: isMembersLoading, mutate: mutateMembers } = useSWR<MembersResponse>(
    membersKey,
    fetcher,
    { revalidateOnFocus: false },
  );

  const members = membersData?.items ?? [];
  const invites = useMemo(() => invitesData?.items ?? [], [invitesData?.items]);
  const pendingInvites = useMemo(
    () => invites.filter((i) => i.status === "PENDING" || i.status === "EXPIRED" || i.status === "DECLINED"),
    [invites],
  );
  const viewerRole: MemberRole | null = membersData?.viewerRole ?? invitesData?.viewerRole ?? null;
  const resolvedOrganizationId = organizationId ?? membersData?.organizationId ?? invitesData?.organizationId ?? null;
  const canInvite = viewerRole === "OWNER" || viewerRole === "CO_OWNER" || viewerRole === "ADMIN";
  const canManagePermissions = canInvite;
  const ownerCount = useMemo(() => members.filter((m) => m.role === "OWNER").length, [members]);

  const permissionsKey = useMemo(() => {
    if (!user || !resolvedOrganizationId || !canManagePermissions) return null;
    if (activeStaffTab !== "permissoes") return null;
    return `/api/org-hub/organizations/members/permissions?organizationId=${resolvedOrganizationId}`;
  }, [activeStaffTab, canManagePermissions, resolvedOrganizationId, user]);
  const { data: permissionsData, isLoading: isPermissionsLoading, mutate: mutatePermissions } =
    useSWR<MemberPermissionsResponse>(permissionsKey, fetcher, { revalidateOnFocus: false });
  const permissions = permissionsData?.items ?? [];

  const auditKey = useMemo(() => {
    if (!user || !resolvedOrganizationId || !canManagePermissions) return null;
    if (activeStaffTab !== "auditoria") return null;
    return `/api/org/${resolvedOrganizationId}/audit?limit=80`;
  }, [activeStaffTab, canManagePermissions, resolvedOrganizationId, user]);
  const { data: auditData, isLoading: isAuditLoading } = useSWR<AuditLogResponse>(auditKey, fetcher, {
    revalidateOnFocus: false,
  });
  const auditLogs = useMemo(() => auditData?.items ?? [], [auditData?.items]);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      return (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
    });
  }, [members]);

  const selectedMember = useMemo(
    () => sortedMembers.find((member) => member.userId === selectedPermissionUserId) ?? null,
    [selectedPermissionUserId, sortedMembers],
  );

  useEffect(() => {
    if (sortedMembers.length === 0) {
      if (selectedPermissionUserId) setSelectedPermissionUserId("");
      return;
    }
    const hasSelected = sortedMembers.some((member) => member.userId === selectedPermissionUserId);
    if (!selectedPermissionUserId || !hasSelected) {
      setSelectedPermissionUserId(sortedMembers[0].userId);
    }
  }, [selectedPermissionUserId, sortedMembers]);

  useEffect(() => {
    setScopeDraftType("COURT");
    setScopeDraftId("");
    setScopeDraftLevel("VIEW");
  }, [selectedMember?.userId]);

  useEffect(() => {
    setInviteRolePack(resolveRolePackForRole(inviteRole, inviteRolePack));
  }, [inviteRole, inviteRolePack]);

  const permissionsByUser = useMemo(() => {
    const map = new Map<string, MemberPermission[]>();
    permissions.forEach((perm) => {
      const list = map.get(perm.userId) ?? [];
      list.push(perm);
      map.set(perm.userId, list);
    });
    return map;
  }, [permissions]);

  const selectedOverrides = useMemo(() => {
    if (!selectedMember) return new Map<OrganizationModule, MemberPermission>();
    const list = permissionsByUser.get(selectedMember.userId) ?? [];
    const map = new Map<OrganizationModule, MemberPermission>();
    list.forEach((perm) => {
      if (perm.scopeType) return;
      map.set(perm.moduleKey, perm);
    });
    return map;
  }, [permissionsByUser, selectedMember]);
  const selectedDefaults = useMemo(
    () => getDefaultModuleAccess(selectedMember?.role ?? null),
    [selectedMember?.role],
  );

  const isOrganizationProfile = profile?.roles?.includes("organization") ?? false;
  const hasMembership = !!viewerRole;

  const pushToast = (message: string, type: "error" | "success" = "error") => {
    publishToast(message, { variant: type === "success" ? "success" : "error" });
  };

  const handlePermissionUpdate = async (
    userId: string,
    moduleKey: OrganizationModule,
    accessLevel: string,
    scopeType?: string | null,
    scopeId?: string | null,
  ) => {
    if (!resolvedOrganizationId) return;
    const scopeKey = scopeType ? `${scopeType}:${scopeId ?? "ALL"}` : "GLOBAL";
    setPermissionSavingKey(`${userId}:${moduleKey}:${scopeKey}`);
    try {
      const res = await fetch("/api/org-hub/organizations/members/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: resolvedOrganizationId,
          userId,
          moduleKey,
          accessLevel,
          scopeType: scopeType ?? null,
          scopeId: scopeType ? scopeId ?? null : null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Erro ao guardar permissões.");
      }
      if (mutatePermissions) await mutatePermissions();
      pushToast("Permissões atualizadas.", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Erro ao atualizar permissões.");
    } finally {
      setPermissionSavingKey(null);
    }
  };

  const handleRequireLogin = () => {
    openModal({
      mode: "login",
      redirectTo: "/org/team",
      showGoogle: true,
    });
  };

  const handleInviteSubmit = async () => {
    if (!inviteIdentifier.trim() || !resolvedOrganizationId) {
      pushToast("Indica o email ou username a convidar.");
      return;
    }
    if (!canInvite || !canAssignRole(viewerRole, inviteRole, inviteRole)) {
      pushToast("Não tens permissão para enviar este convite.");
      return;
    }
    const normalizedInviteRolePack = resolveRolePackForRole(inviteRole, inviteRolePack);
    if (getRolePackOptions(inviteRole).length > 0 && !normalizedInviteRolePack) {
      pushToast("Seleciona um pacote para este papel.");
      return;
    }
    setInviteLoading(true);
    try {
      const res = await fetch("/api/org-hub/organizations/members/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: resolvedOrganizationId,
          identifier: inviteIdentifier.trim(),
          role: inviteRole,
          rolePack: normalizedInviteRolePack,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        pushToast(json?.error || "Não foi possível enviar o convite.");
      } else {
        pushToast("Convite enviado.", "success");
        trackEvent("organization_staff_invited", {
          organizationId: resolvedOrganizationId,
          role: inviteRole,
          rolePack: normalizedInviteRolePack,
        });
        setInviteIdentifier("");
        setInviteRole("STAFF");
        setInviteRolePack("FRONT_DESK");
        setInviteModalOpen(false);
        mutateInvites();
      }
    } catch (err) {
      console.error("[staff] invite submit error", err);
      pushToast("Erro inesperado ao enviar convite.");
    } finally {
      setInviteLoading(false);
    }
  };

  const applyRoleChange = async (
    userId: string,
    newRole: MemberRole,
    newRolePack: OrganizationRolePack | null,
  ) => {
    if (!resolvedOrganizationId) return;
    setMemberActionLoading(userId);
    try {
      const res = await fetch("/api/org-hub/organizations/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: resolvedOrganizationId,
          userId,
          role: newRole,
          rolePack: newRolePack,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        pushToast(json?.error || "Não foi possível alterar o papel.");
      } else {
        pushToast("Função atualizada.", "success");
        trackEvent("organization_staff_role_changed", {
          organizationId: resolvedOrganizationId,
          userId,
          newRole,
          rolePack: newRolePack,
        });
        mutateMembers();
      }
    } catch (err) {
      console.error("[staff] role change error", err);
      pushToast("Erro inesperado ao alterar função.");
    } finally {
      setMemberActionLoading(null);
      setRoleConfirmOpen(false);
    }
  };

  const handleRoleChange = (member: Member, newRole: MemberRole) => {
    if (!canAssignRole(viewerRole, member.role, newRole)) {
      pushToast("Não tens permissão para definir este papel.");
      return;
    }
    const normalizedRolePack = resolveRolePackForRole(newRole, member.rolePack);
    if (getRolePackOptions(newRole).length > 0 && !normalizedRolePack) {
      pushToast("Seleciona um pacote válido para esse papel.");
      return;
    }

    if (member.role === "OWNER" && newRole !== "OWNER") {
      setRoleConfirm({
        userId: member.userId,
        newRole,
        newRolePack: normalizedRolePack,
        currentRole: member.role,
        label: member.fullName || member.username || member.email || "Dono",
      });
      setRoleConfirmOpen(true);
      return;
    }
    applyRoleChange(member.userId, newRole, normalizedRolePack);
  };

  const confirmRemove = async (member: Member) => {
    if (!resolvedOrganizationId) return;
    setMemberActionLoading(member.userId);
    try {
      const res = await fetch(
        `/api/org-hub/organizations/members?organizationId=${resolvedOrganizationId}&userId=${member.userId}`,
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        pushToast(json?.error || "Não foi possível remover o membro.");
      } else {
        pushToast("Membro removido.", "success");
        mutateMembers();
        trackEvent("organization_staff_removed", {
          organizationId: resolvedOrganizationId,
          userId: member.userId,
          role: member.role,
        });
      }
    } catch (err) {
      console.error("[staff] remove error", err);
      pushToast("Erro inesperado ao remover membro.");
    } finally {
      setMemberActionLoading(null);
      setRemoveTarget(null);
    }
  };

  const handleInviteAction = async (inviteId: string, action: "CANCEL" | "ACCEPT" | "DECLINE") => {
    if (!resolvedOrganizationId) return;
    setInviteActionLoading(inviteId);
    try {
      const res = await fetch("/api/org-hub/organizations/members/invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: resolvedOrganizationId, inviteId, action }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        const feedback = resolveInviteActionFeedback(json, "Não foi possível atualizar o convite.");
        pushToast(feedback.message);
        if (feedback.shouldRefresh) {
          await mutateInvites();
          await mutateMembers();
        }
      } else {
        pushToast(
          action === "CANCEL"
            ? "Convite cancelado."
            : action === "ACCEPT"
              ? "Convite aceite."
              : "Convite recusado.",
          "success",
        );
        mutateInvites();
        if (action === "ACCEPT") {
          mutateMembers();
        }
        trackEvent("organization_staff_invite_action", { organizationId: resolvedOrganizationId, inviteId, action });
      }
    } catch (err) {
      console.error("[staff] invite action error", err);
      pushToast("Erro inesperado ao gerir convite.");
    } finally {
      setInviteActionLoading(null);
    }
  };

  const handleTransfer = async () => {
    if (!orgTransferEnabled) {
      pushToast("Transferências desativadas neste momento.");
      return;
    }
    if (!resolvedOrganizationId || !resolvedGroupId || !transferTarget.trim()) {
      pushToast("Indica o username/email de destino.");
      return;
    }
    if (transferTarget.trim() !== transferConfirm.trim()) {
      pushToast("Confirma o destino digitando o mesmo valor.");
      return;
    }
    setTransferLoading(true);
    try {
      const res = await fetch(`/api/org-hub/groups/${resolvedGroupId}/owner/transfer/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: transferTarget.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        pushToast(json?.error || "Não foi possível transferir a organização.");
      } else {
        pushToast("Pedido criado. Enviámos o pedido de confirmação ao novo Dono.", "success");
        setTransferTarget("");
        setTransferConfirm("");
        setTransferModalOpen(false);
        router.refresh();
      }
    } catch (err) {
      console.error("[staff] transfer error", err);
      pushToast("Erro inesperado ao transferir organização.");
    } finally {
      setTransferLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!resolvedOrganizationId) return;
    setLeaveLoading(true);
    try {
      const res = await fetch("/api/org-hub/organizations/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: resolvedOrganizationId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        pushToast(json?.error || "Não foi possível sair desta organização.");
      } else {
        pushToast("Saíste da organização.", "success");
        router.push("/org-hub/organizations");
      }
    } catch (err) {
      console.error("[staff] leave error", err);
      pushToast("Erro inesperado ao sair.");
    } finally {
      setLeaveLoading(false);
      setLeaveConfirmOpen(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className={cn("w-full py-8")}>
        <ViewState kind="loading" title="A carregar a tua conta…" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={cn("w-full py-8")}>
        <ViewState
          kind="empty"
          title="Equipa"
          description="Inicia sessão para gerir a equipa."
          action={
            <button
              type="button"
              onClick={handleRequireLogin}
              className={primaryCta}
            >
              Entrar
            </button>
          }
        />
      </div>
    );
  }

  const emptyClass = cn(
    embedded ? "space-y-4 text-white" : "w-full space-y-4 py-8 text-white",
  );
  const wrapperClass = cn(
    embedded ? "space-y-6 text-white" : "w-full space-y-6 py-8 text-white",
  );

  if (!isOrganizationProfile && !hasMembership) {
    return (
      <div className={emptyClass}>
        <ViewState kind="empty" title="Equipa" description="Ativa o perfil ou aceita convite." />
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <div className="flex flex-wrap items-center justify-end gap-2 text-[12px]">
        {viewerRole === "OWNER" && !orgTransferEnabled && (
          <p className="mr-auto text-[11px] text-white/55">Transferência de Dono desativada.</p>
        )}
        <div className="flex flex-wrap gap-2 text-[12px]">
            {activeStaffTab === "membros" && (
              <button
                type="button"
                onClick={() => setInviteModalOpen(true)}
                className={primaryCta}
              >
                Convidar membro
              </button>
            )}
            {viewerRole === "OWNER" && orgTransferEnabled && (
              <button
                type="button"
                onClick={() => setTransferModalOpen(true)}
                className={glassButton}
              >
                Transferir organização
              </button>
            )}
            {viewerRole && (
              <button
                type="button"
                onClick={() => setLeaveConfirmOpen(true)}
                disabled={leaveLoading}
                className={ghostButton}
              >
                {leaveLoading ? "A sair…" : "Sair da organização"}
              </button>
            )}
          </div>
      </div>

      {activeStaffTab === "permissoes" && (
        <>
          {canManagePermissions ? (
            <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
              <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050912]/90 p-4 space-y-3 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">Permissões por membro</h2>
                    <p className="text-[12px] text-white/60">Overrides por ferramenta e por role.</p>
                  </div>
                  <div className="text-[11px] text-white/60">
                    {isMembersLoading
                      ? "A carregar…"
                      : `${sortedMembers.length} membro${sortedMembers.length === 1 ? "" : "s"}`}
                  </div>
                </div>

                {isMembersLoading && (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="flex animate-pulse items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-white/10" />
                          <div className="space-y-2">
                            <div className="h-3 w-24 rounded bg-white/10" />
                            <div className="h-3 w-16 rounded bg-white/5" />
                          </div>
                        </div>
                        <div className="h-6 w-12 rounded-full bg-white/10" />
                      </div>
                    ))}
                  </div>
                )}

                {!isMembersLoading && sortedMembers.length === 0 && (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                    Sem membros para configurar.
                  </div>
                )}

                {sortedMembers.length > 0 && (
                  <div className="space-y-2">
                    {sortedMembers.map((member) => {
                      const displayName = member.fullName || member.username || "Utilizador";
                      const overridesCount = permissionsByUser.get(member.userId)?.length ?? 0;
                      const isSelected = member.userId === selectedPermissionUserId;
                      return (
                        <button
                          key={member.userId}
                          type="button"
                          onClick={() => setSelectedPermissionUserId(member.userId)}
                          className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                            isSelected
                              ? "border-cyan-200/60 bg-cyan-400/10 shadow-[0_12px_30px_rgba(34,211,238,0.25)]"
                              : "border-white/10 bg-white/5 hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <Avatar
                                src={member.avatarUrl}
                                name={displayName}
                                className="h-9 w-9 border border-white/10"
                                textClassName="text-xs font-semibold uppercase tracking-[0.16em] text-white/80"
                                fallbackText="OR"
                              />
                              <div>
                                <p className="text-sm font-semibold text-white">{displayName}</p>
                                <div className="text-[11px] text-white/60">
                                  <RoleBadge role={member.role} />
                                </div>
                              </div>
                            </div>
                            <span className="text-[11px] text-white/50">
                              {overridesCount} exceção{overridesCount === 1 ? "" : "ões"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050912]/90 p-4 space-y-3 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">Detalhe de permissões</h2>
                    <p className="text-[12px] text-white/60">Define o acesso efetivo por ferramenta.</p>
                  </div>
                  <div className="text-[11px] text-white/60">
                    {isPermissionsLoading ? "A carregar…" : "Atualiza e guarda"}
                  </div>
                </div>

                {!selectedMember && (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                    Seleciona um membro para gerir permissões.
                  </div>
                )}

                {selectedMember && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                      <Avatar
                        src={selectedMember.avatarUrl}
                        name={selectedMember.fullName || selectedMember.username || "Utilizador"}
                        className="h-10 w-10 border border-white/10"
                        textClassName="text-xs font-semibold uppercase tracking-[0.16em] text-white/80"
                        fallbackText="OR"
                      />
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {selectedMember.fullName || selectedMember.username || "Utilizador"}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                          <RoleBadge role={selectedMember.role} />
                        </div>
                      </div>
                    </div>

                    {!canManageMember(viewerRole, selectedMember.role) && (
                      <div className="rounded-lg border border-amber-300/30 bg-amber-500/10 p-3 text-[12px] text-amber-100">
                        Sem permissões para alterar este papel.
                      </div>
                    )}

                    {isPermissionsLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <div key={idx} className="h-12 rounded-xl border border-white/10 bg-white/5" />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {moduleOrder.map((moduleKey) => {
                          const moduleLabel = MODULE_LABELS[moduleKey] ?? moduleKey;
                          const override = selectedOverrides.get(moduleKey);
                          const overrideLevel = normalizeAccessLevel(override?.accessLevel ?? null);
                          const baseLevel = selectedDefaults[moduleKey];
                          const effectiveLevel = overrideLevel ?? baseLevel;
                          const isSaving = permissionSavingKey === `${selectedMember.userId}:${moduleKey}:GLOBAL`;
                          const canEdit = canManageMember(viewerRole, selectedMember.role);
                          return (
                            <div
                              key={moduleKey}
                              className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 md:flex-row md:items-center md:justify-between"
                            >
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-white">{moduleLabel}</p>
                                <p className="text-[11px] text-white/60">
                                  Base: {ACCESS_LABELS[baseLevel]} · Atual: {ACCESS_LABELS[effectiveLevel]}
                                </p>
                              </div>
                              <select
                                value={overrideLevel ?? "DEFAULT"}
                                disabled={!canEdit || isSaving}
                                onChange={(e) =>
                                  handlePermissionUpdate(selectedMember.userId, moduleKey, e.target.value)
                                }
                                className="rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] outline-none focus:border-[#22D3EE] focus:ring-2 focus:ring-[rgba(34,211,238,0.35)] disabled:opacity-60"
                              >
                                <option value="DEFAULT">Por defeito ({ACCESS_LABELS[baseLevel]})</option>
                                <option value="NONE">Sem acesso</option>
                                <option value="VIEW">Ver</option>
                                <option value="EDIT">Editar</option>
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {selectedMember && (
                      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-white">Scopes de Reservas</p>
                            <p className="text-[11px] text-white/60">Por campo, recurso ou profissional.</p>
                          </div>
                          <span className="text-[11px] text-white/50">
                            {(permissionsByUser.get(selectedMember.userId) ?? []).filter((perm) => perm.moduleKey === "RESERVAS" && perm.scopeType).length} scope(s)
                          </span>
                        </div>

                        <div className="mt-3 space-y-2">
                          {(permissionsByUser.get(selectedMember.userId) ?? [])
                            .filter((perm) => perm.moduleKey === "RESERVAS" && perm.scopeType)
                            .map((perm) => {
                              const isSaving =
                                permissionSavingKey ===
                                `${selectedMember.userId}:${perm.moduleKey}:${perm.scopeType}:${perm.scopeId ?? "ALL"}`;
                              return (
                                <div
                                  key={`${perm.id}:${perm.scopeType}:${perm.scopeId}`}
                                  className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 md:flex-row md:items-center md:justify-between"
                                >
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-white">
                                      {perm.scopeType} · {perm.scopeId}
                                    </p>
                                    <p className="text-[11px] text-white/60">
                                      Acesso: {ACCESS_LABELS[normalizeAccessLevel(perm.accessLevel) ?? "VIEW"]}
                                    </p>
                                  </div>
                                  <select
                                    value={normalizeAccessLevel(perm.accessLevel) ?? "VIEW"}
                                    disabled={!canManageMember(viewerRole, selectedMember.role) || isSaving}
                                    onChange={(e) =>
                                      handlePermissionUpdate(
                                        selectedMember.userId,
                                        perm.moduleKey,
                                        e.target.value,
                                        perm.scopeType,
                                        perm.scopeId,
                                      )
                                    }
                                    className="rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] outline-none focus:border-[#22D3EE] focus:ring-2 focus:ring-[rgba(34,211,238,0.35)] disabled:opacity-60"
                                  >
                                    <option value="DEFAULT">Remover</option>
                                    <option value="VIEW">Ver</option>
                                    <option value="EDIT">Editar</option>
                                  </select>
                                </div>
                              );
                            })}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <select
                            value={scopeDraftType}
                            onChange={(e) => setScopeDraftType(e.target.value)}
                            className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE] focus:ring-2 focus:ring-[rgba(34,211,238,0.35)]"
                          >
                            <option value="COURT">COURT</option>
                            <option value="RESOURCE">RESOURCE</option>
                            <option value="PROFESSIONAL">PROFESSIONAL</option>
                          </select>
                          <input
                            value={scopeDraftId}
                            onChange={(e) => setScopeDraftId(e.target.value)}
                            placeholder="ID"
                            className="min-w-[120px] flex-1 rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE] focus:ring-2 focus:ring-[rgba(34,211,238,0.35)]"
                          />
                          <select
                            value={scopeDraftLevel}
                            onChange={(e) => setScopeDraftLevel(e.target.value)}
                            className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#22D3EE] focus:ring-2 focus:ring-[rgba(34,211,238,0.35)]"
                          >
                            <option value="VIEW">Ver</option>
                            <option value="EDIT">Editar</option>
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              handlePermissionUpdate(
                                selectedMember.userId,
                                "RESERVAS",
                                scopeDraftLevel,
                                scopeDraftType,
                                scopeDraftId.trim(),
                              )
                            }
                            disabled={!scopeDraftId.trim() || !canManageMember(viewerRole, selectedMember.role)}
                            className="rounded-full border border-cyan-200/50 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(34,211,238,0.25)] transition hover:border-cyan-200/80 disabled:opacity-60"
                          >
                            Adicionar scope
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          ) : (
            <section className="rounded-3xl border border-white/12 bg-white/5 p-4 text-sm text-white/70">
              Sem permissões para gerir acessos.
            </section>
          )}
        </>
      )}

      {activeStaffTab === "auditoria" && (
        <>
          {canManagePermissions ? (
            <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050912]/90 p-4 space-y-3 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Auditoria</h2>
                  <p className="text-[12px] text-white/60">Últimas ações registadas.</p>
                </div>
                <div className="text-[11px] text-white/60">
                  {isAuditLoading ? "A carregar…" : `${auditLogs.length} registo${auditLogs.length === 1 ? "" : "s"}`}
                </div>
              </div>

              {isAuditLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="h-14 rounded-xl border border-white/10 bg-white/5" />
                  ))}
                </div>
              )}

              {!isAuditLoading && auditLogs.length === 0 && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                  Sem ações registadas recentemente.
                </div>
              )}

              {auditLogs.length > 0 && (
                <div className="space-y-2">
                  {auditLogs.map((entry) => {
                    const actorLabel = entry.actor
                      ? resolveUserLabel(entry.actor, entry.actor.id.slice(0, 8))
                      : "Sistema";
                    const targetUser = entry.toUser ?? entry.fromUser;
                    const targetLabel = targetUser ? resolveUserLabel(targetUser, "Utilizador") : null;
                    const actionLabel = formatAuditAction(entry.action);
                    const metaLabel = formatAuditMeta(entry.metadata);
                    return (
                      <div
                        key={entry.id}
                        className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={entry.actor?.avatarUrl ?? null}
                            name={actorLabel}
                            className="h-9 w-9 border border-white/10"
                            textClassName="text-xs font-semibold uppercase tracking-[0.16em] text-white/80"
                            fallbackText="AU"
                          />
                          <div>
                            <p className="text-sm font-semibold text-white">{actionLabel}</p>
                            <p className="text-[12px] text-white/60">
                              {targetLabel ? `${actorLabel} → ${targetLabel}` : actorLabel}
                            </p>
                            {metaLabel && <p className="text-[11px] text-white/45">{metaLabel}</p>}
                          </div>
                        </div>
                        <span className="text-[11px] text-white/50">{formatAuditDate(entry.createdAt)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-3xl border border-white/12 bg-white/5 p-4 text-sm text-white/70">
              Sem permissões para ver auditoria.
            </section>
          )}
        </>
      )}

      {activeStaffTab === "membros" && (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050912]/90 p-4 space-y-3 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Membros</h2>
              <p className="text-[12px] text-white/60">
                Papéis: Dono, Co-dono, Administrador, Colaborador e Promotor.
              </p>
            </div>
            <div className="text-[11px] text-white/60">
              {isMembersLoading ? "A carregar…" : `${sortedMembers.length} membro${sortedMembers.length === 1 ? "" : "s"}`}
            </div>
          </div>

          {isMembersLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="flex animate-pulse items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white/10" />
                    <div className="space-y-2">
                      <div className="h-3 w-32 rounded bg-white/10" />
                      <div className="h-3 w-24 rounded bg-white/5" />
                    </div>
                  </div>
                  <div className="h-8 w-28 rounded-full bg-white/5" />
                </div>
              ))}
            </div>
          )}

          {!isMembersLoading && sortedMembers.length === 0 && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
              <p>Sem membros. Convida um admin.</p>
            </div>
          )}

          {sortedMembers.length > 0 && (
            <div className="space-y-2">
              {sortedMembers.map((m) => {
                const isOwnerRow = m.role === "OWNER";
                const isOnlyOwner = isOwnerRow && ownerCount <= 1;
                const canManageMemberRow = canManageMember(viewerRole, m.role);
                const rolePackOptions = getRolePackOptions(m.role);
                const hasRolePackOptions = rolePackOptions.length > 0;
                const roleDisabled = !canManageMemberRow || memberActionLoading === m.userId;
                const rolePackDisabled = !canManageMemberRow || memberActionLoading === m.userId;
                const removeDisabled = memberActionLoading === m.userId || !canManageMemberRow || isOnlyOwner;
                const displayName = m.fullName || m.username || "Utilizador";
                return (
                  <div
                    key={m.userId}
                    className="flex flex-col gap-2 rounded-xl border border-white/12 bg-gradient-to-r from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.45)] md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar
                        src={m.avatarUrl}
                        name={displayName}
                        className="h-10 w-10 border border-white/10"
                        textClassName="text-sm font-semibold uppercase tracking-[0.16em] text-white/80"
                        fallbackText="OR"
                      />
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white">{displayName}</span>
                          <RoleBadge role={m.role} />
                          {m.rolePack && (
                            <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2 py-[2px] text-[10px] uppercase tracking-[0.15em] text-cyan-100">
                              {rolePackLabels[m.rolePack]}
                            </span>
                          )}
                          <span className="text-[11px] text-white/50">
                            {new Date(m.createdAt).toLocaleDateString("pt-PT")}
                          </span>
                        </div>
                        <div className="text-[12px] text-white/60 space-x-2">
                          {m.username && <span>@{m.username}</span>}
                          {m.email && <span className="text-white/50">· {m.email}</span>}
                          {isOnlyOwner && <span className="text-red-300">· Último Dono</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={m.role}
                        disabled={roleDisabled || memberActionLoading === m.userId}
                        onChange={(e) => handleRoleChange(m, e.target.value as MemberRole)}
                        className="rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] outline-none focus:border-[#22D3EE] focus:ring-2 focus:ring-[rgba(34,211,238,0.35)] disabled:opacity-60"
                      >
                        <option value="OWNER" disabled={!canAssignRole(viewerRole, m.role, "OWNER")}>
                          Dono
                        </option>
                        <option value="CO_OWNER" disabled={!canAssignRole(viewerRole, m.role, "CO_OWNER")}>
                          Co-dono
                        </option>
                        <option value="ADMIN" disabled={!canAssignRole(viewerRole, m.role, "ADMIN")}>
                          Administrador
                        </option>
                        <option value="STAFF" disabled={!canAssignRole(viewerRole, m.role, "STAFF")}>
                          Colaborador
                        </option>
                        <option value="PROMOTER" disabled={!canAssignRole(viewerRole, m.role, "PROMOTER")}>
                          Promotor
                        </option>
                      </select>
                      {hasRolePackOptions && (
                        <select
                          value={m.rolePack ?? ""}
                          disabled={rolePackDisabled}
                          onChange={(e) => {
                            const value = e.target.value.trim();
                            const nextPack = value ? (value as OrganizationRolePack) : null;
                            applyRoleChange(m.userId, m.role, nextPack);
                          }}
                          className="rounded-full border border-white/15 bg-black/40 px-4 py-2 text-sm text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] outline-none focus:border-[#22D3EE] focus:ring-2 focus:ring-[rgba(34,211,238,0.35)] disabled:opacity-60"
                        >
                          <option value="" disabled>
                            Selecionar pacote
                          </option>
                          {rolePackOptions.map((pack) => (
                            <option key={pack} value={pack}>
                              {rolePackLabels[pack]}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(m)}
                        disabled={removeDisabled}
                        className={`${dangerPill} ${removeDisabled ? "opacity-60" : ""}`}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1226]/75 to-[#050912]/90 p-4 space-y-3 shadow-[0_26px_90px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Convites</h2>
              <p className="text-[12px] text-white/60">Pendentes e reenvios.</p>
            </div>
            <div className="text-[11px] text-white/60">
              {isInvitesLoading ? "A carregar…" : `${pendingInvites.length} convite${pendingInvites.length === 1 ? "" : "s"}`}
            </div>
          </div>

          {isInvitesLoading && (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, idx) => (
                <div key={idx} className="flex animate-pulse justify-between rounded-xl border border-white/12 bg-white/5 p-3">
                  <div className="space-y-2">
                    <div className="h-3 w-40 rounded bg-white/10" />
                    <div className="h-3 w-24 rounded bg-white/5" />
                  </div>
                  <div className="h-8 w-24 rounded-full bg-white/10" />
                </div>
              ))}
            </div>
          )}

          {!isInvitesLoading && pendingInvites.length === 0 && (
            <div className="rounded-lg border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/70">
              Sem convites pendentes.
            </div>
          )}

          {pendingInvites.length > 0 && (
            <div className="space-y-2">
              {pendingInvites.map((inv) => {
                const isPending = inv.status === "PENDING";
                const isExpired = inv.status === "EXPIRED";
                const canRespond = inv.canRespond && isPending;
                const targetLabel =
                  inv.targetUser?.fullName ||
                  inv.targetUser?.username ||
                  inv.targetIdentifier ||
                  "Convite";
                return (
                  <div
                    key={inv.id}
                    className="flex flex-col gap-2 rounded-xl border border-white/12 bg-gradient-to-r from-white/6 via-[#0c1628]/60 to-[#050912]/85 p-3 shadow-[0_14px_45px_rgba(0,0,0,0.45)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{targetLabel}</span>
                          <RoleBadge role={inv.role} />
                          {inv.rolePack && (
                            <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2 py-[2px] text-[10px] uppercase tracking-[0.15em] text-cyan-100">
                              {rolePackLabels[inv.rolePack]}
                            </span>
                          )}
                          <InviteBadge status={inv.status} />
                        </div>
                        <div className="text-[12px] text-white/60 space-x-2">
                          <span>{inv.targetIdentifier}</span>
                          {inv.targetUser?.email && <span className="text-white/50">· {inv.targetUser.email}</span>}
                          {inv.expiresAt && (
                            <span className="text-white/50">
                              · {isExpired ? "Expirou" : "Expira"} {new Date(inv.expiresAt).toLocaleDateString("pt-PT")}
                            </span>
                          )}
                        </div>
                        {inv.invitedBy && (
                          <p className="text-[11px] text-white/45">
                            Enviado por {inv.invitedBy.fullName || inv.invitedBy.username || "dono"}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {canRespond && (
                          <>
                            <button
                              type="button"
                              disabled={inviteActionLoading === inv.id}
                              onClick={() => handleInviteAction(inv.id, "DECLINE")}
                              className={`${neutralPill} ${inviteActionLoading === inv.id ? "opacity-60" : ""}`}
                            >
                              Recusar
                            </button>
                            <button
                              type="button"
                              disabled={inviteActionLoading === inv.id}
                              onClick={() => handleInviteAction(inv.id, "ACCEPT")}
                              className={`${acceptPill} ${inviteActionLoading === inv.id ? "opacity-60" : ""}`}
                            >
                              Aceitar
                            </button>
                          </>
                        )}
                        {canInvite && (
                          <button
                            type="button"
                            disabled={inviteActionLoading === inv.id}
                            onClick={() => handleInviteAction(inv.id, "CANCEL")}
                            className={`${dangerPill} ${inviteActionLoading === inv.id ? "opacity-60" : ""}`}
                          >
                            Cancelar
                          </button>
                        )}
                        {!canRespond && !canInvite && (
                          <span className="text-[11px] text-white/50">A aguardar resposta.</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        </div>
      )}

      <ConfirmDestructiveActionDialog
        open={removeTarget !== null}
        title="Remover membro da equipa?"
        description={`Isto remove ${removeTarget?.fullName || removeTarget?.username || "este membro"} desta organização.`}
        consequences={["Perde o acesso ao dashboard e check-ins desta organização."]}
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        dangerLevel="high"
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) confirmRemove(removeTarget);
        }}
      />
      <ConfirmDestructiveActionDialog
        open={leaveConfirmOpen}
        title="Sair desta organização?"
        description="Perdes acesso ao dashboard e às equipas desta organização."
        confirmLabel="Sair"
        cancelLabel="Cancelar"
        dangerLevel="medium"
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={handleLeave}
      />

      {/* Role confirm modal */}
      {roleConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/10 bg-[#0c1424] p-5 shadow-2xl">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/50">Confirmar</p>
              <h3 className="text-xl font-semibold text-white">Despromover Dono?</h3>
              <p className="text-sm text-white/70">
                Vais descer o papel de <span className="font-semibold text-white">{roleConfirm.label}</span> de Dono para {roleLabels[roleConfirm.newRole]}. Garante que fica pelo menos um Dono ativo.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRoleConfirmOpen(false)}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => applyRoleChange(roleConfirm.userId, roleConfirm.newRole, roleConfirm.newRolePack)}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/10 bg-[#0c1424] p-5 shadow-2xl">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/50">Convite</p>
              <h3 className="text-xl font-semibold text-white">Convidar membro</h3>
              <p className="text-sm text-white/70">Email ou username. Expira em 14 dias.</p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[12px] text-white/70">Email / utilizador</label>
                <input
                  type="text"
                  value={inviteIdentifier}
                  onChange={(e) => setInviteIdentifier(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#22D3EE]"
                  placeholder="email@dominio.com ou @username"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] text-white/70">Função proposta</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as MemberRole)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#22D3EE]"
                >
                  <option value="OWNER" disabled={!canAssignRole(viewerRole, inviteRole, "OWNER")}>
                    Dono
                  </option>
                  <option value="CO_OWNER" disabled={!canAssignRole(viewerRole, inviteRole, "CO_OWNER")}>
                    Co-dono
                  </option>
                  <option value="ADMIN" disabled={!canAssignRole(viewerRole, inviteRole, "ADMIN")}>
                    Administrador
                  </option>
                  <option value="STAFF" disabled={!canAssignRole(viewerRole, inviteRole, "STAFF")}>
                    Colaborador
                  </option>
                  <option value="PROMOTER" disabled={!canAssignRole(viewerRole, inviteRole, "PROMOTER")}>
                    Promotor
                  </option>
                </select>
              </div>
              {getRolePackOptions(inviteRole).length > 0 && (
                <div className="space-y-1">
                  <label className="text-[12px] text-white/70">Pack</label>
                  <select
                    value={inviteRolePack ?? ""}
                    onChange={(e) => {
                      const value = e.target.value.trim();
                      setInviteRolePack(value ? (value as OrganizationRolePack) : null);
                    }}
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#22D3EE]"
                  >
                    {getRolePackOptions(inviteRole).map((pack) => (
                      <option key={pack} value={pack}>
                        {rolePackLabels[pack]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleInviteSubmit}
                disabled={inviteLoading}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow disabled:opacity-60"
              >
                {inviteLoading ? "A enviar…" : "Enviar convite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer modal */}
      {transferModalOpen && orgTransferEnabled && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/10 bg-[#0c1424] p-5 shadow-2xl">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/50">Transferir organização</p>
              <h3 className="text-xl font-semibold text-white">Passar a propriedade</h3>
              <p className="text-sm text-white/70">
                A organização será atribuída ao destino como Dono. O teu papel passa para Administrador automaticamente.
              </p>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[12px] text-white/70">Utilizador / email do novo Dono</label>
                <input
                  type="text"
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#22D3EE]"
                  placeholder="@destino ou email@dominio.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] text-white/70">Confirma o destino</label>
                <input
                  type="text"
                  value={transferConfirm}
                  onChange={(e) => setTransferConfirm(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#22D3EE]"
                  placeholder="Escreve novamente para confirmar"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleTransfer}
                disabled={transferLoading}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow disabled:opacity-60"
              >
                {transferLoading ? "A transferir…" : "Transferir"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
