import crypto from "node:crypto";
import {
  ChatCommunityAccessMode,
  ChatCommunityTalkPolicy,
  OrganizationMemberRole,
  OrganizationPermissionLevel,
  OrganizationModule,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const COMMUNITY_MANAGER_SCOPE = "CHAT_COMMUNITIES";
const COMMUNITY_ADMIN_ROLES = new Set<OrganizationMemberRole>([
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
]);

const LINK_PRESET_TO_MS: Record<string, number> = {
  "10m": 10 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "8h": 8 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "2d": 2 * 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "4d": 4 * 24 * 60 * 60 * 1000,
  "5d": 5 * 24 * 60 * 60 * 1000,
  "6d": 6 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export const FOLLOWER_GRACE_MS = 24 * 60 * 60 * 1000;

export type CommunityReadOnlyReason =
  | "COMMUNITY_TEAM_ONLY"
  | "COMMUNITY_WRITE_MUTED"
  | "FOLLOW_REQUIRED";

export function parseCommunityTalkPolicy(value: unknown) {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (raw === "EVERYONE" || raw === "TEAM_ONLY") return raw as ChatCommunityTalkPolicy;
  return null;
}

export function parseCommunityAccessMode(value: unknown) {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (raw === "PUBLIC" || raw === "FOLLOWERS" || raw === "APPROVAL" || raw === "INVITE") {
    return raw as ChatCommunityAccessMode;
  }
  return null;
}

export function parseInvitePreset(value: unknown) {
  if (value == null || value === "") return { ok: true as const, ms: null as number | null };
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw) return { ok: true as const, ms: null as number | null };
  const ms = LINK_PRESET_TO_MS[raw];
  if (!ms) return { ok: false as const, error: "INVALID_PRESET" as const };
  return { ok: true as const, ms };
}

export function buildInviteExpiryFromPreset(ms: number | null) {
  if (!ms) return null;
  return new Date(Date.now() + ms);
}

export function createCommunityInviteToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashCommunityInviteToken(token: string) {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

export function canManageCommunityByRole(role: OrganizationMemberRole | null | undefined) {
  return Boolean(role && COMMUNITY_ADMIN_ROLES.has(role));
}

export async function hasCommunityManagePermission(params: {
  organizationId: number;
  userId: string;
  conversationId?: string | null;
}) {
  const rows = await prisma.organizationMemberPermission.findMany({
    where: {
      organizationId: params.organizationId,
      userId: params.userId,
      moduleKey: OrganizationModule.MENSAGENS,
      accessLevel: OrganizationPermissionLevel.EDIT,
      scopeType: COMMUNITY_MANAGER_SCOPE,
    },
    select: { scopeId: true },
  });

  if (!rows.length) return false;
  const conversationId = params.conversationId ?? null;
  return rows.some((row) => {
    const scope = (row.scopeId ?? "").trim();
    if (!scope || scope === "GLOBAL") return true;
    if (!conversationId) return false;
    return scope === conversationId;
  });
}

export async function canManageCommunity(params: {
  organizationId: number;
  userId: string;
  role: OrganizationMemberRole | null | undefined;
  conversationId?: string | null;
}) {
  if (canManageCommunityByRole(params.role)) return true;
  return hasCommunityManagePermission({
    organizationId: params.organizationId,
    userId: params.userId,
    conversationId: params.conversationId,
  });
}

export async function isUserFollowingOrganization(params: { userId: string; organizationId: number }) {
  const row = await prisma.organization_follows.findFirst({
    where: {
      follower_id: params.userId,
      organization_id: params.organizationId,
    },
    select: { id: true },
  });
  return Boolean(row);
}

export function resolveCommunityReadOnlyReason(params: {
  talkPolicy: ChatCommunityTalkPolicy;
  accessMode: ChatCommunityAccessMode;
  isTeamMember: boolean;
  isFollowing: boolean;
  followGraceEndsAt: Date | null;
  writeMutedAt: Date | null;
  writeMutedUntil: Date | null;
  now?: Date;
}) {
  const now = params.now ?? new Date();

  if (params.writeMutedAt) {
    if (!params.writeMutedUntil || params.writeMutedUntil > now) {
      return "COMMUNITY_WRITE_MUTED" satisfies CommunityReadOnlyReason;
    }
  }

  if (params.talkPolicy === "TEAM_ONLY" && !params.isTeamMember) {
    return "COMMUNITY_TEAM_ONLY" satisfies CommunityReadOnlyReason;
  }

  if (params.accessMode === "FOLLOWERS" && !params.isFollowing) {
    const grace = params.followGraceEndsAt;
    if (!grace || grace <= now) {
      return "FOLLOW_REQUIRED" satisfies CommunityReadOnlyReason;
    }
  }

  return null;
}
