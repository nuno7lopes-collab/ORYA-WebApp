import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  acceptFollowRequest,
  declineFollowRequest,
  fetchFollowRequests,
  fetchSocialSuggestions,
  followOrganization,
  followUser,
  unfollowOrganization,
  unfollowUser,
} from "./api";
import { FollowRequest, FollowStatus, SocialSuggestion } from "./types";
import { SearchOrganization, SearchUser } from "../search/types";
import { PublicProfilePayload } from "../profile/types";

const suggestionsKey = ["network", "suggestions"];
const followRequestsKey = ["network", "follow-requests"];
const searchUsersKey = ["search", "users"];
const searchOrgsKey = ["search", "orgs"];
const publicProfileKey = ["profile", "public"];
const publicProfileEventsKey = ["profile", "public", "events"];
const socialFeedKey = ["social", "feed"];
const SOCIAL_FEED_INVALIDATE_DELAY_MS = 450;
let socialFeedInvalidateTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleSocialFeedInvalidation = (client: QueryClient) => {
  if (socialFeedInvalidateTimer) return;
  socialFeedInvalidateTimer = setTimeout(() => {
    socialFeedInvalidateTimer = null;
    void client.invalidateQueries({ queryKey: socialFeedKey });
  }, SOCIAL_FEED_INVALIDATE_DELAY_MS);
};

export const useNetworkSuggestions = (enabled = true) =>
  useQuery({
    queryKey: suggestionsKey,
    queryFn: () => fetchSocialSuggestions(18),
    staleTime: 1000 * 60,
    enabled,
    refetchOnWindowFocus: false,
  });

export const useFollowRequests = (enabled = true) =>
  useQuery({
    queryKey: followRequestsKey,
    queryFn: fetchFollowRequests,
    staleTime: 1000 * 30,
    enabled,
    refetchOnWindowFocus: false,
  });

const updateUserCaches = (
  client: ReturnType<typeof useQueryClient>,
  targetUserId: string,
  status: FollowStatus,
) => {
  const isFollowing = status === "FOLLOWING";
  const isRequested = status === "REQUESTED";

  client.setQueryData<SocialSuggestion[] | undefined>(suggestionsKey, (old) => {
    if (!old) return old;
    return old.map((item) =>
      item.id === targetUserId
        ? {
            ...item,
            isFollowing,
            isRequested,
          }
        : item,
    );
  });

  client.setQueriesData<SearchUser[] | undefined>({ queryKey: searchUsersKey }, (old) => {
    if (!old) return old;
    return old.map((item) =>
      item.id === targetUserId
        ? {
            ...item,
            isFollowing,
            isRequested,
          }
        : item,
    );
  });

  client.setQueriesData<PublicProfilePayload | undefined>({ queryKey: publicProfileKey }, (old) => {
    if (!old || old.type !== "user") return old;
    if (String(old.profile?.id ?? "") !== targetUserId) return old;
    if (old.isSelf) return old;

    const prevFollowing = Boolean(old.viewer?.isFollowing);
    const nextFollowing = status === "FOLLOWING";
    const nextRequested = status === "REQUESTED";
    let followers = old.counts?.followers ?? 0;

    if (nextFollowing && !prevFollowing) followers += 1;
    if (!nextFollowing && prevFollowing) followers = Math.max(0, followers - 1);

    return {
      ...old,
      counts: {
        ...old.counts,
        followers,
      },
      viewer: {
        ...(old.viewer ?? {}),
        isFollowing: nextFollowing,
        isRequested: nextRequested,
      },
    };
  });
};

export const useNetworkActions = () => {
  const client = useQueryClient();
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const follow = useMutation({
    mutationFn: (targetUserId: string) => followUser(targetUserId),
    onMutate: (targetUserId: string) => {
      setPendingUserId(targetUserId);
      updateUserCaches(client, targetUserId, "REQUESTED");
    },
    onError: () => {
      client.invalidateQueries({ queryKey: suggestionsKey });
      client.invalidateQueries({ queryKey: searchUsersKey });
      client.invalidateQueries({ queryKey: publicProfileKey });
    },
    onSuccess: (status, targetUserId) => {
      updateUserCaches(client, targetUserId, status);
      scheduleSocialFeedInvalidation(client);
      if (status === "FOLLOWING") {
        client.invalidateQueries({ queryKey: publicProfileEventsKey });
      }
    },
    onSettled: () => {
      setPendingUserId(null);
    },
  });

  const unfollow = useMutation({
    mutationFn: (targetUserId: string) => unfollowUser(targetUserId),
    onMutate: (targetUserId: string) => {
      setPendingUserId(targetUserId);
      updateUserCaches(client, targetUserId, "NONE");
    },
    onError: () => {
      client.invalidateQueries({ queryKey: suggestionsKey });
      client.invalidateQueries({ queryKey: searchUsersKey });
      client.invalidateQueries({ queryKey: publicProfileKey });
    },
    onSuccess: (_, targetUserId) => {
      updateUserCaches(client, targetUserId, "NONE");
      scheduleSocialFeedInvalidation(client);
    },
    onSettled: () => {
      setPendingUserId(null);
    },
  });

  return useMemo(
    () => ({
      pendingUserId,
      follow: (targetUserId: string) => follow.mutate(targetUserId),
      unfollow: (targetUserId: string) => unfollow.mutate(targetUserId),
      isMutating: follow.isPending || unfollow.isPending,
    }),
    [pendingUserId, follow, unfollow],
  );
};

export const useFollowRequestActions = () => {
  const client = useQueryClient();
  const [pendingRequestId, setPendingRequestId] = useState<number | null>(null);

  const removeFromCache = (requestId: number) => {
    client.setQueryData<FollowRequest[] | undefined>(followRequestsKey, (old) => {
      if (!old) return old;
      return old.filter((item) => item.id !== requestId);
    });
  };

  const accept = useMutation({
    mutationFn: async (requestId: number) => {
      await acceptFollowRequest(requestId);
      return requestId;
    },
    onMutate: (requestId: number) => {
      setPendingRequestId(requestId);
      removeFromCache(requestId);
    },
    onError: () => {
      client.invalidateQueries({ queryKey: followRequestsKey });
    },
    onSuccess: (requestId) => {
      removeFromCache(requestId);
    },
    onSettled: () => {
      setPendingRequestId(null);
      client.invalidateQueries({ queryKey: followRequestsKey });
    },
  });

  const decline = useMutation({
    mutationFn: async (requestId: number) => {
      await declineFollowRequest(requestId);
      return requestId;
    },
    onMutate: (requestId: number) => {
      setPendingRequestId(requestId);
      removeFromCache(requestId);
    },
    onError: () => {
      client.invalidateQueries({ queryKey: followRequestsKey });
    },
    onSuccess: (requestId) => {
      removeFromCache(requestId);
    },
    onSettled: () => {
      setPendingRequestId(null);
      client.invalidateQueries({ queryKey: followRequestsKey });
    },
  });

  return useMemo(
    () => ({
      pendingRequestId,
      accept: (requestId: number) => accept.mutate(requestId),
      decline: (requestId: number) => decline.mutate(requestId),
      isMutating: accept.isPending || decline.isPending,
    }),
    [pendingRequestId, accept, decline],
  );
};

export const useOrganizationFollowActions = () => {
  const client = useQueryClient();
  const [pendingOrgId, setPendingOrgId] = useState<number | null>(null);

  const applyOrganizationStatus = (organizationId: number, isFollowing: boolean) => {
    client.setQueriesData<SearchOrganization[] | undefined>({ queryKey: searchOrgsKey }, (old) => {
      if (!old) return old;
      return old.map((item) =>
        item.id === organizationId
          ? {
              ...item,
              isFollowing,
            }
          : item,
      );
    });

    client.setQueriesData<PublicProfilePayload | undefined>({ queryKey: publicProfileKey }, (old) => {
      if (!old || old.type !== "organization") return old;
      if (Number(old.profile?.id) !== organizationId) return old;

      const prevFollowing = Boolean(old.viewer?.isFollowing);
      let followers = old.counts?.followers ?? 0;
      if (isFollowing && !prevFollowing) followers += 1;
      if (!isFollowing && prevFollowing) followers = Math.max(0, followers - 1);

      return {
        ...old,
        counts: {
          ...old.counts,
          followers,
        },
        viewer: {
          ...(old.viewer ?? {}),
          isFollowing,
        },
      };
    });
  };

  const follow = useMutation({
    mutationFn: async (organizationId: number) => {
      await followOrganization(organizationId);
      return organizationId;
    },
    onMutate: (organizationId: number) => {
      setPendingOrgId(organizationId);
      applyOrganizationStatus(organizationId, true);
    },
    onError: () => {
      client.invalidateQueries({ queryKey: searchOrgsKey });
      client.invalidateQueries({ queryKey: publicProfileKey });
    },
    onSuccess: (organizationId) => {
      applyOrganizationStatus(organizationId, true);
      scheduleSocialFeedInvalidation(client);
      client.invalidateQueries({ queryKey: publicProfileEventsKey });
    },
    onSettled: () => {
      setPendingOrgId(null);
    },
  });

  const unfollow = useMutation({
    mutationFn: async (organizationId: number) => {
      await unfollowOrganization(organizationId);
      return organizationId;
    },
    onMutate: (organizationId: number) => {
      setPendingOrgId(organizationId);
      applyOrganizationStatus(organizationId, false);
    },
    onError: () => {
      client.invalidateQueries({ queryKey: searchOrgsKey });
      client.invalidateQueries({ queryKey: publicProfileKey });
    },
    onSuccess: (organizationId) => {
      applyOrganizationStatus(organizationId, false);
      scheduleSocialFeedInvalidation(client);
    },
    onSettled: () => {
      setPendingOrgId(null);
    },
  });

  return useMemo(
    () => ({
      pendingOrgId,
      follow: (organizationId: number) => follow.mutate(organizationId),
      unfollow: (organizationId: number) => unfollow.mutate(organizationId),
      isMutating: follow.isPending || unfollow.isPending,
    }),
    [pendingOrgId, follow, unfollow],
  );
};
