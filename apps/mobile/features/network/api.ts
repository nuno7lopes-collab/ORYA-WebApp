import { api, unwrapApiResponse } from "../../lib/api";
import { FollowStatus, SocialSuggestion } from "./types";

type SuggestionsPayload = {
  items?: SocialSuggestion[];
};

type FollowPayload = {
  status?: FollowStatus;
};

export const fetchSocialSuggestions = async (limit = 12): Promise<SocialSuggestion[]> => {
  const response = await api.request<unknown>(`/api/social/suggestions?limit=${limit}`);
  const unwrapped = unwrapApiResponse<SuggestionsPayload>(response);
  return Array.isArray(unwrapped?.items) ? unwrapped.items : [];
};

export const followUser = async (targetUserId: string): Promise<FollowStatus> => {
  const response = await api.request<unknown>("/api/social/follow", {
    method: "POST",
    body: JSON.stringify({ targetUserId }),
  });
  const unwrapped = unwrapApiResponse<FollowPayload>(response);
  return unwrapped.status ?? "FOLLOWING";
};

export const unfollowUser = async (targetUserId: string): Promise<FollowStatus> => {
  const response = await api.request<unknown>("/api/social/unfollow", {
    method: "POST",
    body: JSON.stringify({ targetUserId }),
  });
  const unwrapped = unwrapApiResponse<FollowPayload>(response);
  return unwrapped.status ?? "NONE";
};
