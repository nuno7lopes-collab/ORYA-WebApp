"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Role = "user" | "organizer" | "admin" | string;

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
    bio: string | null;
    city: string | null;
    favouriteCategories: string[];
    onboardingDone: boolean;
    roles: Role[];
    visibility: string;
    allowEmailNotifications: boolean;
    allowEventReminders: boolean;
    allowFriendRequests: boolean;
    profileVisibility: "PUBLIC" | "PRIVATE";
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
  const [migrated, setMigrated] = useState(false);
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

  // Migrar bilhetes de guest após login (best-effort)
  useEffect(() => {
    const migrate = async () => {
      try {
        await fetch("/api/tickets/migrate-guest", { method: "POST" });
      } catch (err) {
        console.warn("[useUser] migrate-guest falhou", err);
      }
    };
    if (data?.user && !migratedRef.current) {
      migratedRef.current = true;
      migrate();
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
