import { useQuery } from "@tanstack/react-query";
import { fetchProfileAgenda, fetchProfileSummary } from "./api";

export const useProfileSummary = (
  enabled = true,
  accessToken?: string | null,
  userId?: string | null,
) =>
  useQuery({
    queryKey: ["profile", "summary", userId ?? "anon"],
    queryFn: () => fetchProfileSummary(accessToken),
    staleTime: 1000 * 60 * 3,
    enabled: enabled && Boolean(accessToken),
  });

export const useProfileAgenda = (accessToken?: string | null, userId?: string | null) =>
  useQuery({
    queryKey: ["profile", "agenda", userId ?? "anon"],
    queryFn: () => fetchProfileAgenda(accessToken),
    staleTime: 1000 * 60,
    enabled: Boolean(accessToken),
  });
