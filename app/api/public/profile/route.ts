export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getUserFollowCounts, getUserFollowStatus, isOrganizationFollowed } from "@/domain/social/follows";

const normalizeUsername = (raw: string) => raw.trim().replace(/^@/, "");

async function _GET(req: NextRequest) {
  const usernameRaw = req.nextUrl.searchParams.get("username");
  if (!usernameRaw) {
    return jsonWrap({ ok: false, error: "INVALID_USERNAME" }, { status: 400 });
  }
  const username = normalizeUsername(usernameRaw);
  if (!username) {
    return jsonWrap({ ok: false, error: "INVALID_USERNAME" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  const profile = await prisma.profile.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: {
      id: true,
      username: true,
      fullName: true,
      avatarUrl: true,
      coverUrl: true,
      bio: true,
      city: true,
      visibility: true,
      padelLevel: true,
      padelPreferredSide: true,
      gender: true,
      favouriteCategories: true,
      isDeleted: true,
    },
  });

  if (profile && !profile.isDeleted) {
    if (profile.visibility !== "PUBLIC") {
      if (!viewerId) {
        return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
      }
      if (viewerId !== profile.id) {
        const isFollower = await prisma.follows.findFirst({
          where: { follower_id: viewerId, following_id: profile.id },
          select: { id: true },
        });
        if (!isFollower) {
          return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
        }
      }
    }

    const [followCounts, eventsCount, viewerStatus] = await Promise.all([
      getUserFollowCounts(profile.id),
      prisma.event.count({ where: { ownerUserId: profile.id, isDeleted: false } }),
      viewerId ? getUserFollowStatus(viewerId, profile.id) : Promise.resolve(null),
    ]);

    return jsonWrap(
      {
        ok: true,
        type: "user",
        profile: {
          id: profile.id,
          username: profile.username,
          fullName: profile.fullName,
          avatarUrl: profile.avatarUrl,
          coverUrl: profile.coverUrl,
          bio: profile.bio,
          city: profile.city,
          visibility: profile.visibility,
          padelLevel: profile.padelLevel,
          padelPreferredSide: profile.padelPreferredSide,
          padelGender: profile.gender,
          favouriteCategories: profile.favouriteCategories ?? [],
        },
        counts: {
          followers: followCounts.followersCount,
          following: followCounts.followingTotal,
          events: eventsCount,
        },
        viewer: viewerStatus
          ? {
              isFollowing: viewerStatus.isFollowing,
              isRequested: viewerStatus.requestPending,
              isMutual: viewerStatus.isMutual,
            }
          : null,
        isSelf: viewerId === profile.id,
      },
      { status: 200 },
    );
  }

  const organization = await prisma.organization.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: {
      id: true,
      username: true,
      publicName: true,
      businessName: true,
      brandingAvatarUrl: true,
      brandingCoverUrl: true,
      publicDescription: true,
      city: true,
    },
  });

  if (!organization) {
    return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const [followersCount, eventsCount, viewerFollows] = await Promise.all([
    prisma.organization_follows.count({ where: { organization_id: organization.id } }),
    prisma.event.count({ where: { organizationId: organization.id, isDeleted: false } }),
    viewerId ? isOrganizationFollowed(viewerId, organization.id) : Promise.resolve(false),
  ]);

  return jsonWrap(
    {
      ok: true,
      type: "organization",
      profile: {
        id: organization.id,
        username: organization.username,
        fullName: organization.publicName ?? organization.businessName,
        avatarUrl: organization.brandingAvatarUrl,
        coverUrl: organization.brandingCoverUrl,
        bio: organization.publicDescription,
        city: organization.city,
      },
      counts: {
        followers: followersCount,
        following: 0,
        events: eventsCount,
      },
      viewer: viewerId ? { isFollowing: viewerFollows } : null,
      isSelf: false,
    },
    { status: 200 },
  );
}

export const GET = withApiEnvelope(_GET);
