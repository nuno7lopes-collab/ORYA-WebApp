import "server-only";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { AuthUnavailableError, EmailNotVerifiedError, UnauthenticatedError, ensureAuthenticated } from "@/lib/security";

export type AuthRequiredCode = "UNAUTHENTICATED" | "EMAIL_NOT_VERIFIED" | "AUTH_UNAVAILABLE";

export class AuthRequiredError extends Error {
  code: AuthRequiredCode;
  status: number;

  constructor(code: AuthRequiredCode = "UNAUTHENTICATED", status?: number, message?: string) {
    super(message ?? code);
    this.name = "AuthRequiredError";
    this.code = code;
    this.status = status ?? (code === "EMAIL_NOT_VERIFIED" ? 403 : code === "AUTH_UNAVAILABLE" ? 503 : 401);
  }
}

/**
 * Obtém o utilizador autenticado (server-side).
 * Lança AuthRequiredError se não existir sessão válida.
 */
export async function requireUser(options?: { requireVerifiedEmail?: boolean }) {
  const supabase = await createSupabaseServer();

  try {
    return await ensureAuthenticated(supabase, {
      requireVerifiedEmail: options?.requireVerifiedEmail ?? true,
    });
  } catch (err) {
    if (err instanceof EmailNotVerifiedError) {
      throw new AuthRequiredError("EMAIL_NOT_VERIFIED", 403);
    }
    if (err instanceof UnauthenticatedError) {
      throw new AuthRequiredError("UNAUTHENTICATED", 401);
    }
    if (err instanceof AuthUnavailableError) {
      throw new AuthRequiredError("AUTH_UNAVAILABLE", 503);
    }
    throw err;
  }
}
