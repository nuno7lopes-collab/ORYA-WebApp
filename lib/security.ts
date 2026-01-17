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

export function isUnauthenticatedError(err: unknown): boolean {
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
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new UnauthenticatedError();
  }

  return user;
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
