import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { checkUsernameAvailability } from "@/lib/globalUsernames";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { isAppRequest, isSameOrigin } from "@/lib/auth/requestValidation";
import { rateLimit } from "@/lib/auth/rateLimit";
import { enforceMobileVersionGate } from "@/lib/http/mobileVersionGate";

function isMobileClientRequest(req: NextRequest) {
  const platform =
    req.headers.get("x-client-platform") ||
    req.headers.get("x-app-platform") ||
    req.headers.get("x-platform");
  const normalized = platform?.trim().toLowerCase() ?? "";
  return normalized === "mobile" || normalized === "ios" || normalized === "android";
}

async function _POST(req: NextRequest) {
  try {
    const isMobileClient = isMobileClientRequest(req);
    if (!isAppRequest(req) && !isSameOrigin(req, { allowMissing: isMobileClient })) {
      return jsonWrap(
        { ok: false, errorCode: "FORBIDDEN", message: "Pedido não autorizado." },
        { status: 403 },
      );
    }
    const mobileGate = enforceMobileVersionGate(req);
    if (mobileGate) return mobileGate;

    let ipLimiter;
    try {
      ipLimiter = await rateLimit(req, {
        windowMs: 5 * 60 * 1000,
        max: 180,
        keyPrefix: "profiles:check-username:ip",
        requireDistributed: true,
      });
    } catch (err) {
      throw err;
    }
    if (!ipLimiter.allowed) {
      return jsonWrap(
        {
          ok: false,
          errorCode: "RATE_LIMITED",
          message: "Muitas tentativas. Tenta novamente dentro de alguns minutos.",
          retryable: true,
        },
        { status: 429, headers: { "Retry-After": String(ipLimiter.retryAfter) } },
      );
    }

    const body = (await req.json().catch(() => null)) as { username?: string } | null;
    if (!body || typeof body.username !== "string") {
      return jsonWrap({ ok: false, error: "username é obrigatório" }, { status: 400 });
    }
    const usernameForLimiter = body.username.trim().toLowerCase();

    let limiter;
    try {
      limiter = await rateLimit(req, {
        windowMs: 5 * 60 * 1000,
        max: 40,
        keyPrefix: "profiles:check-username",
        identifier: usernameForLimiter,
        requireDistributed: true,
      });
    } catch (err) {
      throw err;
    }
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

    let allowReservedForEmail: string | null = null;
    try {
      const supabase = await createSupabaseServer();
      const { data } = await supabase.auth.getUser();
      allowReservedForEmail = data?.user?.email ?? null;
    } catch {}

    const result = await checkUsernameAvailability(body.username, undefined, { allowReservedForEmail });
    if (!result.ok) {
      return jsonWrap({ ok: false, error: result.error }, { status: 400 });
    }

    return jsonWrap({
      ok: true,
      available: result.available,
      username: result.username,
      ...(result.ok && result.available === false && "reason" in result ? { reason: result.reason } : {}),
    });
  } catch (error) {
    console.error("[api/profiles/check-username][POST]", error);
    return jsonWrap({ ok: false, error: "Erro ao verificar username" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
