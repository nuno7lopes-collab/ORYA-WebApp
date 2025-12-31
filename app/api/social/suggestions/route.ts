import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const clampLimit = (value: number) => Math.min(Math.max(value, 1), 12);

export async function GET(req: NextRequest) {
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 8);
  const limit = clampLimit(Number.isFinite(limitRaw) ? limitRaw : 8);

  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { city: true },
  });

  const followingRows = await prisma.follows.findMany({
    where: { follower_id: user.id },
    select: { following_id: true },
  });

  const followingIds = followingRows.map((row) => row.following_id).filter(Boolean);

  const baseWhere = {
    isDeleted: false,
    visibility: "PUBLIC" as const,
    username: { not: null },
    NOT: { username: "" },
    id: { not: user.id, notIn: followingIds.length > 0 ? followingIds : undefined },
  };

  const primary = await prisma.profile.findMany({
    where: {
      ...baseWhere,
      ...(profile?.city ? { city: profile.city } : {}),
    },
    select: {
      id: true,
      username: true,
      fullName: true,
      avatarUrl: true,
      city: true,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  const remaining = limit - primary.length;
  const fallback =
    remaining > 0
      ? await prisma.profile.findMany({
          where: {
            ...baseWhere,
            id: { notIn: [user.id, ...primary.map((p) => p.id), ...followingIds] },
          },
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
            city: true,
          },
          orderBy: { updatedAt: "desc" },
          take: remaining,
        })
      : [];

  const combined = [...primary, ...fallback];
  const suggestedIds = combined.map((item) => item.id);

  const mutualsMap = new Map<string, number>();
  if (suggestedIds.length > 0 && followingIds.length > 0) {
    const mutualRows = await prisma.follows.groupBy({
      by: ["follower_id"],
      where: {
        follower_id: { in: suggestedIds },
        following_id: { in: followingIds },
      },
      _count: { _all: true },
    });

    mutualRows.forEach((row) => {
      mutualsMap.set(row.follower_id, row._count._all);
    });
  }

  const items = combined.map((item) => ({
    id: item.id,
    username: item.username,
    fullName: item.fullName,
    avatarUrl: item.avatarUrl,
    city: item.city,
    mutualsCount: mutualsMap.get(item.id) ?? 0,
    isFollowing: false,
  }));

  return NextResponse.json({ ok: true, items }, { status: 200 });
}
