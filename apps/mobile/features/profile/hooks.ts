import { useQuery } from "@tanstack/react-query";
import { fetchProfileAgenda, fetchProfileSummary } from "./api";

export const useProfileSummary = (enabled = true) =>
  useQuery({
    queryKey: ["profile", "summary"],
    queryFn: fetchProfileSummary,
    staleTime: 1000 * 60 * 3,
    enabled,
  });

export const useProfileAgenda = () =>
  useQuery({
    queryKey: ["profile", "agenda"],
    queryFn: fetchProfileAgenda,
    staleTime: 1000 * 60,
  });
