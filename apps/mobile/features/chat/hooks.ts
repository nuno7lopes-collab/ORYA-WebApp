import { useQuery } from "@tanstack/react-query";
import { fetchChatThreads, fetchEventChatThread } from "./api";

export const useChatThreads = (enabled = true, accessToken?: string | null) =>
  useQuery({
    queryKey: ["chat", "threads", accessToken ?? "anon"],
    queryFn: () => fetchChatThreads(accessToken),
    enabled: enabled && Boolean(accessToken),
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });

export const useEventChatThread = (
  eventId: number | null,
  enabled = true,
  accessToken?: string | null,
) =>
  useQuery({
    queryKey: ["chat", "event", eventId ?? "none", accessToken ?? "anon"],
    queryFn: () => fetchEventChatThread(eventId ?? 0, accessToken),
    enabled: enabled && typeof eventId === "number" && eventId > 0 && Boolean(accessToken),
    staleTime: 1000 * 20,
    refetchOnWindowFocus: false,
  });
