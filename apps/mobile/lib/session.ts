import { supabase } from "./supabase";

type GetActiveSessionOptions = {
  minTtlMs?: number;
  refreshIfNearExpiry?: boolean;
};

export const getActiveSession = async (
  options: number | GetActiveSessionOptions = 60_000,
) => {
  const minTtlMs =
    typeof options === "number" ? options : options.minTtlMs ?? 60_000;
  const refreshIfNearExpiry =
    typeof options === "number" ? true : options.refreshIfNearExpiry ?? true;
  try {
    const { data } = await supabase.auth.getSession();
    let session = data.session ?? null;
    if (!session) {
      if (!refreshIfNearExpiry) return null;
      const refreshed = await supabase.auth.refreshSession();
      return refreshed.data.session ?? null;
    }
    if (!refreshIfNearExpiry) return session;

    const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
    if (!expiresAtMs) return session;
    const shouldRefresh = expiresAtMs - Date.now() < minTtlMs;

    if (shouldRefresh) {
      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.data.session) {
        session = refreshed.data.session;
      } else if (expiresAtMs <= Date.now()) {
        session = null;
      }
    }

    return session;
  } catch {
    return null;
  }
};
