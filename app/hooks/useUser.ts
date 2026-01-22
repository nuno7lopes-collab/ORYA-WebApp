"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Role = "user" | "organization" | "admin" | string;

type ApiMeResponse = {
  user: {
    id: string;
    email: string | null;
    emailConfirmed?: boolean;
    emailConfirmedAt?: string | null;
  } | null;
  profile: {
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    coverUrl: string | null;
    updatedAt: string | null;
    bio: string | null;
    city: string | null;
    isVerified: boolean;
    favouriteCategories: string[];
    onboardingDone: boolean;
    roles: Role[];
    visibility: string;
    allowEmailNotifications: boolean;
    allowEventReminders: boolean;
    allowFollowRequests: boolean;
    allowSalesAlerts?: boolean;
    allowSystemAnnouncements?: boolean;
    allowMarketingCampaigns?: boolean;
    profileVisibility: "PUBLIC" | "PRIVATE" | "FOLLOWERS";
  } | null;
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  if (res.status === 401) {
    // Sem sessão válida → devolve user/profile null sem erro
    return { user: null, profile: null };
  }
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
  const migratedRef = useRef(false);

  // Forçar refresh quando o estado de auth muda (sign in/out) para evitar estado preso
  useEffect(() => {
    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange(() => {
      mutate();
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [mutate]);

  useEffect(() => {
    const handler = () => mutate();
    window.addEventListener("orya:profile-updated", handler);
    return () => window.removeEventListener("orya:profile-updated", handler);
  }, [mutate]);

  // Claim guest purchases após email verificado (best-effort)
  useEffect(() => {
    const claim = async () => {
      try {
        await fetch("/api/me/claim-guest", { method: "POST" });
      } catch (err) {
        console.warn("[useUser] claim-guest falhou", err);
      }
    };
    const emailVerified =
      Boolean((data?.user as any)?.emailConfirmedAt) ||
      Boolean((data?.user as any)?.emailConfirmed) ||
      Boolean(data?.user?.email);

    if (data?.user && emailVerified && !migratedRef.current) {
      migratedRef.current = true;
      claim();
    }
  }, [data?.user]);

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
