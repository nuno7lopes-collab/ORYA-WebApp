export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const targetId = req.nextUrl.searchParams.get("userId");
  if (!targetId) return NextResponse.json({ ok: false, error: "INVALID_TARGET" }, { status: 400 });

  const [isFollowing, isFollower] = await Promise.all([
    prisma.follows.findFirst({ where: { follower_id: user.id, following_id: targetId }, select: { id: true } }),
    prisma.follows.findFirst({ where: { follower_id: targetId, following_id: user.id }, select: { id: true } }),
  ]);

  return NextResponse.json(
    {
      ok: true,
      isFollowing: Boolean(isFollowing),
      isFollower: Boolean(isFollower),
    },
    { status: 200 },
  );
}
