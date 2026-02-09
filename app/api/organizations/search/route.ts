import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { pickCanonicalField } from "@/lib/location/eventLocation";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getOrganizationFollowingSet } from "@/domain/social/follows";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";

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
    const results = await prisma.organization.findMany({
      where: {
        status: "ACTIVE",
        AND: [
          { username: { not: null } },
          { NOT: { username: "" } },
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
        primaryModule: true,
        addressRef: { select: { canonical: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: limit,
    });

    let followingSet = new Set<number>();
    if (user && results.length > 0) {
      const ids = results.map((r) => r.id);
      followingSet = await getOrganizationFollowingSet(user.id, ids);
    }

    const mapped = results.map((r) => ({
      id: r.id,
      username: r.username,
      publicName: r.publicName,
      businessName: r.businessName,
      brandingAvatarUrl: r.brandingAvatarUrl,
      primaryModule: r.primaryModule,
      city:
        pickCanonicalField(
          r.addressRef?.canonical ?? null,
          "city",
          "locality",
          "addressLine2",
          "region",
          "state",
        ) ?? null,
      isFollowing: followingSet.has(r.id),
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
    logError("organizations.search_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
