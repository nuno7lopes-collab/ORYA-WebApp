import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchDiscoverPage } from "./api";
import { DiscoverDateFilter, DiscoverKind, DiscoverPriceFilter } from "./types";

export const useDebouncedValue = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
};

export const useDiscoverFeed = (
  params: {
    q: string;
    type: DiscoverPriceFilter;
    kind: DiscoverKind;
    date: DiscoverDateFilter;
    city: string;
  },
  enabled = true,
) => {
  const queryKey = useMemo(
    () => ["discover", params.q.trim(), params.type, params.kind, params.date, params.city.trim().toLowerCase()],
    [params.q, params.type, params.kind, params.date, params.city],
  );

  return useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchDiscoverPage({
        q: params.q.trim() || undefined,
        type: params.type,
        kind: params.kind,
        date: params.date,
        city: params.city.trim() || undefined,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : null),
    staleTime: 1000 * 60 * 2,
    gcTime: 10 * 60_000,
    retry: 1,
    enabled,
    refetchOnWindowFocus: false,
  });
};

export const useDiscoverMapEvents = (
  params: {
    q?: string;
    type: DiscoverPriceFilter;
    date: DiscoverDateFilter;
    city: string;
    limit?: number;
    startDate?: string;
    endDate?: string;
    templateTypes?: string;
    priceMin?: number | null;
    priceMax?: number | null;
    north?: number;
    south?: number;
    east?: number;
    west?: number;
  },
  enabled = true,
) => {
  const queryKey = useMemo(
    () => [
      "discover-map",
      params.q?.trim() ?? "",
      params.type,
      params.date,
      params.city.trim().toLowerCase(),
      params.limit ?? 60,
      params.startDate ?? "",
      params.endDate ?? "",
      params.templateTypes ?? "",
      typeof params.priceMin === "number" ? params.priceMin : "min-null",
      typeof params.priceMax === "number" ? params.priceMax : "max-null",
      typeof params.north === "number" ? params.north : "north-null",
      typeof params.south === "number" ? params.south : "south-null",
      typeof params.east === "number" ? params.east : "east-null",
      typeof params.west === "number" ? params.west : "west-null",
    ],
    [
      params.city,
      params.date,
      params.endDate,
      params.limit,
      params.north,
      params.south,
      params.east,
      params.west,
      params.priceMax,
      params.priceMin,
      params.q,
      params.startDate,
      params.templateTypes,
      params.type,
    ],
  );

  return useQuery({
    queryKey,
    queryFn: () =>
      fetchDiscoverPage({
        q: params.q?.trim() || undefined,
        type: params.type,
        kind: "events",
        date: params.date,
        city: params.city.trim() || undefined,
        limit: params.limit ?? 60,
        startDate: params.startDate,
        endDate: params.endDate,
        templateTypes: params.templateTypes,
        priceMin: params.priceMin ?? undefined,
        priceMax: params.priceMax ?? undefined,
        north: params.north,
        south: params.south,
        east: params.east,
        west: params.west,
      }),
    staleTime: 1000 * 60 * 2,
    gcTime: 10 * 60_000,
    retry: 1,
    enabled,
    refetchOnWindowFocus: false,
  });
};
