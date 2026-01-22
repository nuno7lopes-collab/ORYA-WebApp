export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { listUserFollowers } from "@/domain/social/follows";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  const limitRaw = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 50) : 30;

  if (!userId) {
    return NextResponse.json({ ok: false, error: "INVALID_TARGET" }, { status: 400 });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { visibility: true, isDeleted: true },
  });
  if (!profile || profile.isDeleted) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  if (profile.visibility !== "PUBLIC") {
    if (!viewerId) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (viewerId !== userId) {
      const isFollower = await prisma.follows.findFirst({
        where: { follower_id: viewerId, following_id: userId },
        select: { id: true },
      });
      if (!isFollower) {
        return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
    }
  }

  const items = await listUserFollowers({ userId, limit, viewerId });
  return NextResponse.json({ ok: true, items }, { status: 200 });
}
