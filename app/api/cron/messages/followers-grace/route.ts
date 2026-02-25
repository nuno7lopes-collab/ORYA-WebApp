export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ACTIVE_MEMBER_FILTER = {
  leftAt: null,
  accessRevokedAt: null,
  bannedAt: null,
  organizationId: null,
} as const;

type Candidate = {
  conversationId: string;
  userId: string;
  organizationId: number;
};

function groupCandidatesByOrganization(candidates: Candidate[]) {
  const grouped = new Map<number, Set<string>>();
  for (const candidate of candidates) {
    const existing = grouped.get(candidate.organizationId) ?? new Set<string>();
    existing.add(candidate.userId);
    grouped.set(candidate.organizationId, existing);
  }
  return grouped;
}

async function _POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const now = new Date();

    const rows = await prisma.chatConversationMember.findMany({
      where: {
        ...ACTIVE_MEMBER_FILTER,
        followGraceEndsAt: { lte: now },
        conversation: {
          contextType: "ORG_COMMUNITY",
          organizationId: { not: null },
          community: {
            is: {
              accessMode: "FOLLOWERS",
            },
          },
        },
      },
      select: {
        conversationId: true,
        userId: true,
        conversation: {
          select: {
            organizationId: true,
          },
        },
      },
    });

    const candidates: Candidate[] = rows
      .map((row) => {
        const organizationId = row.conversation.organizationId;
        if (!organizationId) return null;
        return {
          conversationId: row.conversationId,
          userId: row.userId,
          organizationId,
        } satisfies Candidate;
      })
      .filter((row): row is Candidate => Boolean(row));

    if (!candidates.length) {
      await recordCronHeartbeat("messages-followers-grace", {
        status: "SUCCESS",
        startedAt,
        metadata: { scanned: 0, removed: 0, keptFollowing: 0 },
      });
      return jsonWrap({ ok: true, scanned: 0, removed: 0, keptFollowing: 0 });
    }

    const groupedByOrg = groupCandidatesByOrganization(candidates);
    const stillFollowingPairs = new Set<string>();

    for (const [organizationId, userIds] of groupedByOrg.entries()) {
      const followerRows = await prisma.organization_follows.findMany({
        where: {
          organization_id: organizationId,
          follower_id: { in: Array.from(userIds) },
        },
        select: { follower_id: true },
      });

      for (const row of followerRows) {
        stillFollowingPairs.add(`${organizationId}:${row.follower_id}`);
      }
    }

    const toRemove = candidates.filter(
      (candidate) => !stillFollowingPairs.has(`${candidate.organizationId}:${candidate.userId}`),
    );

    let removed = 0;
    if (toRemove.length) {
      await prisma.$transaction(async (tx) => {
        for (const candidate of toRemove) {
          const result = await tx.chatConversationMember.updateMany({
            where: {
              conversationId: candidate.conversationId,
              userId: candidate.userId,
              ...ACTIVE_MEMBER_FILTER,
              followGraceEndsAt: { lte: now },
            },
            data: {
              leftAt: now,
              accessRevokedAt: now,
            },
          });
          removed += result.count;
        }
      });
    }

    const keptFollowing = candidates.length - toRemove.length;

    await recordCronHeartbeat("messages-followers-grace", {
      status: "SUCCESS",
      startedAt,
      metadata: {
        scanned: candidates.length,
        removed,
        keptFollowing,
      },
    });

    return jsonWrap({
      ok: true,
      scanned: candidates.length,
      removed,
      keptFollowing,
    });
  } catch (err) {
    await recordCronHeartbeat("messages-followers-grace", {
      status: "ERROR",
      startedAt,
      error: err,
    });
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
