import { useQuery } from "@tanstack/react-query";
import {
  fetchMyPairings,
  fetchOpenPairings,
  fetchPadelMatches,
  fetchPadelStandings,
  fetchPadelSummary,
  fetchPadelMyMatches,
  fetchPadelDiscover,
  fetchPadelRankings,
} from "./api";

export const usePadelStandings = (
  eventId: number | null,
  categoryId?: number | null,
  enabled = true,
  poll = false,
) => {
  return useQuery({
    queryKey: ["padel-standings", eventId, categoryId],
    queryFn: () => fetchPadelStandings(eventId as number, categoryId),
    enabled: enabled && Number.isFinite(eventId),
    staleTime: poll ? 20_000 : 60_000,
    refetchInterval: poll ? 30_000 : false,
  });
};

export const usePadelMatches = (
  eventId: number | null,
  categoryId?: number | null,
  enabled = true,
  poll = false,
) => {
  return useQuery({
    queryKey: ["padel-matches", eventId, categoryId],
    queryFn: () => fetchPadelMatches(eventId as number, categoryId),
    enabled: enabled && Number.isFinite(eventId),
    staleTime: poll ? 20_000 : 60_000,
    refetchInterval: poll ? 30_000 : false,
  });
};

export const useOpenPairings = (
  eventId: number | null,
  categoryId?: number | null,
  enabled = true,
) => {
  return useQuery({
    queryKey: ["padel-open-pairings", eventId, categoryId],
    queryFn: () => fetchOpenPairings(eventId as number, categoryId),
    enabled: enabled && Number.isFinite(eventId),
    staleTime: 30_000,
  });
};

export const useMyPairings = (eventId: number | null, enabled = true) => {
  return useQuery({
    queryKey: ["padel-my-pairings", eventId],
    queryFn: () => fetchMyPairings(eventId ?? undefined),
    enabled: enabled,
    staleTime: 20_000,
  });
};

export const usePadelSummary = (enabled = true) => {
  return useQuery({
    queryKey: ["padel-me-summary"],
    queryFn: () => fetchPadelSummary(),
    enabled,
    staleTime: 30_000,
  });
};

export const usePadelMyMatches = (
  params?: { scope?: "all" | "upcoming" | "past"; limit?: number },
  enabled = true,
) => {
  return useQuery({
    queryKey: ["padel-me-matches", params?.scope ?? "all", params?.limit ?? null],
    queryFn: () => fetchPadelMyMatches(params),
    enabled,
    staleTime: 20_000,
  });
};

export const usePadelDiscover = (params?: { q?: string; date?: string; limit?: number }, enabled = true) => {
  return useQuery({
    queryKey: ["padel-discover", params?.q ?? "", params?.date ?? "", params?.limit ?? null],
    queryFn: () => fetchPadelDiscover(params),
    enabled,
    staleTime: 30_000,
  });
};

export const usePadelRankings = (
  params?: { scope?: "global" | "organization"; limit?: number; periodDays?: number },
  enabled = true,
) => {
  return useQuery({
    queryKey: ["padel-rankings", params?.scope ?? "global", params?.limit ?? null, params?.periodDays ?? null],
    queryFn: () => fetchPadelRankings(params),
    enabled,
    staleTime: 60_000,
  });
};
