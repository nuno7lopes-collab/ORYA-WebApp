import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { cookies } from "next/headers";
import { isSameOrigin } from "@/lib/auth/requestValidation";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const AUTH_COOKIE_EXACT_ALLOWLIST = new Set(["orya_admin_mfa"]);

function isAuthCookie(name: string) {
  return name.startsWith("sb-") || AUTH_COOKIE_EXACT_ALLOWLIST.has(name);
}

// Limpa apenas cookies de autenticação (allowlist). Nunca remove cookies de contexto/UX.
async function _POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) {
      return jsonWrap(
        { ok: false, errorCode: "FORBIDDEN", message: "Pedido não autorizado." },
        { status: 403 }
      );
    }

    const store = await cookies();
    const all = store.getAll();
    const authCookies = all.filter((c) => isAuthCookie(c.name));

    for (const c of authCookies) {
      try {
        store.set({
          name: c.name,
          value: "",
          path: "/",
          maxAge: 0,
        });
      } catch (err) {
        console.error("[api/auth/clear] erro a limpar cookie", c.name, err);
      }
    }

    return jsonWrap({
      ok: true,
      cleared: authCookies.map((c) => c.name),
      skipped: all.filter((c) => !isAuthCookie(c.name)).map((c) => c.name),
    });
  } catch (err) {
    console.error("[api/auth/clear] erro inesperado:", err);
    return jsonWrap(
      { ok: false, errorCode: "CLEAR_FAILED", message: "Não foi possível limpar a sessão." },
      { status: 500 }
    );
  }
}
export const POST = withApiEnvelope(_POST);
