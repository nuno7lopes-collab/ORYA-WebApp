import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getUserFollowingSet } from "@/domain/social/follows";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

export const runtime = "nodejs";

const clampLimit = (value: number) => Math.min(Math.max(value, 1), 12);

async function _GET(req: NextRequest) {
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 8);
  const limit = clampLimit(Number.isFinite(limitRaw) ? limitRaw : 8);

  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const followingSet = await getUserFollowingSet(user.id);
  const followingIds = Array.from(followingSet).filter(Boolean);

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
    },
    select: {
      id: true,
      username: true,
      fullName: true,
      avatarUrl: true,
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
    mutualsCount: mutualsMap.get(item.id) ?? 0,
    isFollowing: false,
  }));

  return jsonWrap({ ok: true, items }, { status: 200 });
}
export const GET = withApiEnvelope(_GET);
