import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchOffers, searchOrganizations, searchUsers } from "./api";

export const useGlobalSearch = (query: string) => {
  const normalized = query.trim();
  const enabled = normalized.length > 0;

  const offersQuery = useQuery({
    queryKey: ["search", "offers", normalized],
    queryFn: () => searchOffers(normalized),
    enabled,
  });

  const usersQuery = useQuery({
    queryKey: ["search", "users", normalized],
    queryFn: () => searchUsers(normalized),
    enabled,
  });

  const orgsQuery = useQuery({
    queryKey: ["search", "orgs", normalized],
    queryFn: () => searchOrganizations(normalized),
    enabled,
  });

  const isLoading = offersQuery.isLoading || usersQuery.isLoading || orgsQuery.isLoading;
  const isError = offersQuery.isError || usersQuery.isError || orgsQuery.isError;

  const offers = offersQuery.data?.items ?? [];
  const users = usersQuery.data ?? [];
  const organizations = orgsQuery.data ?? [];

  const hasResults = useMemo(
    () => offers.length + users.length + organizations.length > 0,
    [offers.length, users.length, organizations.length],
  );

  return {
    offers,
    users,
    organizations,
    hasResults,
    isLoading,
    isError,
  };
};
