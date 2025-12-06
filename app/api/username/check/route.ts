import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeAndValidateUsername } from "@/lib/globalUsernames";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const usernameParam = searchParams.get("username") ?? "";

  const validated = normalizeAndValidateUsername(usernameParam);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  const existing = await prisma.globalUsername.findUnique({
    where: { username: validated.username },
    select: { ownerType: true, ownerId: true },
  });

  return NextResponse.json(
    {
      ok: true,
      username: validated.username,
      available: !existing,
      takenBy: existing ?? null,
    },
    { status: 200 },
  );
}
