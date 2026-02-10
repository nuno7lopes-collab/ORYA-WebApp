import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { isAppRequest, isSameOrigin } from "@/lib/auth/requestValidation";
import { rateLimit } from "@/lib/auth/rateLimit";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

/**
 * Endpoint simples para verificar se um email está bloqueado por conta PENDING_DELETE.
 * GET /api/auth/check-email?email=...
 */
async function _GET(req: NextRequest) {
  try {
    if (!isAppRequest(req) && !isSameOrigin(req, { allowMissing: true })) {
      return jsonWrap(
        { ok: false, errorCode: "FORBIDDEN", message: "Pedido não autorizado." },
        { status: 403 }
      );
    }

    const email = req.nextUrl.searchParams.get("email");
    if (!email || !email.includes("@")) {
      return jsonWrap(
        { ok: false, errorCode: "INVALID_EMAIL", message: "Email inválido." },
        { status: 400 }
      );
    }
    const normalized = email.trim().toLowerCase();

    const limiter = await rateLimit(req, {
      windowMs: 5 * 60 * 1000,
      max: 10,
      keyPrefix: "auth:check-email",
      identifier: normalized,
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
    return jsonWrap(
      {
        ok: true,
        blocked: false,
        message: "Se existir conta, receberás instruções.",
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[auth/check-email] erro", err);
    return jsonWrap(
      { ok: false, errorCode: "INTERNAL_ERROR", message: "Erro inesperado ao verificar email." },
      { status: 500 }
    );
  }
}
export const GET = withApiEnvelope(_GET);

/**
 * Endpoint para verificar se um email já existe.
 * POST /api/auth/check-email { email }
 */
async function _POST(req: NextRequest) {
  try {
    if (!isAppRequest(req) && !isSameOrigin(req, { allowMissing: true })) {
      return jsonWrap(
        { ok: false, errorCode: "FORBIDDEN", message: "Pedido não autorizado." },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => null)) as { email?: string } | null;
    const email = body?.email;
    if (!email || !email.includes("@")) {
      return jsonWrap(
        { ok: false, errorCode: "INVALID_EMAIL", message: "Email inválido." },
        { status: 400 }
      );
    }
    const normalized = email.trim().toLowerCase();

    const limiter = await rateLimit(req, {
      windowMs: 5 * 60 * 1000,
      max: 15,
      keyPrefix: "auth:check-email-exists",
      identifier: normalized,
    });
    if (!limiter.allowed) {
      return jsonWrap(
        {
          ok: false,
          errorCode: "RATE_LIMITED",
          message: "Muitas tentativas. Tenta novamente dentro de alguns minutos.",
          retryable: true,
        },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } },
      );
    }

    return jsonWrap(
      {
        ok: true,
        message: "Se existir conta, receberás instruções.",
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[auth/check-email] erro", err);
    return jsonWrap(
      { ok: false, errorCode: "INTERNAL_ERROR", message: "Erro inesperado ao verificar email." },
      { status: 500 }
    );
  }
}

export const POST = withApiEnvelope(_POST);
