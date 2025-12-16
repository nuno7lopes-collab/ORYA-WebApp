export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { notifyNewFollower } from "@/domain/notifications/producer";

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

  await notifyNewFollower({ targetUserId, followerUserId: user.id });

  return NextResponse.json({ ok: true }, { status: 200 });
}
