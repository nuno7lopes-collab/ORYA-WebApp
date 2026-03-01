export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { NotificationType } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { targetUserId?: string } | null;
  const targetUserId = body?.targetUserId?.trim();
  if (!targetUserId || targetUserId === user.id) {
    return jsonWrap({ ok: false, error: "INVALID_TARGET" }, { status: 400 });
  }

  const targetProfile = await prisma.profile.findUnique({
    where: { id: targetUserId },
    select: { id: true, isDeleted: true },
  });
  if (!targetProfile || targetProfile.isDeleted) {
    return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const [viewerToTarget, targetToViewer] = await Promise.all([
    prisma.follows.findFirst({
      where: { follower_id: user.id, following_id: targetUserId },
      select: { id: true },
    }),
    prisma.follows.findFirst({
      where: { follower_id: targetUserId, following_id: user.id },
      select: { id: true },
    }),
  ]);

  if (viewerToTarget && targetToViewer) {
    return jsonWrap({ ok: true, status: "FOLLOWING", isFriend: true }, { status: 200 });
  }

  if (targetToViewer && !viewerToTarget) {
    await prisma.$transaction(async (tx) => {
      await tx.follows.upsert({
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

      await tx.follow_requests.deleteMany({
        where: {
          OR: [
            { requester_id: targetUserId, target_id: user.id },
            { requester_id: user.id, target_id: targetUserId },
          ],
        },
      });

      await tx.notification.deleteMany({
        where: {
          OR: [
            { userId: user.id, type: "FOLLOW_REQUEST", fromUserId: targetUserId },
            { userId: targetUserId, type: "FOLLOW_REQUEST", fromUserId: user.id },
          ],
        },
      });
    });

    void (async () => {
      try {
        if (!(await shouldNotify(targetUserId, NotificationType.FOLLOW_ACCEPT))) return;
        await createNotification({
          userId: targetUserId,
          type: NotificationType.FOLLOW_ACCEPT,
          title: "Pedido aceite",
          body: "Agora são amigos na ORYA.",
          fromUserId: user.id,
        });
      } catch (err) {
        console.warn("[social/follow][accept-notify]", err);
      }
    })();

    return jsonWrap({ ok: true, status: "FOLLOWING", isFriend: true }, { status: 200 });
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

    await prisma.follows.deleteMany({
      where: {
        follower_id: user.id,
        following_id: targetUserId,
      },
    });

    void (async () => {
      try {
        if (!(await shouldNotify(targetUserId, NotificationType.FOLLOW_REQUEST))) return;
        await createNotification({
          userId: targetUserId,
          type: NotificationType.FOLLOW_REQUEST,
          title: "Novo pedido de amizade",
          body: "Tens um novo pedido de amizade.",
          fromUserId: user.id,
        });
      } catch (err) {
        console.warn("[social/follow][request-notify]", err);
      }
    })();
  }

  return jsonWrap({ ok: true, status: "REQUESTED", isFriend: false }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
