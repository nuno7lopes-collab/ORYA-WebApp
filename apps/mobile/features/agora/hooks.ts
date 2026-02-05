import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAgoraTimeline } from "./api";
import { fetchDiscoverPage } from "../discover/api";
import { useIpLocation } from "../onboarding/hooks";

export const useAgoraTimeline = () =>
  useQuery({
    queryKey: ["agora", "timeline"],
    queryFn: fetchAgoraTimeline,
    staleTime: 1000 * 60,
  });

export const useAgoraPersonalized = () => {
  const { data: ipLocation } = useIpLocation();
  const city = ipLocation?.city ?? "";
  return useQuery({
    queryKey: ["agora", "personalized", city],
    queryFn: () => fetchDiscoverPage({ limit: 8, city: city || undefined, kind: "events" }),
    staleTime: 1000 * 60,
  });
};

export const useAgoraFeed = () => {
  const timeline = useAgoraTimeline();
  const personalized = useAgoraPersonalized();

  const isLoading = timeline.isLoading || personalized.isLoading;
  const isError = timeline.isError || personalized.isError;

  const liveItems = timeline.data?.liveNow ?? [];
  const soonItems = timeline.data?.comingSoon ?? [];
  const upcomingItems = timeline.data?.upcoming ?? [];
  const personalizedItems = personalized.data?.items.filter((item) => item.type === "event").map((item) => item.event) ?? [];

  const hasLive = useMemo(() => liveItems.length + soonItems.length > 0, [liveItems.length, soonItems.length]);

  return {
    isLoading,
    isError,
    hasLive,
    liveItems,
    soonItems,
    upcomingItems,
    personalizedItems,
    refetch: async () => {
      await Promise.all([timeline.refetch(), personalized.refetch()]);
    },
  };
};
