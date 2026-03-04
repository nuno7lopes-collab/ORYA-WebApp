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
import { ACCESS_LABELS, MODULE_LABELS, normalizeAccessLevel, resolveMemberModuleAccess } from "@/lib/organizationRbac";
import { parseOrganizationIdFromPathname } from "@/lib/organizationIdUtils";
import { resolveInviteActionFeedback } from "@/lib/invites/actionFeedback";
import {
  ROLE_PACK_LABELS,
  getAllowedRolePacksForRole,
  getDefaultRolePackForRole,
  parseOrganizationRolePack,
} from "@/lib/organizationRolePackPolicy";
import type { OrganizationMemberRole, OrganizationModule, OrganizationRolePack } from "@prisma/client";

type MemberRole = "OWNER" | "CO_OWNER" | "ADMIN" | "STAFF";
type StaffTabKey = "membros" | "permissoes" | "auditoria";
type RoleAssignmentOption = {
  value: string;
  label: string;
  role: MemberRole;
  rolePack: OrganizationRolePack | null;
};

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
type ReservasScopeType = "COURT" | "RESOURCE" | "PROFESSIONAL";
type ReservasResourceCatalogItem = {
  id: number;
  label: string;
  isActive: boolean;
  sourceType?: "RESOURCE" | "COURT";
  resourceId?: number | null;
  courtId?: number | null;
  availabilityScopeId?: number | null;
  clubName?: string | null;
};
type ReservasResourcesResponse = {
  ok: boolean;
  items?: ReservasResourceCatalogItem[];
  error?: string;
};
type ReservasProfessionalCatalogItem = {
  id: number;
  name: string;
  isActive: boolean;
};
type ReservasProfessionalsResponse = {
  ok: boolean;
  items?: ReservasProfessionalCatalogItem[];
  error?: string;
};
type CommunityScopeCatalogItem = {
  conversationId: string;
  title: string;
  participantsCount: number;
};
type CommunityScopesResponse = {
  ok: boolean;
  items?: CommunityScopeCatalogItem[];
  error?: string;
};
type ReservasScopeOption = {
  scopeId: string;
  label: string;
  hint?: string | null;
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
  STAFF: "Equipa",
};

const roleOrder: Record<MemberRole, number> = {
  OWNER: 0,
  CO_OWNER: 1,
  ADMIN: 2,
  STAFF: 3,
};

const rolePackLabels: Record<OrganizationRolePack, string> = ROLE_PACK_LABELS;
const STAFF_ROLE_PACK_OPTIONS = [...getAllowedRolePacksForRole("STAFF" as OrganizationMemberRole)] as OrganizationRolePack[];
const DEFAULT_STAFF_ROLE_PACK =
  (getDefaultRolePackForRole("STAFF" as OrganizationMemberRole) ?? STAFF_ROLE_PACK_OPTIONS[0] ?? null) as OrganizationRolePack | null;
const STAFF_ROLE_ASSIGNMENT_PLACEHOLDER = "STAFF:__UNASSIGNED__";
const GOVERNANCE_ASSIGNMENT_OPTIONS: RoleAssignmentOption[] = [
  { value: "OWNER", label: roleLabels.OWNER, role: "OWNER", rolePack: null },
  { value: "CO_OWNER", label: roleLabels.CO_OWNER, role: "CO_OWNER", rolePack: null },
  { value: "ADMIN", label: roleLabels.ADMIN, role: "ADMIN", rolePack: null },
];
const STAFF_ASSIGNMENT_OPTIONS: RoleAssignmentOption[] = STAFF_ROLE_PACK_OPTIONS.map((pack) => ({
  value: `STAFF:${pack}`,
  label: rolePackLabels[pack] ?? pack,
  role: "STAFF",
  rolePack: pack,
}));

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
  OWNER_REMOVED: "Dono removido",
  PERMISSION_UPDATED: "Permissão atualizada",
  PERMISSION_CLEARED: "Permissão removida",
};

const RESERVAS_SCOPE_TYPE_LABELS: Record<ReservasScopeType, string> = {
  COURT: "Campo",
  RESOURCE: "Recurso",
  PROFESSIONAL: "Profissional",
};

function toPositiveInt(value: string | number | null | undefined) {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function buildScopedPermissionKey(scopeType: string | null | undefined, scopeId: string | null | undefined) {
  if (!scopeType) return "";
  return `${scopeType}:${scopeId ?? ""}`;
}

const statusTone: Record<InviteStatus, string> = {
  PENDING:
    "border-amber-200/60 bg-amber-500/14 text-amber-100",
  EXPIRED: "border-white/16 bg-white/[0.04] text-white/74",
  ACCEPTED:
    "border-emerald-300/60 bg-emerald-500/14 text-emerald-100",
  DECLINED:
    "border-red-300/60 bg-red-500/16 text-red-100",
  CANCELLED: "border-white/16 bg-white/[0.04] text-white/74",
};

function canManageMember(actorRole: MemberRole | null, targetRole: MemberRole) {
  if (!actorRole) return false;
  if (actorRole === "OWNER") return true;
  if (actorRole === "CO_OWNER") return targetRole !== "OWNER";
  if (actorRole === "ADMIN") {
    return targetRole === "ADMIN" || targetRole === "STAFF";
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
    const allowed = desiredRole === "ADMIN" || desiredRole === "STAFF";
    return allowed && targetRole !== "OWNER" && targetRole !== "CO_OWNER";
  }
  return false;
}

function canAssignInviteRole(actorRole: MemberRole | null, desiredRole: MemberRole) {
  if (!actorRole) return false;
  if (actorRole === "OWNER") return true;
  if (actorRole === "CO_OWNER") return desiredRole !== "OWNER";
  if (actorRole === "ADMIN") return desiredRole === "ADMIN" || desiredRole === "STAFF";
  return false;
}

function parseMemberRole(value: unknown): MemberRole | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "OWNER" || normalized === "CO_OWNER" || normalized === "ADMIN" || normalized === "STAFF") {
    return normalized;
  }
  return null;
}

function getRolePackOptions(role: MemberRole) {
  return [...getAllowedRolePacksForRole(role as OrganizationMemberRole)] as OrganizationRolePack[];
}

function resolveRolePackForRole(
  role: MemberRole,
  rolePack: OrganizationRolePack | null | undefined,
): OrganizationRolePack | null {
  const options = getRolePackOptions(role);
  if (options.length === 0) return null;
  if (rolePack && options.includes(rolePack)) return rolePack;
  return null;
}

function resolveRoleAssignmentValue(
  role: MemberRole,
  rolePack: OrganizationRolePack | null | undefined,
) {
  if (role !== "STAFF") return role;
  const normalizedRolePack = resolveRolePackForRole("STAFF", rolePack);
  return normalizedRolePack ? `STAFF:${normalizedRolePack}` : STAFF_ROLE_ASSIGNMENT_PLACEHOLDER;
}

function parseRoleAssignmentValue(value: string): { role: MemberRole; rolePack: OrganizationRolePack | null } {
  const normalized = value.trim().toUpperCase();
  if (normalized === "OWNER" || normalized === "CO_OWNER" || normalized === "ADMIN") {
    return { role: normalized, rolePack: null };
  }
  if (normalized.startsWith("STAFF:")) {
    const parsedPack = parseOrganizationRolePack(normalized.slice("STAFF:".length));
    return { role: "STAFF", rolePack: resolveRolePackForRole("STAFF", parsedPack) };
  }
  return { role: "STAFF", rolePack: null };
}

function resolveRoleAssignmentLabel(
  role: MemberRole,
  rolePack: OrganizationRolePack | null | undefined,
) {
  if (role !== "STAFF") return roleLabels[role] ?? role;
  const normalizedRolePack = resolveRolePackForRole("STAFF", rolePack);
  if (normalizedRolePack) return rolePackLabels[normalizedRolePack] ?? normalizedRolePack;
  return "Equipa (função por definir)";
}

function RoleAssignmentBadge({
  role,
  rolePack,
  subtle,
}: {
  role: MemberRole;
  rolePack?: OrganizationRolePack | null;
  subtle?: boolean;
}) {
  if (role === "STAFF") {
    const label = resolveRoleAssignmentLabel(role, rolePack);
    const padding = subtle ? "px-2 py-[2px]" : "px-3 py-[6px]";
    return (
      <span className={`inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-400/10 ${padding} text-[11px] uppercase tracking-[0.16em] text-cyan-100`}>
        {label}
      </span>
    );
  }
  return <RoleBadge role={role} subtle={subtle} />;
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
  const fromRoleRaw = typeof metadata.fromRole === "string" ? metadata.fromRole : null;
  const toRoleRaw = typeof metadata.toRole === "string" ? metadata.toRole : null;
  const newRoleRaw = typeof metadata.newRole === "string" ? metadata.newRole : null;
  const fromRolePackRaw = typeof metadata.fromRolePack === "string" ? metadata.fromRolePack : null;
  const toRolePackRaw = typeof metadata.toRolePack === "string" ? metadata.toRolePack : null;
  const rolePackRaw = typeof metadata.rolePack === "string" ? metadata.rolePack : null;
  const fromRole = parseMemberRole(fromRoleRaw);
  const toRole = parseMemberRole(toRoleRaw);
  const newRole = parseMemberRole(newRoleRaw);
  const fromRolePack = parseOrganizationRolePack(fromRolePackRaw);
  const toRolePack = parseOrganizationRolePack(toRolePackRaw);
  const rolePack = parseOrganizationRolePack(rolePackRaw);
  if (fromRole || toRole || fromRoleRaw || toRoleRaw) {
    const fromLabel = fromRole
      ? resolveRoleAssignmentLabel(fromRole, fromRolePack)
      : fromRoleRaw ?? "";
    const toLabel = toRole
      ? resolveRoleAssignmentLabel(toRole, toRolePack)
      : toRoleRaw ?? "";
    if (fromLabel && toLabel) {
      parts.push(`Função: ${fromLabel} → ${toLabel}`);
    } else if (fromLabel || toLabel) {
      parts.push(`Função: ${fromLabel || toLabel}`);
    }
  } else if (newRole || newRoleRaw) {
    const newLabel = newRole
      ? resolveRoleAssignmentLabel(newRole, rolePack)
      : newRoleRaw ?? "";
    parts.push(`Função: ${newLabel}`);
  }
  const hasRolePayload = Boolean(fromRoleRaw || toRoleRaw || newRoleRaw);
  if (!hasRolePayload && (fromRolePack || toRolePack || fromRolePackRaw || toRolePackRaw)) {
    const fromPackLabel = fromRolePack
      ? rolePackLabels[fromRolePack] ?? fromRolePack
      : fromRolePackRaw ?? "";
    const toPackLabel = toRolePack
      ? rolePackLabels[toRolePack] ?? toRolePack
      : toRolePackRaw ?? "";
    if (fromPackLabel && toPackLabel) {
      parts.push(`Função da equipa: ${fromPackLabel} → ${toPackLabel}`);
    } else if (fromPackLabel || toPackLabel) {
      parts.push(`Função da equipa: ${fromPackLabel || toPackLabel}`);
    }
  } else if (!hasRolePayload && (rolePack || rolePackRaw)) {
    const rolePackLabel = rolePack
      ? rolePackLabels[rolePack] ?? rolePack
      : rolePackRaw ?? "";
    if (rolePackLabel) {
      parts.push(`Função da equipa: ${rolePackLabel}`);
    }
  }
  const moduleKey = typeof metadata.moduleKey === "string" ? metadata.moduleKey : null;
  if (moduleKey && Object.prototype.hasOwnProperty.call(MODULE_LABELS, moduleKey)) {
    parts.push(`Ferramenta: ${MODULE_LABELS[moduleKey as OrganizationModule]}`);
  }
  const scopeTypeRaw = typeof metadata.scopeType === "string" ? metadata.scopeType.trim().toUpperCase() : null;
  const scopeIdRaw = metadata.scopeId;
  const scopeId =
    typeof scopeIdRaw === "string" || typeof scopeIdRaw === "number"
      ? String(scopeIdRaw).trim()
      : null;
  if (scopeTypeRaw) {
    if (scopeTypeRaw === "CHAT_COMMUNITIES") {
      if (!scopeId || scopeId.toUpperCase() === "GLOBAL") {
        parts.push("Âmbito: Todas as comunidades");
      } else {
        parts.push(`Âmbito: Comunidade ${scopeId}`);
      }
    } else {
      const scopeTypeLabel =
        scopeTypeRaw in RESERVAS_SCOPE_TYPE_LABELS
          ? RESERVAS_SCOPE_TYPE_LABELS[scopeTypeRaw as ReservasScopeType]
          : scopeTypeRaw;
      parts.push(scopeId ? `Âmbito: ${scopeTypeLabel} #${scopeId}` : `Âmbito: ${scopeTypeLabel}`);
    }
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
  const [inviteRolePack, setInviteRolePack] = useState<OrganizationRolePack | null>(DEFAULT_STAFF_ROLE_PACK);
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
    newRolePack: DEFAULT_STAFF_ROLE_PACK,
    currentRole: "STAFF",
    label: "",
  });
  const [roleConfirmOpen, setRoleConfirmOpen] = useState(false);
  const [selectedPermissionUserId, setSelectedPermissionUserId] = useState<string>("");
  const [permissionSavingKey, setPermissionSavingKey] = useState<string | null>(null);
  const [scopeDraftType, setScopeDraftType] = useState<ReservasScopeType>("COURT");
  const [scopeDraftId, setScopeDraftId] = useState<string>("");
  const [scopeDraftLevel, setScopeDraftLevel] = useState<"VIEW" | "EDIT">("VIEW");
  const [communityScopeDraftId, setCommunityScopeDraftId] = useState<string>("GLOBAL");
  const [communityScopeDraftLevel, setCommunityScopeDraftLevel] = useState<"VIEW" | "EDIT">("VIEW");

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
    return null;
  }, [user, organizationId]);

  const invitesKey = useMemo(() => {
    if (!user) return null;
    if (organizationId) return `/api/org-hub/organizations/members/invites?organizationId=${organizationId}`;
    return null;
  }, [user, organizationId]);

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
  const reservasResourcesKey = useMemo(() => {
    if (!user || !resolvedOrganizationId || !canManagePermissions) return null;
    if (activeStaffTab !== "permissoes") return null;
    return `/api/org/${resolvedOrganizationId}/reservas/recursos?includeCourts=1`;
  }, [activeStaffTab, canManagePermissions, resolvedOrganizationId, user]);
  const reservasProfessionalsKey = useMemo(() => {
    if (!user || !resolvedOrganizationId || !canManagePermissions) return null;
    if (activeStaffTab !== "permissoes") return null;
    return `/api/org/${resolvedOrganizationId}/reservas/profissionais`;
  }, [activeStaffTab, canManagePermissions, resolvedOrganizationId, user]);
  const communitiesKey = useMemo(() => {
    if (!user || !resolvedOrganizationId || !canManagePermissions) return null;
    if (activeStaffTab !== "permissoes") return null;
    return `/api/messages/communities?organizationId=${resolvedOrganizationId}`;
  }, [activeStaffTab, canManagePermissions, resolvedOrganizationId, user]);
  const { data: reservasResourcesData } =
    useSWR<ReservasResourcesResponse>(reservasResourcesKey, fetcher, { revalidateOnFocus: false });
  const { data: reservasProfessionalsData } =
    useSWR<ReservasProfessionalsResponse>(reservasProfessionalsKey, fetcher, { revalidateOnFocus: false });
  const { data: communitiesData } =
    useSWR<CommunityScopesResponse>(communitiesKey, fetcher, { revalidateOnFocus: false });

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
    setCommunityScopeDraftId("GLOBAL");
    setCommunityScopeDraftLevel("VIEW");
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
    () =>
      resolveMemberModuleAccess({
        role: selectedMember?.role ?? null,
        rolePack: selectedMember?.rolePack ?? null,
        overrides: [],
      }),
    [selectedMember?.role, selectedMember?.rolePack],
  );
  const reservasScopeOptionsByType = useMemo<Record<ReservasScopeType, ReservasScopeOption[]>>(() => {
    const items = (reservasResourcesData?.items ?? []).filter((item) => item.isActive !== false);
    const courts = new Map<string, ReservasScopeOption>();
    const resources = new Map<string, ReservasScopeOption>();
    for (const item of items) {
      if ((item.sourceType ?? "RESOURCE") === "COURT") {
        const scopeId = toPositiveInt(item.courtId ?? item.id);
        if (!scopeId) continue;
        courts.set(String(scopeId), {
          scopeId: String(scopeId),
          label: item.label,
          hint: item.clubName ?? null,
        });
        continue;
      }
      const scopeId = toPositiveInt(item.resourceId ?? item.availabilityScopeId ?? item.id);
      if (!scopeId) continue;
      resources.set(String(scopeId), {
        scopeId: String(scopeId),
        label: item.label,
        hint: item.clubName ?? null,
      });
    }

    const professionals = new Map<string, ReservasScopeOption>();
    for (const professional of reservasProfessionalsData?.items ?? []) {
      if (professional.isActive === false) continue;
      const scopeId = toPositiveInt(professional.id);
      if (!scopeId) continue;
      professionals.set(String(scopeId), {
        scopeId: String(scopeId),
        label: professional.name || `Profissional #${scopeId}`,
      });
    }

    return {
      COURT: Array.from(courts.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-PT")),
      RESOURCE: Array.from(resources.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-PT")),
      PROFESSIONAL: Array.from(professionals.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-PT")),
    };
  }, [reservasProfessionalsData?.items, reservasResourcesData?.items]);
  const reservasDraftOptions = useMemo(
    () => reservasScopeOptionsByType[scopeDraftType] ?? [],
    [reservasScopeOptionsByType, scopeDraftType],
  );
  const reservasScopeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    (Object.keys(reservasScopeOptionsByType) as ReservasScopeType[]).forEach((scopeType) => {
      reservasScopeOptionsByType[scopeType].forEach((option) => {
        map.set(buildScopedPermissionKey(scopeType, option.scopeId), option.label);
      });
    });
    return map;
  }, [reservasScopeOptionsByType]);
  const communityScopeOptions = useMemo(() => {
    const options: Array<{ scopeId: string; label: string }> = [
      { scopeId: "GLOBAL", label: "Todas as comunidades" },
    ];
    for (const community of communitiesData?.items ?? []) {
      const scopeId = typeof community.conversationId === "string" ? community.conversationId.trim() : "";
      if (!scopeId) continue;
      options.push({
        scopeId,
        label: community.title?.trim() || `Comunidade ${scopeId.slice(0, 8)}`,
      });
    }
    return options;
  }, [communitiesData?.items]);
  const communityScopeLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    communityScopeOptions.forEach((option) => {
      map.set(buildScopedPermissionKey("CHAT_COMMUNITIES", option.scopeId), option.label);
    });
    return map;
  }, [communityScopeOptions]);

  useEffect(() => {
    if (reservasDraftOptions.length === 0) {
      if (scopeDraftId) setScopeDraftId("");
      return;
    }
    const hasCurrent = reservasDraftOptions.some((option) => option.scopeId === scopeDraftId);
    if (!hasCurrent) {
      setScopeDraftId(reservasDraftOptions[0].scopeId);
    }
  }, [reservasDraftOptions, scopeDraftId]);

  useEffect(() => {
    const hasCurrent = communityScopeOptions.some((option) => option.scopeId === communityScopeDraftId);
    if (!hasCurrent) {
      setCommunityScopeDraftId("GLOBAL");
    }
  }, [communityScopeDraftId, communityScopeOptions]);

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
    if (!canInvite || !canAssignInviteRole(viewerRole, inviteRole)) {
      pushToast("Não tens permissão para enviar este convite.");
      return;
    }
    const normalizedInviteRolePack = resolveRolePackForRole(inviteRole, inviteRolePack);
    if (getRolePackOptions(inviteRole).length > 0 && !normalizedInviteRolePack) {
      pushToast("Seleciona uma função para este papel.");
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
        setInviteRolePack(DEFAULT_STAFF_ROLE_PACK);
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

  const handleRoleChange = (
    member: Member,
    newRole: MemberRole,
    newRolePack: OrganizationRolePack | null,
  ) => {
    if (!canAssignRole(viewerRole, member.role, newRole)) {
      pushToast("Não tens permissão para definir este papel.");
      return;
    }
    const normalizedRolePack = resolveRolePackForRole(newRole, newRolePack);
    if (getRolePackOptions(newRole).length > 0 && !normalizedRolePack) {
      pushToast("Seleciona uma função válida para esse papel.");
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
              <section className="org-clean-section relative overflow-hidden space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">Permissões por membro</h2>
                    <p className="text-[12px] text-white/60">Overrides por ferramenta e por função base.</p>
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
                              ? "border-cyan-200/60 bg-cyan-400/10"
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
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                                  <RoleAssignmentBadge role={member.role} rolePack={member.rolePack ?? null} subtle />
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

              <section className="org-clean-section relative overflow-hidden space-y-3 p-4">
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
                          <RoleAssignmentBadge role={selectedMember.role} rolePack={selectedMember.rolePack ?? null} subtle />
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
                                className="org-clean-input rounded-full px-4 py-2 text-sm disabled:opacity-60"
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
                      <div className="mt-4 space-y-4">
                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-white">Âmbitos de Operação</p>
                              <p className="text-[11px] text-white/60">Seleciona por campo, recurso ou profissional.</p>
                            </div>
                            <span className="text-[11px] text-white/50">
                              {(permissionsByUser.get(selectedMember.userId) ?? []).filter((perm) => perm.moduleKey === "RESERVAS" && perm.scopeType).length} âmbito(s)
                            </span>
                          </div>

                          <div className="mt-3 space-y-2">
                            {(permissionsByUser.get(selectedMember.userId) ?? [])
                              .filter((perm) => perm.moduleKey === "RESERVAS" && perm.scopeType)
                              .map((perm) => {
                                const isSaving =
                                  permissionSavingKey ===
                                  `${selectedMember.userId}:${perm.moduleKey}:${perm.scopeType}:${perm.scopeId ?? "ALL"}`;
                                const scopeType = perm.scopeType as ReservasScopeType;
                                const scopeTypeLabel = RESERVAS_SCOPE_TYPE_LABELS[scopeType] ?? perm.scopeType ?? "Scope";
                                const scopeLabel =
                                  reservasScopeLabelMap.get(buildScopedPermissionKey(perm.scopeType, perm.scopeId)) ??
                                  perm.scopeId ??
                                  "—";
                                return (
                                  <div
                                    key={`${perm.id}:${perm.scopeType}:${perm.scopeId}`}
                                    className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 md:flex-row md:items-center md:justify-between"
                                  >
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold text-white">
                                        {scopeTypeLabel}: {scopeLabel}
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
                                      className="org-clean-input rounded-full px-4 py-2 text-sm disabled:opacity-60"
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
                              onChange={(e) => setScopeDraftType(e.target.value as ReservasScopeType)}
                              className="org-clean-input rounded-full px-3 py-2 text-sm"
                            >
                              {(Object.keys(RESERVAS_SCOPE_TYPE_LABELS) as ReservasScopeType[]).map((scopeType) => (
                                <option key={scopeType} value={scopeType}>
                                  {RESERVAS_SCOPE_TYPE_LABELS[scopeType]}
                                </option>
                              ))}
                            </select>
                            <select
                              value={scopeDraftId}
                              onChange={(e) => setScopeDraftId(e.target.value)}
                              disabled={reservasDraftOptions.length === 0}
                              className="org-clean-input min-w-[220px] flex-1 rounded-full px-3 py-2 text-sm disabled:opacity-60"
                            >
                              {reservasDraftOptions.length === 0 && (
                                <option value="">Sem opções disponíveis</option>
                              )}
                              {reservasDraftOptions.map((option) => (
                                <option key={`${scopeDraftType}:${option.scopeId}`} value={option.scopeId}>
                                  {option.hint ? `${option.label} · ${option.hint}` : option.label}
                                </option>
                              ))}
                            </select>
                            <select
                              value={scopeDraftLevel}
                              onChange={(e) => setScopeDraftLevel(e.target.value as "VIEW" | "EDIT")}
                              className="org-clean-input rounded-full px-3 py-2 text-sm"
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
                                  scopeDraftId,
                                )
                              }
                              disabled={!scopeDraftId || !canManageMember(viewerRole, selectedMember.role)}
                              className={`${primaryCta} disabled:opacity-60`}
                            >
                              Adicionar scope
                            </button>
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-white">Comunidades</p>
                              <p className="text-[11px] text-white/60">
                                Define acesso por comunidade no módulo Comunidade.
                              </p>
                            </div>
                            <span className="text-[11px] text-white/50">
                              {(permissionsByUser.get(selectedMember.userId) ?? []).filter(
                                (perm) =>
                                  perm.moduleKey === "MENSAGENS" &&
                                  perm.scopeType === "CHAT_COMMUNITIES",
                              ).length}{" "}
                              âmbito(s)
                            </span>
                          </div>

                          <div className="mt-3 space-y-2">
                            {(permissionsByUser.get(selectedMember.userId) ?? [])
                              .filter(
                                (perm) =>
                                  perm.moduleKey === "MENSAGENS" &&
                                  perm.scopeType === "CHAT_COMMUNITIES",
                              )
                              .map((perm) => {
                                const isSaving =
                                  permissionSavingKey ===
                                  `${selectedMember.userId}:${perm.moduleKey}:${perm.scopeType}:${perm.scopeId ?? "ALL"}`;
                                const scopeLabel =
                                  communityScopeLabelMap.get(
                                    buildScopedPermissionKey("CHAT_COMMUNITIES", perm.scopeId || "GLOBAL"),
                                  ) ?? (perm.scopeId || "GLOBAL");
                                return (
                                  <div
                                    key={`${perm.id}:${perm.scopeType}:${perm.scopeId ?? "GLOBAL"}`}
                                    className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 md:flex-row md:items-center md:justify-between"
                                  >
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold text-white">{scopeLabel}</p>
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
                                          "MENSAGENS",
                                          e.target.value,
                                          "CHAT_COMMUNITIES",
                                          perm.scopeId || "GLOBAL",
                                        )
                                      }
                                      className="org-clean-input rounded-full px-4 py-2 text-sm disabled:opacity-60"
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
                              value={communityScopeDraftId}
                              onChange={(e) => setCommunityScopeDraftId(e.target.value)}
                              className="org-clean-input min-w-[220px] flex-1 rounded-full px-3 py-2 text-sm"
                            >
                              {communityScopeOptions.map((option) => (
                                <option key={option.scopeId} value={option.scopeId}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <select
                              value={communityScopeDraftLevel}
                              onChange={(e) => setCommunityScopeDraftLevel(e.target.value as "VIEW" | "EDIT")}
                              className="org-clean-input rounded-full px-3 py-2 text-sm"
                            >
                              <option value="VIEW">Ver</option>
                              <option value="EDIT">Editar</option>
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                handlePermissionUpdate(
                                  selectedMember.userId,
                                  "MENSAGENS",
                                  communityScopeDraftLevel,
                                  "CHAT_COMMUNITIES",
                                  communityScopeDraftId || "GLOBAL",
                                )
                              }
                              disabled={!canManageMember(viewerRole, selectedMember.role)}
                              className={`${primaryCta} disabled:opacity-60`}
                            >
                              Adicionar scope
                            </button>
                          </div>
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
            <section className="org-clean-section relative overflow-hidden space-y-3 p-4">
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
          <section className="org-clean-section relative overflow-hidden space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Membros</h2>
              <p className="text-[12px] text-white/60">
                Papéis: Dono, Co-dono, Administrador e funções da equipa (Receção, Treinador, etc.).
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
                const roleAssignmentValue = resolveRoleAssignmentValue(m.role, m.rolePack);
                const roleDisabled = !canManageMemberRow || memberActionLoading === m.userId;
                const removeDisabled = memberActionLoading === m.userId || !canManageMemberRow || isOnlyOwner;
                const displayName = m.fullName || m.username || "Utilizador";
                return (
                  <div
                    key={m.userId}
                    className="flex flex-col gap-2 rounded-xl border border-white/16 bg-white/[0.03] p-3 md:flex-row md:items-center md:justify-between"
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
                          <RoleAssignmentBadge role={m.role} rolePack={m.rolePack ?? null} />
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
                        value={roleAssignmentValue}
                        disabled={roleDisabled || memberActionLoading === m.userId}
                        onChange={(e) => {
                          const nextAssignment = parseRoleAssignmentValue(e.target.value);
                          handleRoleChange(m, nextAssignment.role, nextAssignment.rolePack);
                        }}
                        className="org-clean-input rounded-full px-4 py-2 text-sm disabled:opacity-60"
                      >
                        {m.role === "STAFF" && !resolveRolePackForRole("STAFF", m.rolePack) && (
                          <option value={STAFF_ROLE_ASSIGNMENT_PLACEHOLDER} disabled>
                            Selecionar função da equipa
                          </option>
                        )}
                        <optgroup label="Governança">
                          {GOVERNANCE_ASSIGNMENT_OPTIONS.map((option) => (
                            <option
                              key={`member-governance-${option.value}`}
                              value={option.value}
                              disabled={!canAssignRole(viewerRole, m.role, option.role)}
                            >
                              {option.label}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Funções da equipa">
                          {STAFF_ASSIGNMENT_OPTIONS.map((option) => (
                            <option
                              key={`member-staff-${option.value}`}
                              value={option.value}
                              disabled={!canAssignRole(viewerRole, m.role, option.role)}
                            >
                              {option.label}
                            </option>
                          ))}
                        </optgroup>
                      </select>
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

        <section className="org-clean-section relative overflow-hidden space-y-3 p-4">
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
                    className="flex flex-col gap-2 rounded-xl border border-white/16 bg-white/[0.03] p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{targetLabel}</span>
                          <RoleAssignmentBadge role={inv.role} rolePack={inv.rolePack ?? null} subtle />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/16 bg-[#10161d] p-5">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/50">Confirmar</p>
              <h3 className="text-xl font-semibold text-white">Despromover Dono?</h3>
              <p className="text-sm text-white/70">
                Vais descer o papel de <span className="font-semibold text-white">{roleConfirm.label}</span> de Dono para {resolveRoleAssignmentLabel(roleConfirm.newRole, roleConfirm.newRolePack)}. Garante que fica pelo menos um Dono ativo.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRoleConfirmOpen(false)}
                className={glassButton}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => applyRoleChange(roleConfirm.userId, roleConfirm.newRole, roleConfirm.newRolePack)}
                className={primaryCta}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/16 bg-[#10161d] p-5">
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
                  className="org-clean-input w-full rounded-lg px-3 py-2 text-sm"
                  placeholder="email@dominio.com ou @username"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] text-white/70">Função proposta</label>
                <select
                  value={resolveRoleAssignmentValue(inviteRole, inviteRolePack)}
                  onChange={(e) => {
                    const nextAssignment = parseRoleAssignmentValue(e.target.value);
                    setInviteRole(nextAssignment.role);
                    setInviteRolePack(nextAssignment.rolePack);
                  }}
                  className="org-clean-input w-full rounded-lg px-3 py-2 text-sm"
                >
                  {inviteRole === "STAFF" && !resolveRolePackForRole("STAFF", inviteRolePack) && (
                    <option value={STAFF_ROLE_ASSIGNMENT_PLACEHOLDER} disabled>
                      Selecionar função da equipa
                    </option>
                  )}
                  <optgroup label="Governança">
                    {GOVERNANCE_ASSIGNMENT_OPTIONS.map((option) => (
                      <option
                        key={`invite-governance-${option.value}`}
                        value={option.value}
                        disabled={!canAssignInviteRole(viewerRole, option.role)}
                      >
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Funções da equipa">
                    {STAFF_ASSIGNMENT_OPTIONS.map((option) => (
                      <option
                        key={`invite-staff-${option.value}`}
                        value={option.value}
                        disabled={!canAssignInviteRole(viewerRole, option.role)}
                      >
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className={glassButton}
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleInviteSubmit}
                disabled={inviteLoading}
                className={`${primaryCta} disabled:opacity-60`}
              >
                {inviteLoading ? "A enviar…" : "Enviar convite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer modal */}
      {transferModalOpen && orgTransferEnabled && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-white/16 bg-[#10161d] p-5">
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
                  className="org-clean-input w-full rounded-lg px-3 py-2 text-sm"
                  placeholder="@destino ou email@dominio.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] text-white/70">Confirma o destino</label>
                <input
                  type="text"
                  value={transferConfirm}
                  onChange={(e) => setTransferConfirm(e.target.value)}
                  className="org-clean-input w-full rounded-lg px-3 py-2 text-sm"
                  placeholder="Escreve novamente para confirmar"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                className={glassButton}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleTransfer}
                disabled={transferLoading}
                className={`${primaryCta} disabled:opacity-60`}
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
