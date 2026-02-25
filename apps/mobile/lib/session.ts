import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type GetActiveSessionOptions = {
  minTtlMs?: number;
  refreshIfNearExpiry?: boolean;
};

const hasRefreshToken = (session: Session | null | undefined) => {
  const refreshToken = session?.refresh_token;
  return typeof refreshToken === "string" && refreshToken.trim().length > 0;
};

export const refreshSessionIfPossible = async (
  currentSession?: Session | null,
): Promise<Session | null> => {
  try {
    const sessionCandidate =
      currentSession === undefined
        ? (await supabase.auth.getSession()).data.session ?? null
        : currentSession;
    if (!hasRefreshToken(sessionCandidate)) {
      return null;
    }
    const refreshed = await supabase.auth.refreshSession();
    return refreshed.data.session ?? null;
  } catch {
    return null;
  }
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
    if (!session) return null;
    if (!refreshIfNearExpiry) return session;

    const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
    if (!expiresAtMs) return session;
    const shouldRefresh = expiresAtMs - Date.now() < minTtlMs;

    if (shouldRefresh) {
      const refreshedSession = await refreshSessionIfPossible(session);
      if (refreshedSession) {
        session = refreshedSession;
      } else if (expiresAtMs <= Date.now()) {
        session = null;
      }
    }

    return session;
  } catch {
    return null;
  }
};
