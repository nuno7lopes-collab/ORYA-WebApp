import "server-only";

import type { User } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabaseServer";
import {
  AuthUnavailableError,
  EmailNotVerifiedError,
  UnauthenticatedError,
  ensureAuthenticated,
} from "@/lib/security";

export type AuthUserPolicy = "required_verified" | "required_unverified_ok" | "optional_verified";

type GetUserWithPolicyOptions = {
  supabaseOverride?: Awaited<ReturnType<typeof createSupabaseServer>>;
};

type GetUserWithPolicyError = null;

export type GetUserWithPolicyResult = {
  data: { user: User | null };
  error: GetUserWithPolicyError;
};

function anonymousResult(): GetUserWithPolicyResult {
  return {
    data: { user: null },
    error: null,
  };
}

export async function getUserWithPolicy(
  policy: AuthUserPolicy,
  options?: GetUserWithPolicyOptions,
): Promise<GetUserWithPolicyResult> {
  const supabase = options?.supabaseOverride ?? (await createSupabaseServer());

  if (policy === "required_verified") {
    try {
      const user = await ensureAuthenticated(supabase, { requireVerifiedEmail: true });
      return {
        data: { user },
        error: null,
      };
    } catch (err) {
      if (err instanceof UnauthenticatedError) return anonymousResult();
      if (err instanceof EmailNotVerifiedError || err instanceof AuthUnavailableError) throw err;
      throw err;
    }
  }

  if (policy === "required_unverified_ok") {
    try {
      const user = await ensureAuthenticated(supabase, { requireVerifiedEmail: false });
      return {
        data: { user },
        error: null,
      };
    } catch (err) {
      if (err instanceof UnauthenticatedError) return anonymousResult();
      if (err instanceof AuthUnavailableError) throw err;
      throw err;
    }
  }

  try {
    const user = await ensureAuthenticated(supabase, { requireVerifiedEmail: true });
    return {
      data: { user },
      error: null,
    };
  } catch (err) {
    if (err instanceof UnauthenticatedError) return anonymousResult();
    if (err instanceof EmailNotVerifiedError || err instanceof AuthUnavailableError) throw err;
    throw err;
  }
}
