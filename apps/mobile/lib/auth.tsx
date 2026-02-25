import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { getActiveSession, refreshSessionIfPossible } from "./session";
import { resetOnboardingDone } from "./onboardingState";
import { clearOnboardingDraft } from "./onboardingDraft";
import { perfMark, perfMeasure } from "./perf";

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
};

const AuthContext = createContext<AuthState>({
  loading: true,
  session: null,
  user: null,
});

const refreshSessionIfNeeded = (candidate: Session | null) => {
  const expiresAtMs = candidate?.expires_at ? candidate.expires_at * 1000 : 0;
  if (!expiresAtMs) return;
  if (expiresAtMs - Date.now() >= 60_000) return;
  refreshSessionIfPossible(candidate).catch(() => undefined);
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      perfMark("auth_get_session");
      const nextSession = await getActiveSession({
        minTtlMs: 60_000,
        refreshIfNearExpiry: true,
      });

      if (mounted) {
        setSession(nextSession);
        setLoading(false);
        perfMeasure("auth_session_ready", "auth_get_session");
        refreshSessionIfNeeded(nextSession);
      }
    };

    hydrate();
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      if (!mounted) return;
      setSession(next);
      if (event === "SIGNED_OUT") {
        resetOnboardingDone().catch(() => undefined);
        clearOnboardingDraft().catch(() => undefined);
      }
    });

    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      getActiveSession({ minTtlMs: 60_000, refreshIfNearExpiry: true })
        .then((nextSession) => {
          if (!mounted) return;
          if (!nextSession && sessionRef.current) {
            const expiresAtMs = sessionRef.current.expires_at
              ? sessionRef.current.expires_at * 1000
              : 0;
            const isCurrentSessionStillValid = expiresAtMs > Date.now();
            if (isCurrentSessionStillValid) {
              return;
            }
          }
          setSession(nextSession);
          refreshSessionIfNeeded(nextSession);
        })
        .catch(() => undefined);
    });
    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
      subscription.remove();
    };
  }, []);

  const value = useMemo(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
    }),
    [loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
