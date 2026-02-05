import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

const suggestionsKey = ["network", "suggestions"];
const followRequestsKey = ["network", "follow-requests"];
const searchUsersKey = ["search", "users"];
const searchOrgsKey = ["search", "orgs"];

export const useNetworkSuggestions = () =>
  useQuery({
    queryKey: suggestionsKey,
    queryFn: () => fetchSocialSuggestions(18),
    staleTime: 1000 * 60,
  });

export const useFollowRequests = () =>
  useQuery({
    queryKey: followRequestsKey,
    queryFn: fetchFollowRequests,
    staleTime: 1000 * 30,
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
};

export const useNetworkActions = () => {
  const client = useQueryClient();
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const follow = useMutation({
    mutationFn: async (targetUserId: string) => {
      setPendingUserId(targetUserId);
      return followUser(targetUserId);
    },
    onSuccess: (status, targetUserId) => {
      updateUserCaches(client, targetUserId, status);
    },
    onSettled: () => {
      setPendingUserId(null);
    },
  });

  const unfollow = useMutation({
    mutationFn: async (targetUserId: string) => {
      setPendingUserId(targetUserId);
      return unfollowUser(targetUserId);
    },
    onSuccess: (_, targetUserId) => {
      updateUserCaches(client, targetUserId, "NONE");
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
      setPendingRequestId(requestId);
      await acceptFollowRequest(requestId);
      return requestId;
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
      setPendingRequestId(requestId);
      await declineFollowRequest(requestId);
      return requestId;
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
  };

  const follow = useMutation({
    mutationFn: async (organizationId: number) => {
      setPendingOrgId(organizationId);
      await followOrganization(organizationId);
      return organizationId;
    },
    onSuccess: (organizationId) => {
      applyOrganizationStatus(organizationId, true);
      client.invalidateQueries({ queryKey: ["social", "feed"] });
    },
    onSettled: () => {
      setPendingOrgId(null);
    },
  });

  const unfollow = useMutation({
    mutationFn: async (organizationId: number) => {
      setPendingOrgId(organizationId);
      await unfollowOrganization(organizationId);
      return organizationId;
    },
    onSuccess: (organizationId) => {
      applyOrganizationStatus(organizationId, false);
      client.invalidateQueries({ queryKey: ["social", "feed"] });
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
