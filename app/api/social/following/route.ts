export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isUserFriend, listUserFollowing } from "@/domain/social/follows";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
async function _GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  const limitRaw = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 50) : 30;
  const includeOrganizations = ["1", "true"].includes(req.nextUrl.searchParams.get("includeOrganizations") ?? "");

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
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  const viewerId = user?.id ?? null;

  if (profile.visibility !== "PUBLIC") {
    if (!viewerId) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (viewerId !== userId) {
      const canView = await isUserFriend(viewerId, userId);
      if (!canView) {
        return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
    }
  }

  const items = await listUserFollowing({
    userId,
    limit,
    viewerId,
    includeOrganizations,
  });

  return jsonWrap({ ok: true, items }, { status: 200 });
}
export const GET = withApiEnvelope(_GET);
