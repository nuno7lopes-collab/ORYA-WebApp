

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeAndValidateUsername } from "@/lib/globalUsernames";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { username?: string } | null;
    if (!body || typeof body.username !== "string") {
      return NextResponse.json({ ok: false, error: "username é obrigatório" }, { status: 400 });
    }

    const validated = normalizeAndValidateUsername(body.username);
    if (!validated.ok) {
      return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
    }

    const existing = await prisma.globalUsername.findUnique({
      where: { username: validated.username },
      select: { ownerType: true, ownerId: true },
    });

    const available = !existing;
    return NextResponse.json({ ok: true, available, username: validated.username });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Erro ao verificar username" }, { status: 500 });
  }
}
