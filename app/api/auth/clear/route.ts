import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { cookies } from "next/headers";
import { isSameOrigin } from "@/lib/auth/requestValidation";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

// Utilitário para limpar cookies locais (incluindo os sb- do Supabase) quando ficam corrompidos.
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

    for (const c of all) {
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

    return jsonWrap({ ok: true, cleared: all.map((c) => c.name) });
  } catch (err) {
    console.error("[api/auth/clear] erro inesperado:", err);
    return jsonWrap(
      { ok: false, errorCode: "CLEAR_FAILED", message: "Não foi possível limpar a sessão." },
      { status: 500 }
    );
  }
}
export const POST = withApiEnvelope(_POST);
