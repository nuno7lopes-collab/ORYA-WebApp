export const runtime = "nodejs";

import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getUserFollowCounts } from "@/domain/social/follows";
import { applyInactivityToVisual, computeVisualLevel } from "@/domain/padel/ratingEngine";
import { withPadelGlobalRatingFallback } from "@/lib/padel/globalRatingSchema";
import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";

async function _GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

  if (error || !user) {
    return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const [profile, fallbackPadel, followCounts, ratingProfile, leaderProfile] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: user.id },
      select: {
        fullName: true,
        username: true,
        avatarUrl: true,
        coverUrl: true,
        bio: true,
        visibility: true,
        gender: true,
        padelPreferredSide: true,
        padelLevel: true,
      },
    }),
    prisma.padelPlayerProfile.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { updatedAt: "desc" },
      select: {
        level: true,
      },
    }),
    getUserFollowCounts(user.id),
    withPadelGlobalRatingFallback(
      () =>
        prisma.padelGlobalRatingProfile.findUnique({
          where: { userId: user.id },
          select: {
            rating: true,
            matchesPlayed: true,
            leaderboardEligible: true,
            blockedNewMatches: true,
            lastActivityAt: true,
            lastMatchAt: true,
            lastRebuildAt: true,
          },
        }),
      null,
      "app/api/me/padel/profile-card#self",
    ),
    withPadelGlobalRatingFallback(
      () =>
        prisma.padelGlobalRatingProfile.findFirst({
          where: {
            leaderboardEligible: true,
            matchesPlayed: { gt: 0 },
          },
          select: {
            rating: true,
          },
          orderBy: [{ rating: "desc" }, { userId: "asc" }],
        }),
      null,
      "app/api/me/padel/profile-card#leader",
    ),
  ]);

  const declaredLevel = profile?.padelLevel ?? fallbackPadel?.level ?? null;
  const hasOfficialRanking = Boolean(
    ratingProfile &&
      ratingProfile.matchesPlayed > 0 &&
      ratingProfile.leaderboardEligible &&
      !ratingProfile.blockedNewMatches &&
      Number.isFinite(Number(ratingProfile.rating)),
  );

  let visualValue: string | null = null;
  let source: "OFFICIAL" | "DECLARED_LEVEL" = "DECLARED_LEVEL";
  if (hasOfficialRanking && ratingProfile) {
    const leaderRating = leaderProfile?.rating ?? ratingProfile.rating;
    const computed = computeVisualLevel(Number(ratingProfile.rating), Number(leaderRating));
    const drifted = applyInactivityToVisual(computed, ratingProfile.lastActivityAt ?? null);
    visualValue = drifted.toFixed(2);
    source = "OFFICIAL";
  } else if (declaredLevel) {
    visualValue = declaredLevel;
  }

  return jsonWrap(
    {
      ok: true,
      profile: {
        fullName: profile?.fullName ?? null,
        username: profile?.username ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        coverUrl: profile?.coverUrl ?? null,
        bio: profile?.bio ?? null,
        visibility: profile?.visibility ?? "PUBLIC",
        gender: profile?.gender ?? null,
        padelPreferredSide: profile?.padelPreferredSide ?? null,
        padelLevel: declaredLevel,
      },
      social: {
        friendsCount: followCounts.followersCount ?? 0,
      },
      ranking: {
        hasOfficialRanking,
        visualValue,
        source,
        declaredLevel,
        updatedAt:
          ratingProfile?.lastRebuildAt?.toISOString() ??
          ratingProfile?.lastActivityAt?.toISOString() ??
          ratingProfile?.lastMatchAt?.toISOString() ??
          null,
      },
    },
    { status: 200 },
  );
}

export const GET = withApiEnvelope(_GET);
