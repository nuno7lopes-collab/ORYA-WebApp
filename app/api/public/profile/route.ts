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
import { isStoreFeatureEnabled, resolveStoreState } from "@/lib/storeAccess";
import { getPublicStorePaymentsGate } from "@/lib/store/publicPaymentsGate";
import { canOpenPublicStorefront } from "@/lib/publicOrganizationProfile";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";

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
  } = await getUserWithPolicy("optional_verified", { supabaseOverride: supabase });
  const viewerId = user?.id ?? null;

  const resolved = await resolveUsernameOwner(username, {
    includeDeletedUser: false,
    requireActiveOrganization: true,
    backfillGlobalUsername: false,
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

  if (!resolved && viewerId) {
    const deletedProfile = await prisma.profile.findFirst({
      where: { username: { equals: username, mode: "insensitive" }, isDeleted: true },
      select: { id: true },
    });
    if (deletedProfile) {
      return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    const prismaSelfProfile = await prisma.profile.findUnique({
      where: { id: viewerId },
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
    const prismaUsernameMatches =
      prismaSelfProfile?.username &&
      prismaSelfProfile.username.toLowerCase() === username.toLowerCase();
    if (prismaSelfProfile && !prismaSelfProfile.isDeleted && prismaUsernameMatches) {
      const response = await buildUserResponse(
        {
          id: prismaSelfProfile.id,
          username: prismaSelfProfile.username,
          fullName: prismaSelfProfile.fullName,
          avatarUrl: prismaSelfProfile.avatarUrl,
          coverUrl: prismaSelfProfile.coverUrl,
          bio: prismaSelfProfile.bio,
          visibility: prismaSelfProfile.visibility ?? "PUBLIC",
          padelLevel: prismaSelfProfile.padelLevel ?? null,
          padelPreferredSide: prismaSelfProfile.padelPreferredSide ?? null,
          gender: prismaSelfProfile.gender ?? null,
          favouriteCategories: prismaSelfProfile.favouriteCategories ?? [],
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
      orgType: true,
      officialEmail: true,
      officialEmailVerifiedAt: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      addressRef: { select: { canonical: true } },
    },
  });

  if (!organization) {
    return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const [followersCount, eventsCount, viewerFollows, store] = await Promise.all([
    prisma.organization_follows.count({ where: { organization_id: organization.id } }),
    prisma.event.count({ where: { organizationId: organization.id, isDeleted: false } }),
    viewerId ? isOrganizationFollowed(viewerId, organization.id) : Promise.resolve(false),
    prisma.store.findFirst({
      where: { ownerOrganizationId: organization.id },
      select: {
        id: true,
        status: true,
        showOnProfile: true,
        catalogLocked: true,
        checkoutEnabled: true,
      },
    }),
  ]);

  const publicProductsCount = store
    ? await prisma.storeProduct.count({
        where: { storeId: store.id, visibility: "PUBLIC" },
      })
    : 0;
  const storeEnabled = isStoreFeatureEnabled();
  const paymentsReady = store
    ? getPublicStorePaymentsGate({
        orgType: organization.orgType,
        officialEmail: organization.officialEmail,
        officialEmailVerifiedAt: organization.officialEmailVerifiedAt,
        stripeAccountId: organization.stripeAccountId,
        stripeChargesEnabled: organization.stripeChargesEnabled,
        stripePayoutsEnabled: organization.stripePayoutsEnabled,
      }).ok
    : false;
  const storeResolvedState = resolveStoreState(store);
  const canOpenPublicStore = storeEnabled
    ? canOpenPublicStorefront({
        status: store?.status ?? null,
        showOnProfile: store?.showOnProfile ?? false,
        checkoutEnabled: store?.checkoutEnabled ?? false,
        catalogLocked: store?.catalogLocked ?? false,
        publicProductCount: publicProductsCount,
        paymentsReady,
      })
    : false;

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
      store: {
        exists: Boolean(store),
        enabled: storeEnabled,
        canOpenPublicStore,
        resolvedState: storeResolvedState,
        publicProductsCount,
        showOnProfile: Boolean(store?.showOnProfile),
      },
    },
    { status: 200 },
  );
}

export const GET = withApiEnvelope(_GET);
