"use client";

import { useEffect, useRef } from "react";
import useSWR, { mutate as globalMutate } from "swr";
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
  needsEmailConfirmation?: boolean;
};

type UserListenerState = {
  authAttached: boolean;
  profileAttached: boolean;
};

const globalListenerState: UserListenerState =
  (globalThis as any).__ORYA_USER_LISTENERS__ ??
  ((globalThis as any).__ORYA_USER_LISTENERS__ = {
    authAttached: false,
    profileAttached: false,
  });

const ensureAuthListener = () => {
  if (typeof window === "undefined" || globalListenerState.authAttached) return;
  globalListenerState.authAttached = true;
  const {
    data: { subscription },
  } = supabaseBrowser.auth.onAuthStateChange(() => {
    globalMutate("/api/auth/me");
  });
  (globalThis as any).__ORYA_USER_LISTENERS__.authUnsub = () => subscription.unsubscribe();
};

const ensureProfileListener = () => {
  if (typeof window === "undefined" || globalListenerState.profileAttached) return;
  globalListenerState.profileAttached = true;
  const handler = () => globalMutate("/api/auth/me");
  window.addEventListener("orya:profile-updated", handler);
  (globalThis as any).__ORYA_USER_LISTENERS__.profileHandler = handler;
};

const fetcher = async (url: string) => {
  const sessionRes = await supabaseBrowser.auth.getSession();
  if (!sessionRes.data.session) {
    return { user: null, profile: null };
  }
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

const CLAIM_GUEST_DONE = new Set<string>();
const CLAIM_GUEST_IN_FLIGHT = new Set<string>();
const claimGuestStorageKey = (userKey: string) => `orya:claim-guest:${userKey}`;

export function useUser() {
  const { data, error, isLoading, mutate } = useSWR<ApiMeResponse>(
    "/api/auth/me",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60_000,
    },
  );
  const migratedRef = useRef(false);

  // Forçar refresh quando o estado de auth muda (sign in/out) para evitar estado preso
  useEffect(() => {
    ensureAuthListener();
    ensureProfileListener();
  }, []);

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

    const userKey = data?.user?.id ?? data?.user?.email ?? null;
    if (!data?.user || !emailVerified || !userKey) return;

    if (typeof window !== "undefined") {
      const key = claimGuestStorageKey(userKey);
      if (sessionStorage.getItem(key) === "1") {
        CLAIM_GUEST_DONE.add(userKey);
        migratedRef.current = true;
        return;
      }
    }

    if (CLAIM_GUEST_DONE.has(userKey) || CLAIM_GUEST_IN_FLIGHT.has(userKey)) {
      migratedRef.current = true;
      return;
    }

    if (!migratedRef.current) {
      migratedRef.current = true;
      CLAIM_GUEST_IN_FLIGHT.add(userKey);
      claim().finally(() => {
        CLAIM_GUEST_IN_FLIGHT.delete(userKey);
        CLAIM_GUEST_DONE.add(userKey);
        if (typeof window !== "undefined") {
          sessionStorage.setItem(claimGuestStorageKey(userKey), "1");
        }
      });
    }
  }, [data?.user]);

  return {
    user: data?.user ?? null,
    profile: data?.profile ?? null,
    roles: data?.profile?.roles ?? [],
    needsEmailConfirmation: data?.needsEmailConfirmation ?? false,
    isLoading,
    isLoggedIn: !!data?.user,
    error,
    mutate,
    refetch: mutate,
  };
}
