

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { username?: string } | null;
    if (!body || typeof body.username !== "string") {
      return NextResponse.json({ ok: false, error: "username é obrigatório" }, { status: 400 });
    }
    const usernameRaw = body.username.trim();
    const isValid = /^[A-Za-z]{1,16}$/.test(usernameRaw);
    if (!isValid) {
      return NextResponse.json(
        { ok: false, error: "O username só pode ter letras (até 16 caracteres)." },
        { status: 400 },
      );
    }
    const username = usernameRaw.toLowerCase();
    const existing = await prisma.profile.findFirst({
      where: { username },
      select: { id: true },
    });
    const available = !existing;
    return NextResponse.json({ ok: true, available, username });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Erro ao verificar username" }, { status: 500 });
  }
}
