import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { supabase } from "./supabase";
import { getActiveSession } from "./session";
import { resetOnboardingDone } from "./onboardingState";
import { clearOnboardingDraft } from "./onboardingDraft";
import { perfMark, perfMeasure } from "./perf";

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
