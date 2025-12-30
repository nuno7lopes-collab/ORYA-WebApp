export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  const limitRaw = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 50) : 30;

  if (!userId) {
    return NextResponse.json({ ok: false, error: "INVALID_TARGET" }, { status: 400 });
  }

  const rows = await prisma.follows.findMany({
    where: { follower_id: userId },
    select: {
      following_id: true,
      profiles_follows_following_idToprofiles: {
        select: { username: true, fullName: true, avatarUrl: true },
      },
    },
    take: limit,
    orderBy: { id: "desc" },
  });

  const items = rows
    .map((r) => ({
      userId: r.following_id,
      username: r.profiles_follows_following_idToprofiles?.username ?? null,
      fullName: r.profiles_follows_following_idToprofiles?.fullName ?? null,
      avatarUrl: r.profiles_follows_following_idToprofiles?.avatarUrl ?? null,
    }))
    .filter((r) => r.userId);

  return NextResponse.json({ ok: true, items }, { status: 200 });
}
