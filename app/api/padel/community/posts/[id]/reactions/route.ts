export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { OrganizationMemberRole } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const roles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const postId = Number(resolved?.id);
  if (!Number.isFinite(postId)) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const post = await prisma.padelCommunityPost.findUnique({
    where: { id: postId },
    select: { id: true, organizationId: true },
  });
  if (!post) return jsonWrap({ ok: false, error: "POST_NOT_FOUND" }, { status: 404 });

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: post.organizationId,
    roles,
  });
  if (!organization) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const reaction = typeof body?.reaction === "string" && body.reaction.trim() ? body.reaction.trim() : "like";

  const existing = await prisma.padelCommunityReaction.findFirst({
    where: { postId, userId: user.id, reaction },
    select: { id: true },
  });

  if (existing) {
    await prisma.padelCommunityReaction.delete({ where: { id: existing.id } });
    return jsonWrap({ ok: true, status: "removed" }, { status: 200 });
  }

  await prisma.padelCommunityReaction.create({
    data: {
      postId,
      userId: user.id,
      reaction,
    },
  });

  return jsonWrap({ ok: true, status: "added" }, { status: 201 });
}

export const POST = withApiEnvelope(_POST);
