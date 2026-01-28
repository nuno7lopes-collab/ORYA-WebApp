import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { cookies } from "next/headers";
import { isSameOriginOrApp } from "@/lib/auth/requestValidation";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest) {
  try {
    if (!isSameOriginOrApp(req)) {
      return jsonWrap({ success: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[auth/logout] supabase signOut error:", error);
      return jsonWrap({ success: false, error: error.message }, { status: 500 });
    }

    const res = jsonWrap({ success: true }) as NextResponse;

    // Garantir limpeza de todos os cookies sb-*
    try {
      const store = await cookies();
      store
        .getAll()
        .filter((c) => c.name.startsWith("sb-"))
        .forEach((c) => {
          res.cookies.set({
            name: c.name,
            value: "",
            maxAge: 0,
          });
        });
    } catch {
      /* noop */
    }

    return res;
  } catch (err) {
    console.error("[auth/logout] unexpected error:", err);
    return jsonWrap({ success: false, error: "Erro ao terminar sessão." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
