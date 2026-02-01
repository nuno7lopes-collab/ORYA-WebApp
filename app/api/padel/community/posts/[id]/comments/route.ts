export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { OrganizationMemberRole } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const readRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const writeRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];

type ResolvePostResult =
  | { organization: { id: number }; userId: string; post: { id: number; organizationId: number } }
  | { error: Response };

async function resolvePost(
  req: NextRequest,
  postId: number,
  roles: OrganizationMemberRole[],
): Promise<ResolvePostResult> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 }) ?? new Response(null, { status: 401 }),
    };
  }

  const post = await prisma.padelCommunityPost.findUnique({
    where: { id: postId },
    select: { id: true, organizationId: true },
  });
  if (!post) {
    return { error: jsonWrap({ ok: false, error: "POST_NOT_FOUND" }, { status: 404 }) ?? new Response(null, { status: 404 }) };
  }

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: post.organizationId,
    roles,
  });
  if (!organization) {
    return { error: jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 }) ?? new Response(null, { status: 403 }) };
  }

  return { organization, userId: user.id, post };
}

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const resolved = await params;
  const postId = Number(resolved?.id);
  if (!Number.isFinite(postId)) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const ctx = await resolvePost(req, postId, readRoles);
  if ("error" in ctx) return ctx.error;

  const comments = await prisma.padelCommunityComment.findMany({
    where: { postId },
    include: { author: { select: { id: true, fullName: true, username: true, avatarUrl: true } } },
    orderBy: [{ createdAt: "asc" }],
  });

  return jsonWrap({ ok: true, items: comments }, { status: 200 });
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const resolved = await params;
  const postId = Number(resolved?.id);
  if (!Number.isFinite(postId)) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const ctx = await resolvePost(req, postId, writeRoles);
  if ("error" in ctx) return ctx.error;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return jsonWrap({ ok: false, error: "BODY_REQUIRED" }, { status: 400 });

  const comment = await prisma.padelCommunityComment.create({
    data: {
      postId,
      authorUserId: ctx.userId,
      body: text,
    },
    include: { author: { select: { id: true, fullName: true, username: true, avatarUrl: true } } },
  });

  return jsonWrap({ ok: true, item: comment }, { status: 201 });
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
