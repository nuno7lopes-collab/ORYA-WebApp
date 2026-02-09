import { useQuery } from "@tanstack/react-query";
import { fetchServiceDetail } from "./api";
import type { ServiceDetail } from "./types";

export const useServiceDetail = (id: string) => {
  return useQuery<ServiceDetail, Error>({
    queryKey: ["service-detail", id],
    queryFn: () => fetchServiceDetail(id),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
};
