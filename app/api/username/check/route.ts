import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { checkUsernameAvailability } from "@/lib/globalUsernames";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isSameOriginOrApp } from "@/lib/auth/requestValidation";
import { isRateLimitBackendUnavailableError, rateLimit } from "@/lib/auth/rateLimit";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  try {
    if (!isSameOriginOrApp(req)) {
      return jsonWrap({ ok: false, error: "Pedido não autorizado." }, { status: 403 });
    }

    let limiter;
    try {
      limiter = await rateLimit(req, {
        windowMs: 5 * 60 * 1000,
        max: 120,
        keyPrefix: "username:check:ip",
        requireDistributed: true,
      });
    } catch (err) {
      if (isRateLimitBackendUnavailableError(err)) {
        return jsonWrap(
          {
            ok: false,
            errorCode: err.code,
            error: "Serviço de proteção temporariamente indisponível.",
          },
          { status: 503 },
        );
      }
      throw err;
    }
    if (!limiter.allowed) {
      return jsonWrap(
        { ok: false, error: "Muitas verificações. Tenta novamente dentro de alguns minutos." },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } },
      );
    }

    const username = req.nextUrl.searchParams.get("username");
    if (!username) {
      return jsonWrap({ ok: false, error: "username é obrigatório" }, { status: 400 });
    }

    const ownerType = req.nextUrl.searchParams.get("ownerType");
    let allowReservedForEmail: string | null = null;
    try {
      const supabase = await createSupabaseServer();
      const { data } = await supabase.auth.getUser();
      if (ownerType !== "organization") {
        allowReservedForEmail = data?.user?.email ?? null;
      }
    } catch {}

    const result = await checkUsernameAvailability(username, undefined, { allowReservedForEmail });
    if (!result.ok) {
      return jsonWrap({ ok: false, error: result.error }, { status: 400 });
    }

    return jsonWrap(
      {
        ok: true,
        available: result.available,
        username: result.username,
        ...(result.ok && result.available === false && "reason" in result ? { reason: result.reason } : {}),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[api/username/check][GET]", err);
    return jsonWrap({ ok: false, error: "Erro ao verificar username" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
