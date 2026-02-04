import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { getActiveSession } from "./session";

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

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const nextSession = await getActiveSession();

      if (mounted) {
        setSession(nextSession);
        setLoading(false);
      }
    };

    hydrate();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
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
