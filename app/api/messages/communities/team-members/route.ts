export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isUnauthenticatedError } from "@/lib/security";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { canManageCommunity } from "@/lib/messages/communityAccess";
import { listEffectiveOrganizationMembers } from "@/lib/organizationMembers";

type TeamMemberItem = {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  role: string;
  rolePack: string | null;
};

function sortKey(item: TeamMemberItem) {
  return (item.fullName || item.username || item.userId).toLowerCase();
}

async function _GET(req: NextRequest) {
  try {
    const { user, organization, membership } = await requireChatContext(req);

    const canManage = await canManageCommunity({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
    });
    if (!canManage) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const effectiveMembers = await listEffectiveOrganizationMembers({
      organizationId: organization.id,
    });
    if (!effectiveMembers.length) {
      return jsonWrap({ ok: true, items: [] });
    }

    const userIds = Array.from(new Set(effectiveMembers.map((member) => member.userId)));
    const profiles = await prisma.profile.findMany({
      where: {
        id: { in: userIds },
        isDeleted: false,
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        avatarUrl: true,
      },
    });
    const profileByUserId = new Map(profiles.map((profile) => [profile.id, profile]));

    const items: TeamMemberItem[] = effectiveMembers
      .map((member) => {
        const profile = profileByUserId.get(member.userId);
        return {
          userId: member.userId,
          fullName: profile?.fullName ?? null,
          username: profile?.username ?? null,
          avatarUrl: profile?.avatarUrl ?? null,
          role: member.role,
          rolePack: member.rolePack ?? null,
        };
      })
      .sort((left, right) => sortKey(left).localeCompare(sortKey(right), "pt-PT"));

    return jsonWrap({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("GET /api/messages/communities/team-members error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
