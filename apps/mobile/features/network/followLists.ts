import { useQuery } from "@tanstack/react-query";
import { api, unwrapApiResponse } from "../../lib/api";
import { FollowListItem } from "./types";

export const followersListKey = (userId?: string | null) => ["profile", "followers", userId ?? "anon"];
export const followingListKey = (userId?: string | null) => ["profile", "following", userId ?? "anon"];
export const organizationFollowersKey = (organizationId?: number | string | null) => [
  "profile",
  "organizationFollowers",
  organizationId ?? "anon",
];

const fetchList = async (url: string, accessToken?: string | null) => {
  const response = await api.requestWithAccessToken<unknown>(url, accessToken);
  const payload = unwrapApiResponse<{ items?: FollowListItem[] }>(response);
  return Array.isArray(payload?.items) ? payload.items : [];
};

export const fetchUserFollowers = (userId: string, accessToken?: string | null) =>
  fetchList(`/api/social/followers?userId=${encodeURIComponent(userId)}&limit=30`, accessToken);

export const fetchUserFollowing = (userId: string, accessToken?: string | null) =>
  fetchList(
    `/api/social/following?userId=${encodeURIComponent(userId)}&limit=30&includeOrganizations=true`,
    accessToken,
  );

export const fetchOrganizationFollowers = (organizationId: number, accessToken?: string | null) =>
  fetchList(`/api/social/organization-followers?organizationId=${organizationId}&limit=30`, accessToken);

export const useUserFollowers = (userId: string | null, accessToken?: string | null, enabled = true) =>
  useQuery({
    queryKey: followersListKey(userId),
    queryFn: () => fetchUserFollowers(userId ?? "", accessToken),
    enabled: enabled && Boolean(userId),
  });

export const useUserFollowing = (userId: string | null, accessToken?: string | null, enabled = true) =>
  useQuery({
    queryKey: followingListKey(userId),
    queryFn: () => fetchUserFollowing(userId ?? "", accessToken),
    enabled: enabled && Boolean(userId),
  });

export const useOrganizationFollowers = (
  organizationId: number | null,
  accessToken?: string | null,
  enabled = true,
) =>
  useQuery({
    queryKey: organizationFollowersKey(organizationId),
    queryFn: () => fetchOrganizationFollowers(organizationId ?? 0, accessToken),
    enabled: enabled && Boolean(organizationId),
  });
