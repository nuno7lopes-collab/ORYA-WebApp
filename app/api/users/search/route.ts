import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getUserFollowingSet, getUserFollowRequestSet } from "@/domain/social/follows";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

export const runtime = "nodejs";

async function _GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limitRaw = limitParam ? Number(limitParam) : 8;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 12) : 8;
  if (q.length < 1) {
    return jsonWrap({ ok: true, results: [] }, { status: 200 });
  }

  const normalized = q.startsWith("@") ? q.slice(1) : q;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const results = await prisma.profile.findMany({
      where: {
        AND: [
          { isDeleted: false },
          ...(user ? [{ id: { not: user.id } }] : []),
          { username: { not: null } },
          { NOT: { username: "" } },
          {
            OR: [
              { username: { contains: normalized, mode: "insensitive" } },
              { fullName: { contains: normalized, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: limit,
    });

    let followingSet = new Set<string>();
    let requestSet = new Set<string>();

    if (user && results.length > 0) {
      const ids = results.map((r) => r.id);
      [followingSet, requestSet] = await Promise.all([
        getUserFollowingSet(user.id, ids),
        getUserFollowRequestSet(user.id, ids),
      ]);
    }

    const mapped = results.map((r) => ({
      id: r.id,
      username: r.username,
      fullName: r.fullName,
      avatarUrl: r.avatarUrl,
      isFollowing: followingSet.has(r.id),
      isRequested: requestSet.has(r.id),
    }));

    let ordered = mapped;
    if (followingSet.size > 0) {
      const followed: typeof mapped = [];
      const rest: typeof mapped = [];
      mapped.forEach((item) => (item.isFollowing ? followed : rest).push(item));
      ordered = [...followed, ...rest];
    }

    return jsonWrap(
      {
        ok: true,
        results: ordered,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[users/search]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);