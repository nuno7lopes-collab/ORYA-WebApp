// lib/security.ts
//
// Helpers simples de segurança/autorização para ser usados nas rotas/API.
//

import type { SupabaseClient, User } from "@supabase/supabase-js";

export class UnauthenticatedError extends Error {
  constructor() {
    super("UNAUTHENTICATED");
    this.name = "UNAUTHENTICATED";
  }
}

export class AuthUnavailableError extends Error {
  status = 503;
  errorCode = "AUTH_UNAVAILABLE";

  constructor(cause?: unknown) {
    super("AUTH_UNAVAILABLE");
    this.name = "AUTH_UNAVAILABLE";
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

const NETWORK_ERROR_CODES = new Set([
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ECONNREFUSED",
  "ECONNRESET",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
]);

const extractErrorMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "";
};

const extractErrorCode = (err: unknown) => {
  if (!err || typeof err !== "object") return null;
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string") return code;
  if (typeof code === "number") return String(code);
  return null;
};

const extractErrorStatus = (err: unknown) => {
  if (!err || typeof err !== "object") return null;
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
};

const isNetworkErrorMessage = (message: string) => {
  const lower = message.toLowerCase();
  return (
    lower.includes("fetch failed") ||
    lower.includes("failed to fetch") ||
    lower.includes("network request failed") ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("socket hang up") ||
    lower.includes("aborted")
  );
};

const isAuthUnavailableCause = (err: unknown): boolean => {
  if (!err) return false;
  if (err instanceof AuthUnavailableError) return true;

  if (err instanceof AggregateError) {
    for (const item of err.errors) {
      if (isAuthUnavailableCause(item)) return true;
    }
  }

  const status = extractErrorStatus(err);
  if (status !== null && (status === 0 || status === 429 || status >= 500)) return true;

  const code = extractErrorCode(err);
  if (code && NETWORK_ERROR_CODES.has(code)) return true;

  const message = extractErrorMessage(err);
  if (message && isNetworkErrorMessage(message)) return true;

  const cause = (err as { cause?: unknown }).cause;
  if (cause && isAuthUnavailableCause(cause)) return true;

  return false;
};

export function isAuthUnavailableError(err: unknown): boolean {
  return err instanceof AuthUnavailableError;
}

export function isUnauthenticatedError(err: unknown): boolean {
  if (isAuthUnavailableCause(err)) {
    throw err instanceof AuthUnavailableError ? err : new AuthUnavailableError(err);
  }
  return err instanceof UnauthenticatedError || (err instanceof Error && err.message === "UNAUTHENTICATED");
}

/**
 * Garante que existe um utilizador autenticado.
 * - Se não houver sessão, lança um erro "UNAUTHENTICATED".
 * - Se houver, devolve o user do Supabase.
 */
export async function ensureAuthenticated(
  supabase: SupabaseClient
): Promise<User> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      if (isAuthUnavailableCause(error)) {
        throw new AuthUnavailableError(error);
      }
      throw new UnauthenticatedError();
    }

    if (!user) {
      throw new UnauthenticatedError();
    }

    return user;
  } catch (err) {
    if (err instanceof UnauthenticatedError || err instanceof AuthUnavailableError) {
      throw err;
    }
    if (isAuthUnavailableCause(err)) {
      throw new AuthUnavailableError(err);
    }
    throw err;
  }
}

export function isOrganization(
  profile:
    | { roles?: string[] | null }
    | null
    | undefined
): boolean {
  if (!profile || !profile.roles) return false;
  return profile.roles.includes("organization");
}

export function assertOrganization(
  user: User | null | undefined,
  profile:
    | { id: string; roles?: string[] | null }
    | null
    | undefined,
  _organization?: { userId: string } | null
): void {
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }

  if (!isOrganization(profile)) {
    throw new Error("NOT_ORGANIZATION");
  }
}
