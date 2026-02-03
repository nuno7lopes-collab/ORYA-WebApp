import { useQuery } from "@tanstack/react-query";
import { fetchServiceDetail } from "./api";

export const useServiceDetail = (id: string) => {
  return useQuery({
    queryKey: ["service-detail", id],
    queryFn: () => fetchServiceDetail(id),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });
};
