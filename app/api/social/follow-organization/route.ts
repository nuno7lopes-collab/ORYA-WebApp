export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { parseOrganizationId } from "@/lib/organizationId";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import { CrmInteractionSource, CrmInteractionType } from "@prisma/client";

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    organizationId?: number | string;
  } | null;
  const rawId = body?.organizationId;
  const organizationId = parseOrganizationId(rawId);
  if (!organizationId) {
    return jsonWrap({ ok: false, error: "INVALID_TARGET" }, { status: 400 });
  }

  const organization = await prisma.organization.findFirst({
    where: {
      id: organizationId,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (!organization) {
    return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const existing = await prisma.organization_follows.findFirst({
    where: { follower_id: user.id, organization_id: organizationId },
    select: { id: true },
  });

  if (!existing) {
    await prisma.organization_follows.create({
      data: {
        follower_id: user.id,
        organization_id: organizationId,
      },
    });

    try {
      await ingestCrmInteraction({
        organizationId,
        userId: user.id,
        type: CrmInteractionType.ORG_FOLLOWED,
        sourceType: CrmInteractionSource.ORGANIZATION,
        sourceId: String(organizationId),
        metadata: { organizationId },
      });
    } catch (err) {
      console.warn("[social/follow-organization] CRM ingest failed", err);
    }
  }

  return jsonWrap({ ok: true }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
