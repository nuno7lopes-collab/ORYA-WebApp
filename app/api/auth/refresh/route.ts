// app/api/auth/refresh/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isSameOriginOrApp } from "@/lib/auth/requestValidation";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

/**
 * Sincroniza a sessão do supabase (tokens vindos do browser) para cookies HttpOnly.
 * Espera body JSON com { access_token, refresh_token }.
 */
async function _POST(req: NextRequest) {
  try {
    if (!isSameOriginOrApp(req)) {
      return jsonWrap(
        { ok: false, errorCode: "FORBIDDEN", message: "Pedido não autorizado." },
        { status: 403 }
      );
    }

    const supabase = await createSupabaseServer();
    const body = (await req.json().catch(() => null)) as
      | { access_token?: string; refresh_token?: string }
      | null;

    const access_token = body?.access_token ?? null;
    const refresh_token = body?.refresh_token ?? null;

    if (!access_token || !refresh_token) {
      return jsonWrap(
        { ok: false, errorCode: "MISSING_TOKENS", message: "Tokens em falta." },
        { status: 400 },
      );
    }

    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      console.error("[auth/refresh] setSession error:", error);
      return jsonWrap(
        {
          ok: false,
          errorCode: "INVALID_SESSION",
          message: "Sessão inválida.",
          details: { reason: error.message },
        },
        { status: 400 },
      );
    }

    return jsonWrap({ ok: true });
  } catch (err) {
    console.error("[auth/refresh] unexpected error:", err);
    return jsonWrap(
      { ok: false, errorCode: "SERVER_ERROR", message: "Erro inesperado no servidor." },
      { status: 500 },
    );
  }
}
export const POST = withApiEnvelope(_POST);
