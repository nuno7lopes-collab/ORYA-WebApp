import { useQuery } from "@tanstack/react-query";
import { fetchServiceDetail } from "./api";
import type { ServiceDetail } from "./types";

export const useServiceDetail = (id: string, options?: { courtId?: number | null }) => {
  return useQuery<ServiceDetail, Error>({
    queryKey: ["service-detail", id, options?.courtId ?? null],
    queryFn: () => fetchServiceDetail(id, { courtId: options?.courtId ?? null }),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
};
