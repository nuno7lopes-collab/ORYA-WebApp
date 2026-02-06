import { useQuery } from "@tanstack/react-query";
import { fetchIpLocation } from "./api";

export const useIpLocation = (enabled = true) =>
  useQuery({
    queryKey: ["onboarding", "ip-location"],
    queryFn: fetchIpLocation,
    staleTime: 1000 * 60 * 10,
    retry: 1,
    enabled,
    refetchOnWindowFocus: false,
  });
