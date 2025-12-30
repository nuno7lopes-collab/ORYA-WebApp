import "server-only";
import { createSupabaseServer } from "@/lib/supabaseServer";

export class AuthRequiredError extends Error {
  code = "AUTH_REQUIRED";
  status = 401;
  constructor(message = "Autenticação obrigatória") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

/**
 * Obtém o utilizador autenticado (server-side).
 * Lança AuthRequiredError se não existir sessão válida.
 */
export async function requireUser() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    throw new AuthRequiredError();
  }

  return data.user;
}
