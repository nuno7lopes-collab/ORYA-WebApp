export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { parseOrganizationId } from "@/lib/organizationId";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import { CrmInteractionSource, CrmInteractionType } from "@prisma/client";
import { FOLLOWER_GRACE_MS } from "@/lib/messages/communityAccess";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    organizationId?: number | string;
  } | null;
  const rawId = body?.organizationId;
  const organizationId = parseOrganizationId(rawId);
  if (!organizationId) {
    return jsonWrap({ ok: false, error: "INVALID_TARGET" }, { status: 400 });
  }

  const existing = await prisma.organization_follows.findFirst({
    where: { follower_id: user.id, organization_id: organizationId },
    select: { id: true },
  });

  if (existing) {
    await prisma.organization_follows.deleteMany({
      where: { follower_id: user.id, organization_id: organizationId },
    });

    try {
      await ingestCrmInteraction({
        organizationId,
        userId: user.id,
        type: CrmInteractionType.ORG_UNFOLLOWED,
        sourceType: CrmInteractionSource.ORGANIZATION,
        sourceId: String(organizationId),
        metadata: { organizationId },
      });
    } catch (err) {
      console.warn("[social/unfollow-organization] CRM ingest failed", err);
    }
  }

  await prisma.chatConversationMember.updateMany({
    where: {
      userId: user.id,
      organizationId: null,
      leftAt: null,
      accessRevokedAt: null,
      bannedAt: null,
      conversation: {
        contextType: "ORG_COMMUNITY",
        organizationId,
        community: {
          is: {
            accessMode: "FOLLOWERS",
          },
        },
      },
    },
    data: {
      followGraceEndsAt: new Date(Date.now() + FOLLOWER_GRACE_MS),
    },
  });

  return jsonWrap({ ok: true }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
