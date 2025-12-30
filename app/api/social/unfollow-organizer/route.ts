export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { organizerId?: number | string } | null;
  const organizerId =
    typeof body?.organizerId === "string" || typeof body?.organizerId === "number"
      ? Number(body.organizerId)
      : NaN;
  if (!Number.isFinite(organizerId)) {
    return NextResponse.json({ ok: false, error: "INVALID_TARGET" }, { status: 400 });
  }

  await prisma.organizer_follows.deleteMany({
    where: { follower_id: user.id, organizer_id: organizerId },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
