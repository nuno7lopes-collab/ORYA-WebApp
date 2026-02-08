import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { checkUsernameAvailability } from "@/lib/globalUsernames";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  try {
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
