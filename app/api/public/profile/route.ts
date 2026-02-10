export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getUserFollowCounts, getUserFollowStatus, isOrganizationFollowed } from "@/domain/social/follows";
import { pickCanonicalField } from "@/lib/location/eventLocation";
import { normalizeUsernameInput } from "@/lib/username";
import { resolveUsernameOwner } from "@/lib/username/resolveUsernameOwner";

const normalizeVisibility = (value: unknown) =>
  value === "PUBLIC" || value === "PRIVATE" || value === "FOLLOWERS" ? value : "PUBLIC";

type SupabaseProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  padel_level: string | null;
  favourite_categories: string[] | null;
  visibility: "PUBLIC" | "PRIVATE" | "FOLLOWERS" | null;
};

const SUPABASE_PROFILE_SELECT =
  "id, username, full_name, avatar_url, cover_url, bio, padel_level, favourite_categories, visibility";

async function fetchSupabaseProfileById(
  supabase: ReturnType<typeof createSupabaseServer> extends Promise<infer T> ? T : never,
  userId: string,
): Promise<SupabaseProfileRow | null> {
  const result = await supabase
    .from("profiles")
    .select(SUPABASE_PROFILE_SELECT)
    .eq("id", userId)
    .single();
  if (result.error || !result.data) return null;
  return result.data as SupabaseProfileRow;
}

type UserProfileCore = {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  visibility: "PUBLIC" | "PRIVATE" | "FOLLOWERS";
  padelLevel: string | null;
  padelPreferredSide: string | null;
  gender: string | null;
  favouriteCategories: string[];
  isDeleted?: boolean;
};

async function buildUserResponse(profile: UserProfileCore, viewerId: string | null) {
  if (profile.isDeleted) {
    return null;
  }
  const [followCounts, eventsCount, viewerStatus] = await Promise.all([
    getUserFollowCounts(profile.id),
    prisma.event.count({ where: { ownerUserId: profile.id, isDeleted: false } }),
    viewerId ? getUserFollowStatus(viewerId, profile.id) : Promise.resolve(null),
  ]);

  const isPrivate = profile.visibility !== "PUBLIC";
  const isSelf = viewerId === profile.id;
  const canView = !isPrivate || isSelf || Boolean(viewerStatus?.isFollowing);
  const restricted = isPrivate && !canView;
  const safeProfile = restricted
    ? {
        id: profile.id,
        username: profile.username,
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl,
        coverUrl: profile.coverUrl,
        bio: profile.bio,
        visibility: profile.visibility,
        padelLevel: null,
        padelPreferredSide: null,
        padelGender: null,
        favouriteCategories: [],
      }
    : {
        id: profile.id,
        username: profile.username,
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl,
        coverUrl: profile.coverUrl,
        bio: profile.bio,
        visibility: profile.visibility,
        padelLevel: profile.padelLevel,
        padelPreferredSide: profile.padelPreferredSide,
        padelGender: profile.gender,
        favouriteCategories: profile.favouriteCategories ?? [],
      };

  return jsonWrap(
    {
      ok: true,
      type: "user",
      profile: safeProfile,
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
      isSelf,
      privacy: {
        isPrivate,
        canView,
      },
    },
    { status: 200 },
  );
}

async function _GET(req: NextRequest) {
  const usernameRaw = req.nextUrl.searchParams.get("username");
  if (!usernameRaw) {
    return jsonWrap({ ok: false, error: "INVALID_USERNAME" }, { status: 400 });
  }
  const username = normalizeUsernameInput(usernameRaw);
  if (!username) {
    return jsonWrap({ ok: false, error: "INVALID_USERNAME" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  const resolved = await resolveUsernameOwner(username, {
    includeDeletedUser: false,
    requireActiveOrganization: true,
    backfillGlobalUsername: true,
  });

  if (resolved?.ownerType === "user") {
    const profile = await prisma.profile.findUnique({
      where: { id: resolved.ownerId },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        coverUrl: true,
        bio: true,
        visibility: true,
        padelLevel: true,
        padelPreferredSide: true,
        gender: true,
        favouriteCategories: true,
        isDeleted: true,
      },
    });
    if (!profile || profile.isDeleted) {
      return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    const response = await buildUserResponse(
      {
        id: profile.id,
        username: profile.username,
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl,
        coverUrl: profile.coverUrl,
        bio: profile.bio,
        visibility: profile.visibility ?? "PUBLIC",
        padelLevel: profile.padelLevel ?? null,
        padelPreferredSide: profile.padelPreferredSide ?? null,
        gender: profile.gender ?? null,
        favouriteCategories: profile.favouriteCategories ?? [],
        isDeleted: profile.isDeleted ?? false,
      },
      viewerId,
    );
    if (response) return response;
  }

  let supabaseSelfProfile: SupabaseProfileRow | null = null;
  if (!resolved && viewerId) {
    const deletedProfile = await prisma.profile.findFirst({
      where: { username: { equals: username, mode: "insensitive" }, isDeleted: true },
      select: { id: true },
    });
    if (deletedProfile) {
      return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    supabaseSelfProfile = await fetchSupabaseProfileById(supabase, viewerId);
    const matchesUsername =
      supabaseSelfProfile?.username &&
      supabaseSelfProfile.username.toLowerCase() === username.toLowerCase();
    if (supabaseSelfProfile && matchesUsername) {
      const response = await buildUserResponse(
        {
          id: supabaseSelfProfile.id,
          username: supabaseSelfProfile.username ?? null,
          fullName: supabaseSelfProfile.full_name ?? null,
          avatarUrl: supabaseSelfProfile.avatar_url ?? null,
          coverUrl: supabaseSelfProfile.cover_url ?? null,
          bio: supabaseSelfProfile.bio ?? null,
          visibility: normalizeVisibility(supabaseSelfProfile.visibility),
          padelLevel: supabaseSelfProfile.padel_level ?? null,
          padelPreferredSide: null,
          gender: null,
          favouriteCategories: supabaseSelfProfile.favourite_categories ?? [],
        },
        viewerId,
      );
      if (response) return response;
    }
  }

  if (resolved?.ownerType !== "organization") {
    return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const organization = await prisma.organization.findUnique({
    where: { id: resolved.ownerId },
    select: {
      id: true,
      username: true,
      publicName: true,
      businessName: true,
      brandingAvatarUrl: true,
      brandingCoverUrl: true,
      publicDescription: true,
      addressRef: { select: { canonical: true } },
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
        city:
          pickCanonicalField(
            organization.addressRef?.canonical ?? null,
            "city",
            "locality",
            "addressLine2",
            "region",
            "state",
          ) ?? null,
      },
      counts: {
        followers: followersCount,
        following: 0,
        events: eventsCount,
      },
      viewer: viewerId ? { isFollowing: viewerFollows } : null,
      isSelf: false,
      privacy: {
        isPrivate: false,
        canView: true,
      },
    },
    { status: 200 },
  );
}

export const GET = withApiEnvelope(_GET);
