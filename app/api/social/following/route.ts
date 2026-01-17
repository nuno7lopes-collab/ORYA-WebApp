export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

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

  const rows = await prisma.follows.findMany({
    where: { follower_id: userId },
    select: {
      following_id: true,
      profiles_follows_following_idToprofiles: {
        select: { username: true, fullName: true, avatarUrl: true },
      },
    },
    take: limit,
    orderBy: { id: "desc" },
  });

  const items = rows
    .map((r) => ({
      userId: r.following_id,
      username: r.profiles_follows_following_idToprofiles?.username ?? null,
      fullName: r.profiles_follows_following_idToprofiles?.fullName ?? null,
      avatarUrl: r.profiles_follows_following_idToprofiles?.avatarUrl ?? null,
    }))
    .filter((r) => r.userId);

  let mutualSet = new Set<string>();
  if (viewerId && items.length > 0) {
    const ids = items.map((item) => item.userId);
    const [viewerFollowing, viewerFollowers] = await Promise.all([
      prisma.follows.findMany({
        where: { follower_id: viewerId, following_id: { in: ids } },
        select: { following_id: true },
      }),
      prisma.follows.findMany({
        where: { follower_id: { in: ids }, following_id: viewerId },
        select: { follower_id: true },
      }),
    ]);
    const followingSet = new Set(viewerFollowing.map((row) => row.following_id));
    const followerSet = new Set(viewerFollowers.map((row) => row.follower_id));
    mutualSet = new Set(ids.filter((id) => followingSet.has(id) && followerSet.has(id)));
  }

  const payload = items.map((item) => ({
    ...item,
    isMutual: mutualSet.has(item.userId),
  }));

  return NextResponse.json({ ok: true, items: payload }, { status: 200 });
}
