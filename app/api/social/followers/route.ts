export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeProfileVisibility } from "@/lib/profileVisibility";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ ok: false, error: "INVALID_USER" }, { status: 400 });

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 20), 50);
  const offset = Number(req.nextUrl.searchParams.get("offset") || 0);

  const [items, total] = await Promise.all([
    prisma.follows.findMany({
      where: { following_id: userId },
      include: {
        follower: { select: { id: true, username: true, fullName: true, avatarUrl: true, visibility: true, isDeleted: true } },
      },
      orderBy: { created_at: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.follows.count({ where: { following_id: userId } }),
  ]);

  return NextResponse.json(
    {
      ok: true,
      total,
      items: items
        .map((f) => sanitizeProfileVisibility(f.follower, userId))
        .filter(Boolean),
    },
    { status: 200 },
  );
}
