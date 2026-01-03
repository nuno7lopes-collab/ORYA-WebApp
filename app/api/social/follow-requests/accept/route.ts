export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { NotificationType } from "@prisma/client";

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

  await prisma.$transaction(async (tx) => {
    await tx.follows.upsert({
      where: {
        follower_id_following_id: {
          follower_id: request.requester_id,
          following_id: request.target_id,
        },
      },
      create: {
        follower_id: request.requester_id,
        following_id: request.target_id,
      },
      update: {},
    });
    await tx.follow_requests.delete({ where: { id: requestId } });
    await tx.notification.deleteMany({
      where: { userId: request.target_id, type: "FRIEND_REQUEST", fromUserId: request.requester_id },
    });
  });

  if (await shouldNotify(request.requester_id, NotificationType.FRIEND_ACCEPT)) {
    await createNotification({
      userId: request.requester_id,
      type: NotificationType.FRIEND_ACCEPT,
      title: "Pedido aceite",
      body: "O teu pedido para seguir foi aceite.",
      fromUserId: user.id,
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
