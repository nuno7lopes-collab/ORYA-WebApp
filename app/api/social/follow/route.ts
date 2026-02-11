export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { notifyNewFollower } from "@/domain/notifications/producer";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { NotificationType } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { targetUserId?: string } | null;
  const targetUserId = body?.targetUserId?.trim();
  if (!targetUserId || targetUserId === user.id) {
    return jsonWrap({ ok: false, error: "INVALID_TARGET" }, { status: 400 });
  }

  const targetProfile = await prisma.profile.findUnique({
    where: { id: targetUserId },
    select: { id: true, visibility: true, isDeleted: true },
  });
  if (!targetProfile || targetProfile.isDeleted) {
    return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const requiresApproval = targetProfile.visibility === "PRIVATE";
  if (requiresApproval) {
    const existingFollow = await prisma.follows.findFirst({
      where: { follower_id: user.id, following_id: targetUserId },
      select: { id: true },
    });
    if (existingFollow) {
      return jsonWrap({ ok: true, status: "FOLLOWING" }, { status: 200 });
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

      void (async () => {
        try {
          if (!(await shouldNotify(targetUserId, NotificationType.FOLLOW_REQUEST))) return;
          await createNotification({
            userId: targetUserId,
            type: NotificationType.FOLLOW_REQUEST,
            title: "Novo pedido para seguir",
            body: "Tens um novo pedido para seguir o teu perfil.",
            fromUserId: user.id,
          });
        } catch (err) {
          console.warn("[social/follow][request-notify]", err);
        }
      })();
    }

    return jsonWrap({ ok: true, status: "REQUESTED" }, { status: 200 });
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

  void notifyNewFollower({ targetUserId, followerUserId: user.id }).catch((err) => {
    console.warn("[social/follow][notify-new-follower]", err);
  });

  return jsonWrap({ ok: true, status: "FOLLOWING" }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
