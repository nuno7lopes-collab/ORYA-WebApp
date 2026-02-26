import { useQuery } from "@tanstack/react-query";
import { fetchEventDetail } from "./api";

export const useEventDetail = (slug: string, inviteToken?: string | null) => {
  const normalizedInviteToken = inviteToken?.trim() ?? null;
  return useQuery({
    queryKey: ["event-detail", slug, normalizedInviteToken],
    queryFn: () => fetchEventDetail(slug, normalizedInviteToken),
    enabled: Boolean(slug),
    staleTime: 60 * 1000,
  });
};
