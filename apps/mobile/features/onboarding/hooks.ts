import { useQuery } from "@tanstack/react-query";
import { fetchIpLocation } from "./api";

export const useIpLocation = () =>
  useQuery({
    queryKey: ["onboarding", "ip-location"],
    queryFn: fetchIpLocation,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });
