import { useQuery } from "@tanstack/react-query";
import { fetchMessagesInbox, fetchMessageInvites, fetchMessageRequests } from "./api";

export const useMessagesInbox = (enabled = true, accessToken?: string | null) =>
  useQuery({
    queryKey: ["messages", "inbox", accessToken ?? "anon"],
    queryFn: () => fetchMessagesInbox(accessToken),
    enabled: enabled && Boolean(accessToken),
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
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });

export const useMessageRequests = (enabled = true, accessToken?: string | null) =>
  useQuery({
    queryKey: ["messages", "requests", accessToken ?? "anon"],
    queryFn: () => fetchMessageRequests(accessToken),
    enabled: enabled && Boolean(accessToken),
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });
