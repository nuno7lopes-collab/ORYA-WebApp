import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { sanitizeProfileVisibility } from "@/lib/profileVisibility";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { normalizeEmail } from "@/lib/utils/email";

type InviteStatus = "PENDING" | "EXPIRED" | "ACCEPTED" | "DECLINED" | "CANCELLED";
type InviteType = "ORGANIZATION_MEMBER" | "CLUB_STAFF" | "TEAM_MEMBER";

const buildInviteStatus = (invite: {
  expiresAt: Date;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  cancelledAt: Date | null;
}): InviteStatus => {
  const now = Date.now();
  const isExpired = !!invite.expiresAt && invite.expiresAt.getTime() < now;
  return invite.cancelledAt
    ? "CANCELLED"
    : invite.acceptedAt
      ? "ACCEPTED"
      : invite.declinedAt
        ? "DECLINED"
        : isExpired
          ? "EXPIRED"
          : "PENDING";
};

const canViewerRespond = (
  invite: { targetIdentifier: string; targetUserId: string | null },
  viewer: { id: string; username?: string | null; email?: string | null },
) => {
  const normalizedTarget = invite.targetIdentifier.toLowerCase();
  return (
    invite.targetUserId === viewer.id ||
    (viewer.username ? viewer.username.toLowerCase() === normalizedTarget : false) ||
    (viewer.email ? viewer.email.toLowerCase() === normalizedTarget : false)
  );
};

const profileSelect = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
  visibility: true,
  isDeleted: true,
} satisfies Prisma.ProfileSelect;

const organizationSelect = {
  id: true,
  publicName: true,
  username: true,
  businessName: true,
  entityType: true,
  brandingAvatarUrl: true,
  brandingCoverUrl: true,
  addressRef: { select: { formattedAddress: true, canonical: true } },
} satisfies Prisma.OrganizationSelect;

type SerializedInvite = {
  id: string;
  inviteType: InviteType;
  organizationId: number;
  role: string;
  targetIdentifier: string;
  targetUserId: string | null;
  status: InviteStatus;
  expiresAt: string | null;
  createdAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  cancelledAt: string | null;
  invitedBy: ReturnType<typeof sanitizeProfileVisibility>;
  targetUser: ReturnType<typeof sanitizeProfileVisibility>;
  organization:
    | {
        id: number;
        publicName: string | null;
        username: string | null;
        businessName: string | null;
        entityType: string | null;
        brandingAvatarUrl: string | null;
        brandingCoverUrl: string | null;
        addressRef?: { formattedAddress: string | null; canonical: Prisma.JsonValue | null } | null;
      }
    | null;
  canRespond: boolean;
  padelClubId?: number | null;
  padelClub?: { id: number; name: string } | null;
  teamId?: number | null;
  team?: { id: number; name: string } | null;
};

const serializeOrganizationInvite = (
  invite: {
    id: string;
    organizationId: number;
    targetIdentifier: string;
    targetUserId: string | null;
    role: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    declinedAt: Date | null;
    cancelledAt: Date | null;
    createdAt: Date | null;
    invitedBy?: {
      id: string;
      username: string | null;
      fullName: string | null;
      avatarUrl: string | null;
      visibility?: string | null;
      isDeleted?: boolean | null;
    } | null;
    targetUser?: {
      id: string;
      username: string | null;
      fullName: string | null;
      avatarUrl: string | null;
      visibility?: string | null;
      isDeleted?: boolean | null;
    } | null;
    organization?: {
      id: number;
      publicName: string | null;
      username: string | null;
      businessName: string | null;
      entityType: string | null;
      brandingAvatarUrl: string | null;
      brandingCoverUrl: string | null;
      addressRef?: { formattedAddress: string | null; canonical: Prisma.JsonValue | null } | null;
    } | null;
  },
  viewer: { id: string; username?: string | null; email?: string | null },
  options?: { tokenMatches?: boolean },
): SerializedInvite => {
  const status = buildInviteStatus(invite);
  const canRespond = options?.tokenMatches ? true : canViewerRespond(invite, viewer);
  return {
    id: invite.id,
    inviteType: "ORGANIZATION_MEMBER",
    organizationId: invite.organizationId,
    role: invite.role,
    targetIdentifier: invite.targetIdentifier,
    targetUserId: invite.targetUserId,
    status,
    expiresAt: invite.expiresAt?.toISOString() ?? null,
    createdAt: invite.createdAt?.toISOString() ?? null,
    acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    declinedAt: invite.declinedAt?.toISOString() ?? null,
    cancelledAt: invite.cancelledAt?.toISOString() ?? null,
    invitedBy: sanitizeProfileVisibility(invite.invitedBy ?? null),
    targetUser: sanitizeProfileVisibility(invite.targetUser ?? null),
    organization: invite.organization ?? null,
    canRespond,
  };
};

const serializeClubStaffInvite = (
  invite: {
    id: string;
    organizationId: number;
    padelClubId: number;
    targetIdentifier: string;
    targetUserId: string | null;
    role: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    declinedAt: Date | null;
    cancelledAt: Date | null;
    createdAt: Date | null;
    invitedBy?: {
      id: string;
      username: string | null;
      fullName: string | null;
      avatarUrl: string | null;
      visibility?: string | null;
      isDeleted?: boolean | null;
    } | null;
    targetUser?: {
      id: string;
      username: string | null;
      fullName: string | null;
      avatarUrl: string | null;
      visibility?: string | null;
      isDeleted?: boolean | null;
    } | null;
    organization?: {
      id: number;
      publicName: string | null;
      username: string | null;
      businessName: string | null;
      entityType: string | null;
      brandingAvatarUrl: string | null;
      brandingCoverUrl: string | null;
      addressRef?: { formattedAddress: string | null; canonical: Prisma.JsonValue | null } | null;
    } | null;
    club?: { id: number; name: string } | null;
  },
  viewer: { id: string; username?: string | null; email?: string | null },
  options?: { tokenMatches?: boolean },
): SerializedInvite => {
  const status = buildInviteStatus(invite);
  const canRespond = options?.tokenMatches ? true : canViewerRespond(invite, viewer);
  return {
    id: invite.id,
    inviteType: "CLUB_STAFF",
    organizationId: invite.organizationId,
    role: invite.role,
    targetIdentifier: invite.targetIdentifier,
    targetUserId: invite.targetUserId,
    status,
    expiresAt: invite.expiresAt?.toISOString() ?? null,
    createdAt: invite.createdAt?.toISOString() ?? null,
    acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    declinedAt: invite.declinedAt?.toISOString() ?? null,
    cancelledAt: invite.cancelledAt?.toISOString() ?? null,
    invitedBy: sanitizeProfileVisibility(invite.invitedBy ?? null),
    targetUser: sanitizeProfileVisibility(invite.targetUser ?? null),
    organization: invite.organization ?? null,
    canRespond,
    padelClubId: invite.padelClubId,
    padelClub: invite.club ?? null,
  };
};

const serializeTeamMemberInvite = (
  invite: {
    id: string;
    organizationId: number;
    teamId: number;
    targetIdentifier: string;
    targetUserId: string | null;
    role: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    declinedAt: Date | null;
    cancelledAt: Date | null;
    createdAt: Date | null;
    invitedBy?: {
      id: string;
      username: string | null;
      fullName: string | null;
      avatarUrl: string | null;
      visibility?: string | null;
      isDeleted?: boolean | null;
    } | null;
    targetUser?: {
      id: string;
      username: string | null;
      fullName: string | null;
      avatarUrl: string | null;
      visibility?: string | null;
      isDeleted?: boolean | null;
    } | null;
    organization?: {
      id: number;
      publicName: string | null;
      username: string | null;
      businessName: string | null;
      entityType: string | null;
      brandingAvatarUrl: string | null;
      brandingCoverUrl: string | null;
      addressRef?: { formattedAddress: string | null; canonical: Prisma.JsonValue | null } | null;
    } | null;
    team?: { id: number; name: string } | null;
  },
  viewer: { id: string; username?: string | null; email?: string | null },
  options?: { tokenMatches?: boolean },
): SerializedInvite => {
  const status = buildInviteStatus(invite);
  const canRespond = options?.tokenMatches ? true : canViewerRespond(invite, viewer);
  return {
    id: invite.id,
    inviteType: "TEAM_MEMBER",
    organizationId: invite.organizationId,
    role: invite.role,
    targetIdentifier: invite.targetIdentifier,
    targetUserId: invite.targetUserId,
    status,
    expiresAt: invite.expiresAt?.toISOString() ?? null,
    createdAt: invite.createdAt?.toISOString() ?? null,
    acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    declinedAt: invite.declinedAt?.toISOString() ?? null,
    cancelledAt: invite.cancelledAt?.toISOString() ?? null,
    invitedBy: sanitizeProfileVisibility(invite.invitedBy ?? null),
    targetUser: sanitizeProfileVisibility(invite.targetUser ?? null),
    organization: invite.organization ?? null,
    canRespond,
    teamId: invite.teamId,
    team: invite.team ?? null,
  };
};

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { username: true },
    });

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);
    const perSourceLimit = Math.min(limit, 300);
    const inviteId = url.searchParams.get("invite") ?? url.searchParams.get("inviteId");
    const token = url.searchParams.get("token");

    const viewerEmail = normalizeEmail(user.email ?? null);
    const viewerUsername = profile?.username?.trim().toLowerCase() ?? null;
    const viewer = { id: user.id, username: viewerUsername, email: viewerEmail };

    const targetClauses = [
      { targetUserId: user.id },
      ...(viewerEmail
        ? [{ targetIdentifier: { equals: viewerEmail, mode: Prisma.QueryMode.insensitive } }]
        : []),
      ...(viewerUsername
        ? [{ targetIdentifier: { equals: viewerUsername, mode: Prisma.QueryMode.insensitive } }]
        : []),
    ];

    const organizationInviteInclude = {
      invitedBy: { select: profileSelect },
      targetUser: { select: profileSelect },
      organization: { select: organizationSelect },
    } satisfies Prisma.OrganizationMemberInviteInclude;

    const clubStaffInviteInclude = {
      invitedBy: { select: profileSelect },
      targetUser: { select: profileSelect },
      organization: { select: organizationSelect },
      club: { select: { id: true, name: true } },
    } satisfies Prisma.PadelClubStaffInviteInclude;

    const teamMemberInviteInclude = {
      invitedBy: { select: profileSelect },
      targetUser: { select: profileSelect },
      organization: { select: organizationSelect },
      team: { select: { id: true, name: true } },
    } satisfies Prisma.PadelTeamMemberInviteInclude;

    const [orgInvites, clubStaffInvites, teamMemberInvites] = await Promise.all([
      prisma.organizationMemberInvite.findMany({
        where: { OR: targetClauses },
        include: organizationInviteInclude,
        orderBy: { createdAt: "desc" },
        take: perSourceLimit,
      }),
      prisma.padelClubStaffInvite.findMany({
        where: { OR: targetClauses },
        include: clubStaffInviteInclude,
        orderBy: { createdAt: "desc" },
        take: perSourceLimit,
      }),
      prisma.padelTeamMemberInvite.findMany({
        where: { OR: targetClauses },
        include: teamMemberInviteInclude,
        orderBy: { createdAt: "desc" },
        take: perSourceLimit,
      }),
    ]);

    const keyed = new Map<string, SerializedInvite>();
    for (const invite of orgInvites) {
      keyed.set(
        `org:${invite.id}`,
        serializeOrganizationInvite(invite, viewer),
      );
    }
    for (const invite of clubStaffInvites) {
      keyed.set(
        `club-staff:${invite.id}`,
        serializeClubStaffInvite(invite, viewer),
      );
    }
    for (const invite of teamMemberInvites) {
      keyed.set(
        `team-member:${invite.id}`,
        serializeTeamMemberInvite(invite, viewer),
      );
    }

    if (inviteId || token) {
      const [orgTokenInvite, clubTokenInvite, teamTokenInvite] = await Promise.all([
        prisma.organizationMemberInvite.findFirst({
          where: {
            ...(inviteId ? { id: inviteId } : {}),
            ...(token ? { token } : {}),
          },
          include: organizationInviteInclude,
        }),
        prisma.padelClubStaffInvite.findFirst({
          where: {
            ...(inviteId ? { id: inviteId } : {}),
            ...(token ? { token } : {}),
          },
          include: clubStaffInviteInclude,
        }),
        prisma.padelTeamMemberInvite.findFirst({
          where: {
            ...(inviteId ? { id: inviteId } : {}),
            ...(token ? { token } : {}),
          },
          include: teamMemberInviteInclude,
        }),
      ]);

      if (orgTokenInvite) {
        const viewerMatch = canViewerRespond(orgTokenInvite, viewer);
        const tokenMatch = token ? orgTokenInvite.token === token : false;
        if (viewerMatch || tokenMatch) {
          keyed.set(
            `org:${orgTokenInvite.id}`,
            serializeOrganizationInvite(orgTokenInvite, viewer, { tokenMatches: tokenMatch }),
          );
        }
      }

      if (clubTokenInvite) {
        const viewerMatch = canViewerRespond(clubTokenInvite, viewer);
        const tokenMatch = token ? clubTokenInvite.token === token : false;
        if (viewerMatch || tokenMatch) {
          keyed.set(
            `club-staff:${clubTokenInvite.id}`,
            serializeClubStaffInvite(clubTokenInvite, viewer, { tokenMatches: tokenMatch }),
          );
        }
      }

      if (teamTokenInvite) {
        const viewerMatch = canViewerRespond(teamTokenInvite, viewer);
        const tokenMatch = token ? teamTokenInvite.token === token : false;
        if (viewerMatch || tokenMatch) {
          keyed.set(
            `team-member:${teamTokenInvite.id}`,
            serializeTeamMemberInvite(teamTokenInvite, viewer, { tokenMatches: tokenMatch }),
          );
        }
      }
    }

    const items = Array.from(keyed.values())
      .sort((a, b) => (new Date(b.createdAt ?? 0).getTime() || 0) - (new Date(a.createdAt ?? 0).getTime() || 0))
      .slice(0, limit);

    return jsonWrap({ ok: true, items }, { status: 200 });
  } catch (err) {
    console.error("[org-hub/invites][GET]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
