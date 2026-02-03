import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
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

export const useDiscoverFeed = (params: {
  q: string;
  type: DiscoverPriceFilter;
  kind: DiscoverKind;
  date: DiscoverDateFilter;
  city: string;
}) => {
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
    staleTime: 45_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
};
