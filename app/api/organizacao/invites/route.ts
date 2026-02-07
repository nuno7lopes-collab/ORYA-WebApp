import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { Prisma } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { sanitizeProfileVisibility } from "@/lib/profileVisibility";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

type InviteStatus = "PENDING" | "EXPIRED" | "ACCEPTED" | "DECLINED" | "CANCELLED";

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

const canViewerRespond = (invite: { targetIdentifier: string; targetUserId: string | null }, viewer: { id: string; username?: string | null; email?: string | null }) => {
  const normalizedTarget = invite.targetIdentifier.toLowerCase();
  return (
    invite.targetUserId === viewer.id ||
    (viewer.username && viewer.username.toLowerCase() === normalizedTarget) ||
    (viewer.email && viewer.email.toLowerCase() === normalizedTarget)
  );
};

const serializeInvite = (
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
      addressRef?: { formattedAddress: string | null; canonical: Record<string, unknown> | null } | null;
    } | null;
  },
  viewer: { id: string; username?: string | null; email?: string | null },
  options?: { tokenMatches?: boolean },
) => {
  const status = buildInviteStatus(invite);
  const canRespond = options?.tokenMatches ? true : canViewerRespond(invite, viewer);

  return {
    id: invite.id,
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
    const inviteId = url.searchParams.get("invite") ?? url.searchParams.get("inviteId");
    const token = url.searchParams.get("token");

    const viewerEmail = user.email?.toLowerCase() ?? null;
    const viewerUsername = profile?.username ?? null;

    const baseFilter: Prisma.OrganizationMemberInviteWhereInput = {
      OR: [
        { targetUserId: user.id },
        ...(viewerEmail
          ? [{ targetIdentifier: { equals: viewerEmail, mode: Prisma.QueryMode.insensitive } }]
          : []),
        ...(viewerUsername
          ? [{ targetIdentifier: { equals: viewerUsername, mode: Prisma.QueryMode.insensitive } }]
          : []),
      ],
    };

    const include = {
      invitedBy: { select: { id: true, username: true, fullName: true, avatarUrl: true, visibility: true, isDeleted: true } },
      targetUser: { select: { id: true, username: true, fullName: true, avatarUrl: true, visibility: true, isDeleted: true } },
      organization: {
        select: {
          id: true,
          publicName: true,
          username: true,
          businessName: true,
          entityType: true,
          brandingAvatarUrl: true,
          brandingCoverUrl: true,
          addressRef: { select: { formattedAddress: true, canonical: true } },
        },
      },
    } satisfies Prisma.OrganizationMemberInviteInclude;

    const invites = await prisma.organizationMemberInvite.findMany({
      where: baseFilter,
      include,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const invitesById = new Map(invites.map((invite) => [invite.id, invite]));

    if (inviteId || token) {
      const tokenInvite = await prisma.organizationMemberInvite.findFirst({
        where: {
          ...(inviteId ? { id: inviteId } : {}),
          ...(token ? { token } : {}),
        },
        include,
      });

      if (tokenInvite && !invitesById.has(tokenInvite.id)) {
        const viewerMatch = canViewerRespond(tokenInvite, {
          id: user.id,
          username: viewerUsername,
          email: viewerEmail,
        });
        const tokenMatch = token ? tokenInvite.token === token : false;
        if (viewerMatch || tokenMatch) {
          invitesById.set(tokenInvite.id, tokenInvite);
        }
      }
    }

    const viewer = { id: user.id, username: viewerUsername, email: viewerEmail };
    const items = Array.from(invitesById.values())
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .map((invite) => {
        const tokenMatches = token ? invite.token === token : false;
        return serializeInvite(invite, viewer, { tokenMatches });
      });

    return jsonWrap({ ok: true, items }, { status: 200 });
  } catch (err) {
    console.error("[organizacao/invites][GET]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
