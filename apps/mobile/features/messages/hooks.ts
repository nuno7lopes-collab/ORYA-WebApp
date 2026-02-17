import { useQuery } from "@tanstack/react-query";
import {
  fetchMessagesInbox,
  fetchMessageInvites,
  fetchMessageRequests,
} from "./api";

export const useMessagesInbox = (enabled = true, accessToken?: string | null) =>
  useQuery({
    queryKey: ["messages", "inbox", accessToken ?? "anon"],
    queryFn: () => fetchMessagesInbox(accessToken),
    enabled: enabled && Boolean(accessToken),
    retry: false,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });

export const useMessageInvites = (
  eventId: number | null,
  enabled = true,
  accessToken?: string | null,
) =>
  useQuery({
    queryKey: ["messages", "invites", eventId ?? "none", accessToken ?? "anon"],
    queryFn: () => fetchMessageInvites(eventId ?? null, accessToken),
    enabled: enabled && typeof eventId === "number" && eventId > 0 && Boolean(accessToken),
    retry: false,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });

export const useMessageRequests = (
  enabled = true,
  accessToken?: string | null,
  currentUserId?: string | null,
) =>
  useQuery({
    queryKey: ["messages", "requests", accessToken ?? "anon", currentUserId ?? "anon"],
    queryFn: () => fetchMessageRequests(currentUserId, accessToken),
    enabled: enabled && Boolean(accessToken) && Boolean(currentUserId),
    retry: false,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });
