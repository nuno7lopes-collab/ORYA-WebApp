import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ ok: true, results: [] }, { status: 200 });
  }

  const normalized = q.startsWith("@") ? q.slice(1) : q;

  try {
    const results = await prisma.profile.findMany({
      where: {
        AND: [
          { isDeleted: false },
          {
            OR: [
              { username: { contains: normalized, mode: "insensitive" } },
              { fullName: { contains: normalized, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 8,
    });

    return NextResponse.json(
      {
        ok: true,
        results: results.map((r) => ({
          id: r.id,
          username: r.username,
          fullName: r.fullName,
          avatarUrl: r.avatarUrl,
        })),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[users/search]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
