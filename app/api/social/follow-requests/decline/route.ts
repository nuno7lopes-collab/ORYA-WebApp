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

  const body = (await req.json().catch(() => null)) as { requestId?: number } | null;
  const requestId = typeof body?.requestId === "number" ? body.requestId : null;
  if (!requestId || !Number.isFinite(requestId)) {
    return NextResponse.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
  }

  const request = await prisma.follow_requests.findFirst({
    where: { id: requestId, target_id: user.id },
    select: { requester_id: true, target_id: true },
  });
  if (!request) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  await prisma.follow_requests.delete({ where: { id: requestId } });
  await prisma.notification.deleteMany({
    where: { userId: request.target_id, type: "FRIEND_REQUEST", fromUserId: request.requester_id },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
