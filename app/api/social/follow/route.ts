export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { NotificationType } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

    const body = (await req.json().catch(() => null)) as { targetUserId?: string } | null;
    const targetUserId = body?.targetUserId?.trim();
    if (!targetUserId) return NextResponse.json({ ok: false, error: "INVALID_TARGET" }, { status: 400 });
    if (targetUserId === user.id) return NextResponse.json({ ok: false, error: "CANNOT_FOLLOW_SELF" }, { status: 400 });

    const followerProfile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { username: true, fullName: true, avatarUrl: true },
    });

    let created = false;
    try {
      await prisma.follows.create({
        data: {
          follower_id: user.id,
          following_id: targetUserId,
        },
      });
      created = true;
    } catch (err: any) {
      // Ignorar duplicados; para outros erros, registar para debugging
      if (!(err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002")) {
        console.warn("[follow] erro ao criar follow", err);
      }
    }

    if (created && (await shouldNotify(targetUserId, NotificationType.FOLLOWED_YOU))) {
      await createNotification({
        userId: targetUserId,
        fromUserId: user.id,
        type: NotificationType.FOLLOWED_YOU,
        title: "Novo seguidor",
        body: `${followerProfile?.username || followerProfile?.fullName || "Alguém"} começou a seguir-te.`,
        payload: {
          actor: {
            id: user.id,
            username: followerProfile?.username,
            fullName: followerProfile?.fullName,
            avatarUrl: followerProfile?.avatarUrl,
          },
        },
      }).catch((err) => console.warn("[notification][follow] falhou", err));
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[social/follow]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
