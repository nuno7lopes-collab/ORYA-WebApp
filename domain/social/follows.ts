import { prisma } from "@/lib/prisma";

export type FollowKind = "user" | "organization";

export type FollowListItem = {
  userId: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  kind?: FollowKind;
  isMutual?: boolean;
};

export async function getUserFollowCounts(userId: string) {
  const [followersCount, followingUsersCount, followingOrganizationsCount] = await Promise.all([
    prisma.follows.count({ where: { following_id: userId } }),
    prisma.follows.count({ where: { follower_id: userId } }),
    prisma.organization_follows.count({ where: { follower_id: userId } }),
  ]);

  return {
    followersCount,
    followingUsersCount,
    followingOrganizationsCount,
    followingTotal: followingUsersCount + followingOrganizationsCount,
  };
}

export async function isUserFollowing(viewerId: string, targetUserId: string) {
  const row = await prisma.follows.findFirst({
    where: { follower_id: viewerId, following_id: targetUserId },
    select: { id: true },
  });
  return Boolean(row);
}

export async function getUserFollowStatus(viewerId: string, targetUserId: string) {
  const [isFollowing, isFollower, pendingRequest, targetProfile] = await Promise.all([
    prisma.follows.findFirst({ where: { follower_id: viewerId, following_id: targetUserId }, select: { id: true } }),
    prisma.follows.findFirst({ where: { follower_id: targetUserId, following_id: viewerId }, select: { id: true } }),
    prisma.follow_requests.findFirst({
      where: { requester_id: viewerId, target_id: targetUserId },
      select: { id: true },
    }),
    prisma.profile.findUnique({
      where: { id: targetUserId },
      select: { visibility: true, isDeleted: true },
    }),
  ]);

  return {
    isFollowing: Boolean(isFollowing),
    isFollower: Boolean(isFollower),
    isMutual: Boolean(isFollowing && isFollower),
    requestPending: Boolean(pendingRequest),
    targetVisibility: targetProfile?.visibility ?? "PUBLIC",
    targetDeleted: Boolean(targetProfile?.isDeleted),
  };
}

export async function listUserFollowers(params: { userId: string; limit: number; viewerId?: string | null }) {
  const rows = await prisma.follows.findMany({
    where: { following_id: params.userId },
    select: {
      follower_id: true,
      profiles_follows_follower_idToprofiles: {
        select: { username: true, fullName: true, avatarUrl: true },
      },
    },
    take: params.limit,
    orderBy: { id: "desc" },
  });

  const items = rows
    .map((r) => ({
      userId: r.follower_id,
      username: r.profiles_follows_follower_idToprofiles?.username ?? null,
      fullName: r.profiles_follows_follower_idToprofiles?.fullName ?? null,
      avatarUrl: r.profiles_follows_follower_idToprofiles?.avatarUrl ?? null,
    }))
    .filter((r) => r.userId);

  const mutualSet = params.viewerId
    ? await getUserMutualSet(params.viewerId, items.map((item) => item.userId))
    : new Set<string>();

  const payload = items.map((item) => ({
    ...item,
    isMutual: mutualSet.has(item.userId),
  }));

  return payload;
}

export async function listUserFollowing(params: {
  userId: string;
  limit: number;
  viewerId?: string | null;
  includeOrganizations?: boolean;
}) {
  const rows = await prisma.follows.findMany({
    where: { follower_id: params.userId },
    select: {
      following_id: true,
      profiles_follows_following_idToprofiles: {
        select: { username: true, fullName: true, avatarUrl: true },
      },
    },
    take: params.limit,
    orderBy: { id: "desc" },
  });

  const items = rows
    .map((r) => ({
      userId: r.following_id,
      username: r.profiles_follows_following_idToprofiles?.username ?? null,
      fullName: r.profiles_follows_following_idToprofiles?.fullName ?? null,
      avatarUrl: r.profiles_follows_following_idToprofiles?.avatarUrl ?? null,
      kind: "user" as const,
    }))
    .filter((r) => r.userId);

  const mutualSet = params.viewerId
    ? await getUserMutualSet(
        params.viewerId,
        items.map((item) => item.userId),
      )
    : new Set<string>();

  const userPayload = items.map((item) => ({
    ...item,
    isMutual: mutualSet.has(item.userId),
  }));

  if (!params.includeOrganizations) {
    return userPayload;
  }

  const organizationRows = await prisma.organization_follows.findMany({
    where: { follower_id: params.userId },
    select: {
      organization_id: true,
      organization_organization_follows_organization_idToorganizations: {
        select: { username: true, publicName: true, businessName: true, brandingAvatarUrl: true },
      },
    },
    take: params.limit,
    orderBy: { id: "desc" },
  });

  const organizationItems: FollowListItem[] = organizationRows.map((row) => {
    const org = row.organization_organization_follows_organization_idToorganizations;
    return {
      userId: `org_${row.organization_id}`,
      username: org?.username ?? null,
      fullName: org?.publicName ?? org?.businessName ?? "Organização ORYA",
      avatarUrl: org?.brandingAvatarUrl ?? null,
      kind: "organization" as const,
    };
  });

  return [...userPayload, ...organizationItems];
}

export async function listOrganizationFollowers(params: { organizationId: number; limit: number }) {
  const rows = await prisma.organization_follows.findMany({
    where: { organization_id: params.organizationId },
    select: {
      follower_id: true,
      profiles_organization_follows_follower_idToprofiles: {
        select: { username: true, fullName: true, avatarUrl: true },
      },
    },
    take: params.limit,
    orderBy: { id: "desc" },
  });

  return rows
    .map((row) => ({
      userId: row.follower_id,
      username: row.profiles_organization_follows_follower_idToprofiles?.username ?? null,
      fullName: row.profiles_organization_follows_follower_idToprofiles?.fullName ?? null,
      avatarUrl: row.profiles_organization_follows_follower_idToprofiles?.avatarUrl ?? null,
    }))
    .filter((item) => item.userId);
}

export async function isOrganizationFollowed(userId: string, organizationId: number) {
  const follow = await prisma.organization_follows.findUnique({
    where: {
      follower_id_organization_id: {
        follower_id: userId,
        organization_id: organizationId,
      },
    },
    select: { organization_id: true },
  });
  return Boolean(follow);
}

export async function getUserFollowingSet(userId: string, targetIds?: string[]) {
  const rows = await prisma.follows.findMany({
    where: {
      follower_id: userId,
      ...(targetIds && targetIds.length > 0 ? { following_id: { in: targetIds } } : {}),
    },
    select: { following_id: true },
  });
  return new Set(rows.map((row) => row.following_id));
}

export async function getUserFollowRequestSet(userId: string, targetIds?: string[]) {
  const rows = await prisma.follow_requests.findMany({
    where: {
      requester_id: userId,
      ...(targetIds && targetIds.length > 0 ? { target_id: { in: targetIds } } : {}),
    },
    select: { target_id: true },
  });
  return new Set(rows.map((row) => row.target_id));
}

export async function getOrganizationFollowingSet(userId: string, organizationIds?: number[]) {
  const rows = await prisma.organization_follows.findMany({
    where: {
      follower_id: userId,
      ...(organizationIds && organizationIds.length > 0 ? { organization_id: { in: organizationIds } } : {}),
    },
    select: { organization_id: true },
  });
  return new Set(rows.map((row) => row.organization_id));
}

export async function getUserMutualSet(viewerId: string, ids: string[]) {
  if (!ids.length) return new Set<string>();
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
  return new Set(ids.filter((id) => followingSet.has(id) && followerSet.has(id)));
}
