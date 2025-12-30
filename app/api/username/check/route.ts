import { NextRequest, NextResponse } from "next/server";
import { checkUsernameAvailability } from "@/lib/globalUsernames";

export async function GET(req: NextRequest) {
  try {
    const username = req.nextUrl.searchParams.get("username");
    if (!username) {
      return NextResponse.json({ ok: false, error: "username é obrigatório" }, { status: 400 });
    }

    const result = await checkUsernameAvailability(username);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, available: result.available, username: result.username }, { status: 200 });
  } catch (err) {
    console.error("[api/username/check][GET]", err);
    return NextResponse.json({ ok: false, error: "Erro ao verificar username" }, { status: 500 });
  }
}
