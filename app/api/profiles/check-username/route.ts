

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { checkUsernameAvailability } from "@/lib/globalUsernames";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { username?: string } | null;
    if (!body || typeof body.username !== "string") {
      return jsonWrap({ ok: false, error: "username é obrigatório" }, { status: 400 });
    }

    const result = await checkUsernameAvailability(body.username);
    if (!result.ok) {
      return jsonWrap({ ok: false, error: result.error }, { status: 400 });
    }

    return jsonWrap({ ok: true, available: result.available, username: result.username });
  } catch (error) {
    console.error(error);
    return jsonWrap({ ok: false, error: "Erro ao verificar username" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);