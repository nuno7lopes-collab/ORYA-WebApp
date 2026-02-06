import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchWalletDetail, fetchWalletPage } from "./api";

type WalletMode = "upcoming" | "history";

const pageSize = 20;

export const useWalletFeed = (mode: WalletMode, enabled = true) => {
  const queryKey = useMemo(() => ["wallet", "feed", mode], [mode]);

  return useInfiniteQuery({
    queryKey,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchWalletPage({
        cursor: pageParam,
        pageSize,
        upcomingOnly: mode === "upcoming",
        pastOnly: mode === "history",
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 1000 * 45,
    enabled,
    refetchOnWindowFocus: false,
  });
};

export const useWalletDetail = (entitlementId: string | null) =>
  useQuery({
    queryKey: ["wallet", "detail", entitlementId],
    queryFn: () => fetchWalletDetail(entitlementId as string),
    enabled: Boolean(entitlementId),
    staleTime: 1000 * 30,
  });
