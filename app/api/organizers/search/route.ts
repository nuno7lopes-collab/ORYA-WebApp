import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limitRaw = limitParam ? Number(limitParam) : 8;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 12) : 8;

  if (q.length < 1) {
    return NextResponse.json({ ok: true, results: [] }, { status: 200 });
  }

  const normalized = q.startsWith("@") ? q.slice(1) : q;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const results = await prisma.organizer.findMany({
      where: {
        status: "ACTIVE",
        AND: [
          {
            OR: [
              { publicName: { contains: normalized, mode: "insensitive" } },
              { businessName: { contains: normalized, mode: "insensitive" } },
              { username: { contains: normalized, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        publicName: true,
        businessName: true,
        brandingAvatarUrl: true,
        organizationCategory: true,
        city: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: limit,
    });

    const followingSet = new Set<number>();
    if (user && results.length > 0) {
      const rows = await prisma.organizer_follows.findMany({
        where: { follower_id: user.id, organizer_id: { in: results.map((r) => r.id) } },
        select: { organizer_id: true },
      });
      rows.forEach((row) => followingSet.add(row.organizer_id));
    }

    const mapped = results.map((r) => ({
      id: r.id,
      username: r.username,
      publicName: r.publicName,
      businessName: r.businessName,
      brandingAvatarUrl: r.brandingAvatarUrl,
      organizationCategory: r.organizationCategory,
      city: r.city,
      isFollowing: followingSet.has(r.id),
    }));

    let ordered = mapped;
    if (followingSet.size > 0) {
      const followed: typeof mapped = [];
      const rest: typeof mapped = [];
      mapped.forEach((item) => (item.isFollowing ? followed : rest).push(item));
      ordered = [...followed, ...rest];
    }

    return NextResponse.json(
      {
        ok: true,
        results: ordered,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organizers/search]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
