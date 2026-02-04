import { supabase } from "./supabase";

export const getActiveSession = async (minTtlMs = 60_000) => {
  try {
    const { data } = await supabase.auth.getSession();
    let session = data.session ?? null;
    const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
    const shouldRefresh = !session || expiresAt - Date.now() < minTtlMs;

    if (shouldRefresh) {
      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.data.session) {
        session = refreshed.data.session;
      }
    }

    return session;
  } catch {
    return null;
  }
};
