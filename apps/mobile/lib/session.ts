import type { Session } from "@supabase/supabase-js";
import { clearSupabaseAuthStorage, supabase } from "./supabase";

type GetActiveSessionOptions = {
  minTtlMs?: number;
  refreshIfNearExpiry?: boolean;
};

const INVALID_REFRESH_TOKEN_PATTERNS = [
  "invalid refresh token",
  "refresh token not found",
  "refresh token has been revoked",
  "already used",
];

const getErrorMessage = (error: unknown) => {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const candidate = error as { message?: unknown; error_description?: unknown };
    if (typeof candidate.message === "string") return candidate.message;
    if (typeof candidate.error_description === "string") {
      return candidate.error_description;
    }
  }
  return String(error);
};

export const isInvalidRefreshTokenError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return INVALID_REFRESH_TOKEN_PATTERNS.some((pattern) =>
    message.includes(pattern),
  );
};

let sessionMarkedInvalid = false;

export const markSessionHealthy = () => {
  sessionMarkedInvalid = false;
};

let clearSessionInFlight: Promise<void> | null = null;
const clearLocalSession = async () => {
  if (clearSessionInFlight) return clearSessionInFlight;
  clearSessionInFlight = (async () => {
    await Promise.resolve(supabase.auth.signOut({ scope: "local" })).catch(
      () => undefined,
    );
    await clearSupabaseAuthStorage().catch(() => undefined);
  })().finally(() => {
    clearSessionInFlight = null;
  });
  return clearSessionInFlight;
};

const invalidateLocalSession = async () => {
  sessionMarkedInvalid = true;
  await clearLocalSession();
};

export const clearLocalSessionSafely = async () => {
  await clearLocalSession();
};

const hasRefreshToken = (session: Session | null | undefined) => {
  const refreshToken = session?.refresh_token;
  return typeof refreshToken === "string" && refreshToken.trim().length > 0;
};

let refreshInFlight: Promise<Session | null> | null = null;
let getSessionInFlight: Promise<Session | null> | null = null;
const readSession = async (): Promise<Session | null> => {
  if (sessionMarkedInvalid) return null;
  if (refreshInFlight) {
    const refreshed = await refreshInFlight.catch(() => null);
    if (refreshed) {
      sessionMarkedInvalid = false;
      return refreshed;
    }
    if (sessionMarkedInvalid) return null;
  }
  if (getSessionInFlight) return getSessionInFlight;

  getSessionInFlight = (async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        if (isInvalidRefreshTokenError(error)) {
          await invalidateLocalSession();
        }
        return null;
      }
      const session = data.session ?? null;
      if (session) {
        sessionMarkedInvalid = false;
      }
      return session;
    } catch (error) {
      if (isInvalidRefreshTokenError(error)) {
        await invalidateLocalSession();
      }
      return null;
    }
  })().finally(() => {
    getSessionInFlight = null;
  });

  return getSessionInFlight;
};

export const refreshSessionIfPossible = async (
  currentSession?: Session | null,
): Promise<Session | null> => {
  if (sessionMarkedInvalid) return null;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      if (sessionMarkedInvalid) return null;
      let sessionCandidate = currentSession;

      if (sessionCandidate === undefined) {
        sessionCandidate = await readSession();
      }

      if (!hasRefreshToken(sessionCandidate)) {
        return null;
      }

      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        if (isInvalidRefreshTokenError(error)) {
          await invalidateLocalSession();
        }
        return null;
      }
      const session = data.session ?? null;
      if (session) {
        sessionMarkedInvalid = false;
      }
      return session;
    } catch (error) {
      if (isInvalidRefreshTokenError(error)) {
        await invalidateLocalSession();
      }
      return null;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
};

export const getActiveSession = async (
  options: number | GetActiveSessionOptions = 60_000,
) => {
  const minTtlMs =
    typeof options === "number" ? options : options.minTtlMs ?? 60_000;
  const refreshIfNearExpiry =
    typeof options === "number" ? true : options.refreshIfNearExpiry ?? true;
  try {
    let session = await readSession();
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
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await invalidateLocalSession();
    }
    return null;
  }
};
