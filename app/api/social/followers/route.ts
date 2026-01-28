export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { listUserFollowers } from "@/domain/social/follows";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  const limitRaw = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 50) : 30;

  if (!userId) {
    return jsonWrap({ ok: false, error: "INVALID_TARGET" }, { status: 400 });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { visibility: true, isDeleted: true },
  });
  if (!profile || profile.isDeleted) {
    return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  if (profile.visibility !== "PUBLIC") {
    if (!viewerId) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (viewerId !== userId) {
      const isFollower = await prisma.follows.findFirst({
        where: { follower_id: viewerId, following_id: userId },
        select: { id: true },
      });
      if (!isFollower) {
        return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
    }
  }

  const items = await listUserFollowers({ userId, limit, viewerId });
  return jsonWrap({ ok: true, items }, { status: 200 });
}
export const GET = withApiEnvelope(_GET);