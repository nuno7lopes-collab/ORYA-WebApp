import { useQuery } from "@tanstack/react-query";
import { fetchEventDetail } from "./api";

export const useEventDetail = (slug: string) => {
  return useQuery({
    queryKey: ["event-detail", slug],
    queryFn: () => fetchEventDetail(slug),
    enabled: Boolean(slug),
    staleTime: 60 * 1000,
  });
};
