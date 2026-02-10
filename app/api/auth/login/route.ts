import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isSameOriginOrApp } from "@/lib/auth/requestValidation";
import { rateLimit } from "@/lib/auth/rateLimit";
import { getRequestContext } from "@/lib/http/requestContext";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { normalizeUsernameInput } from "@/lib/username";
import { resolveUsernameOwner } from "@/lib/username/resolveUsernameOwner";

function isUnconfirmedError(err: unknown) {
  if (!err) return false;
  const anyErr = err as { message?: string; error_description?: string };
  const msg = (anyErr.message || anyErr.error_description || "").toLowerCase();
  return (
    msg.includes("not confirmed") ||
    msg.includes("confirm your email") ||
    msg.includes("email_not_confirmed")
  );
}

async function _POST(req: NextRequest) {
  if (!isSameOriginOrApp(req)) {
    return jsonWrap(
      { ok: false, errorCode: "FORBIDDEN", message: "Pedido não autorizado." },
      { status: 403 }
    );
  }

  const ctx = getRequestContext(req);
  const body = (await req.json().catch(() => null)) as
    | { identifier?: string; password?: string }
    | null;
  const identifierRaw = body?.identifier ?? "";
  const password = body?.password ?? "";
  const identifier = identifierRaw.trim();

  const limiter = await rateLimit(req, {
    windowMs: 5 * 60 * 1000,
    max: 10,
    keyPrefix: "auth:login",
    identifier,
  });
  if (!limiter.allowed) {
    return jsonWrap(
      {
        ok: false,
        errorCode: "RATE_LIMITED",
        message: "Muitas tentativas. Tenta novamente dentro de alguns minutos.",
        retryable: true,
      },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } }
    );
  }

  if (!identifier || !password) {
    return jsonWrap(
      {
        ok: false,
        errorCode: "MISSING_CREDENTIALS",
        message: "Preenche o email/username e a password.",
      },
      { status: 400 }
    );
  }

  try {
    let email = identifier.toLowerCase();
    if (!email.includes("@")) {
      const normalizedUsername = normalizeUsernameInput(identifier);
      if (!normalizedUsername) {
        return jsonWrap(
          {
            ok: false,
            errorCode: "INVALID_CREDENTIALS",
            message: "Credenciais inválidas.",
          },
          { status: 401 }
        );
      }

      const resolved = await resolveUsernameOwner(normalizedUsername, {
        expectedOwnerType: "user",
        includeDeletedUser: false,
        requireActiveOrganization: false,
        backfillGlobalUsername: true,
      });
      if (!resolved || resolved.ownerType !== "user") {
        return jsonWrap(
          {
            ok: false,
            errorCode: "INVALID_CREDENTIALS",
            message: "Credenciais inválidas.",
          },
          { status: 401 }
        );
      }

      const { data, error } = await supabaseAdmin.auth.admin.getUserById(
        resolved.ownerId
      );
      if (error || !data?.user?.email) {
        return jsonWrap(
          {
            ok: false,
            errorCode: "INVALID_CREDENTIALS",
            message: "Credenciais inválidas.",
          },
          { status: 401 }
        );
      }
      email = data.user.email.toLowerCase();
    }

    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.session) {
      if (isUnconfirmedError(error)) {
        return jsonWrap(
          {
            ok: false,
            errorCode: "EMAIL_NOT_CONFIRMED",
            message: "Email ainda não confirmado.",
          },
          { status: 401 }
        );
      }
      return jsonWrap(
        {
          ok: false,
          errorCode: "INVALID_CREDENTIALS",
          message: "Credenciais inválidas.",
        },
        { status: 401 }
      );
    }

    return jsonWrap({
      ok: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
  } catch (err) {
    console.error("[auth/login] error:", {
      err,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      orgId: ctx.orgId,
    });
    return jsonWrap(
      { ok: false, errorCode: "SERVER_ERROR", message: "Erro inesperado no servidor." },
      { status: 500 }
    );
  }
}
export const POST = withApiEnvelope(_POST);
