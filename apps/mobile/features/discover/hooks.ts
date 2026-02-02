import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchDiscoverPage } from "./api";

export const useDebouncedValue = <T>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
};

export const useDiscoverFeed = (params: { q: string; type: "all" | "free" | "paid" }) => {
  const queryKey = useMemo(() => ["discover", params.q.trim(), params.type], [params.q, params.type]);

  return useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchDiscoverPage({
        q: params.q.trim() || undefined,
        type: params.type,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : null),
  });
};
