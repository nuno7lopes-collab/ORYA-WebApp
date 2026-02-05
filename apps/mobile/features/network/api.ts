import { api, unwrapApiResponse } from "../../lib/api";
import { FollowRequest, FollowStatus, SocialSuggestion } from "./types";

type SuggestionsPayload = {
  items?: SocialSuggestion[];
};

type FollowPayload = {
  status?: FollowStatus;
};

type FollowRequestsPayload = {
  items?: FollowRequest[];
};

export const fetchSocialSuggestions = async (limit = 12): Promise<SocialSuggestion[]> => {
  const response = await api.request<unknown>(`/api/social/suggestions?limit=${limit}`);
  const unwrapped = unwrapApiResponse<SuggestionsPayload>(response);
  return Array.isArray(unwrapped?.items) ? unwrapped.items : [];
};

export const fetchFollowRequests = async (): Promise<FollowRequest[]> => {
  const response = await api.request<unknown>("/api/social/follow-requests");
  const unwrapped = unwrapApiResponse<FollowRequestsPayload>(response);
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

export const acceptFollowRequest = async (requestId: number): Promise<void> => {
  await api.request<unknown>("/api/social/follow-requests/accept", {
    method: "POST",
    body: JSON.stringify({ requestId }),
  });
};

export const declineFollowRequest = async (requestId: number): Promise<void> => {
  await api.request<unknown>("/api/social/follow-requests/decline", {
    method: "POST",
    body: JSON.stringify({ requestId }),
  });
};

export const followOrganization = async (organizationId: number): Promise<void> => {
  await api.request<unknown>("/api/social/follow-organization", {
    method: "POST",
    body: JSON.stringify({ organizationId }),
  });
};

export const unfollowOrganization = async (organizationId: number): Promise<void> => {
  await api.request<unknown>("/api/social/unfollow-organization", {
    method: "POST",
    body: JSON.stringify({ organizationId }),
  });
};
