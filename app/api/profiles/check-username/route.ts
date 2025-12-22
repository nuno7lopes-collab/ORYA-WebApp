

import { NextRequest, NextResponse } from "next/server";
import { checkUsernameAvailability } from "@/lib/globalUsernames";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { username?: string } | null;
    if (!body || typeof body.username !== "string") {
      return NextResponse.json({ ok: false, error: "username é obrigatório" }, { status: 400 });
    }

    const result = await checkUsernameAvailability(body.username);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, available: result.available, username: result.username });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Erro ao verificar username" }, { status: 500 });
  }
}
