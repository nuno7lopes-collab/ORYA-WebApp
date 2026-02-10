import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "./supabase";
import { getActiveSession } from "./session";
import { resetOnboardingDone } from "./onboardingState";
import { clearOnboardingDraft } from "./onboardingDraft";
import { perfMark, perfMeasure } from "./perf";
import { api } from "./api";
import { safeAsyncStorage } from "./storage";

type AuthState = {
  loading: boolean;
  session: any | null;
  user: any | null;
};

const AuthContext = createContext<AuthState>({
  loading: true,
  session: null,
  user: null,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any | null>(null);
  const sessionRef = useRef<any | null>(null);
  const claimInFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      perfMark("auth_get_session");
      const nextSession = await getActiveSession();

      if (mounted) {
        setSession(nextSession);
        setLoading(false);
        perfMeasure("auth_session_ready", "auth_get_session");
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
      getActiveSession()
        .then((nextSession) => {
          if (!mounted) return;
          if (!nextSession && sessionRef.current) return;
          setSession(nextSession);
        })
        .catch(() => undefined);
    });
    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user?.id ?? null;
    if (!userId) return;

    const cooldownMs = 24 * 60 * 60 * 1000;
    const storageKey = `orya:claim-guest:${userId}`;

    const runClaim = async () => {
      if (claimInFlight.current.has(userId)) return;
      const lastRaw = await safeAsyncStorage.getItem(storageKey);
      const last = lastRaw ? Number(lastRaw) : null;
      if (last && Number.isFinite(last) && Date.now() - last < cooldownMs) {
        return;
      }
      claimInFlight.current.add(userId);
      await safeAsyncStorage.setItem(storageKey, String(Date.now()));
      try {
        await api.request("/api/me/claim-guest", { method: "POST" });
      } catch (err) {
        console.warn("[auth] claim-guest falhou", err);
      } finally {
        claimInFlight.current.delete(userId);
      }
    };

    runClaim();
  }, [session?.user?.id]);

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
