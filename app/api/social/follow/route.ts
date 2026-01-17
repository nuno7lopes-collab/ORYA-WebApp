export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { notifyNewFollower } from "@/domain/notifications/producer";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { NotificationType } from "@prisma/client";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { targetUserId?: string } | null;
  const targetUserId = body?.targetUserId?.trim();
  if (!targetUserId || targetUserId === user.id) {
    return NextResponse.json({ ok: false, error: "INVALID_TARGET" }, { status: 400 });
  }

  const targetProfile = await prisma.profile.findUnique({
    where: { id: targetUserId },
    select: { id: true, visibility: true, isDeleted: true },
  });
  if (!targetProfile || targetProfile.isDeleted) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const isPrivate = targetProfile.visibility !== "PUBLIC";
  if (isPrivate) {
    const existingFollow = await prisma.follows.findFirst({
      where: { follower_id: user.id, following_id: targetUserId },
      select: { id: true },
    });
    if (existingFollow) {
      return NextResponse.json({ ok: true, status: "FOLLOWING" }, { status: 200 });
    }

    const existingRequest = await prisma.follow_requests.findFirst({
      where: { requester_id: user.id, target_id: targetUserId },
      select: { id: true },
    });
    if (!existingRequest) {
      await prisma.follow_requests.create({
        data: {
          requester_id: user.id,
          target_id: targetUserId,
        },
      });

      if (await shouldNotify(targetUserId, NotificationType.FOLLOW_REQUEST)) {
        await createNotification({
          userId: targetUserId,
          type: NotificationType.FOLLOW_REQUEST,
          title: "Novo pedido para seguir",
          body: "Tens um novo pedido para seguir o teu perfil.",
          fromUserId: user.id,
        });
      }
    }

    return NextResponse.json({ ok: true, status: "REQUESTED" }, { status: 200 });
  }

  await prisma.follows.upsert({
    where: {
      follower_id_following_id: {
        follower_id: user.id,
        following_id: targetUserId,
      },
    },
    create: {
      follower_id: user.id,
      following_id: targetUserId,
    },
    update: {},
  });

  await prisma.follow_requests.deleteMany({
    where: { requester_id: user.id, target_id: targetUserId },
  });

  await notifyNewFollower({ targetUserId, followerUserId: user.id });

  return NextResponse.json({ ok: true, status: "FOLLOWING" }, { status: 200 });
}
