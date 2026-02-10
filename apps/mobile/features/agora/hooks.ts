import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchAgoraPage } from "./api";
import { AgoraPageParam } from "./types";

export const useAgoraFeed = (enabled = true) => {
  const feed = useInfiniteQuery({
    queryKey: ["agora", "feed"],
    initialPageParam: { cursor: null, mode: "agora" } as AgoraPageParam,
    queryFn: ({ pageParam }) => fetchAgoraPage(pageParam),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? ({ cursor: lastPage.nextCursor, mode: lastPage.mode } satisfies AgoraPageParam) : null,
    staleTime: 1000 * 60 * 2,
    gcTime: 10 * 60_000,
    retry: 1,
    enabled,
    refetchOnWindowFocus: false,
  });

  const items = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data?.pages]);

  return {
    items,
    isLoading: feed.isLoading,
    isError: feed.isError,
    isFetching: feed.isFetching,
    isRefetching: feed.isRefetching,
    isFetchingNextPage: feed.isFetchingNextPage,
    hasNextPage: feed.hasNextPage,
    fetchNextPage: feed.fetchNextPage,
    feedError: feed.error ?? null,
    refetch: feed.refetch,
  };
};
