import { useQuery } from "@tanstack/react-query";
import {
  fetchMyPairings,
  fetchOpenPairings,
  fetchPadelMatches,
  fetchPadelStandings,
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
