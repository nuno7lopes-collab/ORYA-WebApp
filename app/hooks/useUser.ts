"use client";

import useSWR from "swr";

type Role = "user" | "organizer" | "admin" | string;

type ApiMeResponse = {
  user: { id: string; email: string | null } | null;
  profile: {
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    city: string | null;
    favouriteCategories: string[];
    onboardingDone: boolean;
    roles: Role[];
  } | null;
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    throw new Error("Falha ao carregar user");
  }
  return (await res.json()) as ApiMeResponse;
};

export function useUser() {
  const { data, error, isLoading, mutate } = useSWR<ApiMeResponse>(
    "/api/auth/me",
    fetcher
  );

  return {
    user: data?.user ?? null,
    profile: data?.profile ?? null,
    roles: data?.profile?.roles ?? [],
    isLoading,
    isLoggedIn: !!data?.user,
    error,
    mutate,
    refetch: mutate,
  };
}