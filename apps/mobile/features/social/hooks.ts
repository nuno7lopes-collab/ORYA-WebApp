import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchSocialFeedPage } from "./api";

export const useSocialFeed = (limit = 10) =>
  useInfiniteQuery({
    queryKey: ["social", "feed", limit],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchSocialFeedPage({
        limit,
        cursor: pageParam,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : null),
    staleTime: 45_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
