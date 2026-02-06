import { useQuery } from "@tanstack/react-query";
import { fetchProfileAgenda, fetchProfileSummary, fetchPublicProfile, fetchPublicProfileEvents } from "./api";

export const useProfileSummary = (
  enabled = true,
  accessToken?: string | null,
  userId?: string | null,
) =>
  useQuery({
    queryKey: ["profile", "summary", userId ?? "anon"],
    queryFn: () => fetchProfileSummary(accessToken),
    staleTime: 1000 * 60 * 3,
    enabled: enabled && Boolean(accessToken),
  });

export const useProfileAgenda = (
  accessToken?: string | null,
  userId?: string | null,
  enabled = true,
) =>
  useQuery({
    queryKey: ["profile", "agenda", userId ?? "anon"],
    queryFn: () => fetchProfileAgenda(accessToken),
    staleTime: 1000 * 60,
    enabled: enabled && Boolean(accessToken),
    refetchOnWindowFocus: false,
  });

export const usePublicProfile = (
  username: string | null,
  accessToken?: string | null,
  enabled = true,
) =>
  useQuery({
    queryKey: ["profile", "public", username ?? "unknown"],
    queryFn: () => fetchPublicProfile(username ?? "", accessToken),
    enabled: enabled && Boolean(username),
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });

export const usePublicProfileEvents = (
  username: string | null,
  accessToken?: string | null,
  enabled = true,
) =>
  useQuery({
    queryKey: ["profile", "public", "events", username ?? "unknown", accessToken ?? "anon"],
    queryFn: () => fetchPublicProfileEvents(username ?? "", accessToken),
    enabled: enabled && Boolean(username),
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });
