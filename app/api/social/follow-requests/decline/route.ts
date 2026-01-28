export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { requestId?: number } | null;
  const requestId = typeof body?.requestId === "number" ? body.requestId : null;
  if (!requestId || !Number.isFinite(requestId)) {
    return jsonWrap({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
  }

  const request = await prisma.follow_requests.findFirst({
    where: { id: requestId, target_id: user.id },
    select: { requester_id: true, target_id: true },
  });
  if (!request) {
    return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  await prisma.follow_requests.delete({ where: { id: requestId } });
  await prisma.notification.deleteMany({
    where: { userId: request.target_id, type: "FOLLOW_REQUEST", fromUserId: request.requester_id },
  });

  return jsonWrap({ ok: true }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);