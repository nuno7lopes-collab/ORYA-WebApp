import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSocialSuggestions, followUser, unfollowUser } from "./api";
import { FollowStatus, SocialSuggestion } from "./types";

const queryKey = ["network", "suggestions"];

export const useNetworkSuggestions = () =>
  useQuery({
    queryKey,
    queryFn: () => fetchSocialSuggestions(18),
    staleTime: 1000 * 60,
  });

export const useNetworkActions = () => {
  const client = useQueryClient();
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const applyStatus = (targetUserId: string, status: FollowStatus) => {
    client.setQueryData<SocialSuggestion[] | undefined>(queryKey, (old) => {
      if (!old) return old;
      return old.map((item) =>
        item.id === targetUserId
          ? {
              ...item,
              isFollowing: status === "FOLLOWING" || status === "REQUESTED",
            }
          : item,
      );
    });
  };

  const follow = useMutation({
    mutationFn: async (targetUserId: string) => {
      setPendingUserId(targetUserId);
      return followUser(targetUserId);
    },
    onSuccess: (status, targetUserId) => {
      applyStatus(targetUserId, status);
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
      applyStatus(targetUserId, "NONE");
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
