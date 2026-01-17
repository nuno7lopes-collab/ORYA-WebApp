export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseOrganizationId } from "@/lib/organizationId";

export async function GET(req: NextRequest) {
  const organizationId = parseOrganizationId(req.nextUrl.searchParams.get("organizationId"));
  const limitRaw = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 50) : 30;

  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "INVALID_TARGET" }, { status: 400 });
  }

  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!organization) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const rows = await prisma.organization_follows.findMany({
    where: { organization_id: organizationId },
    select: {
      follower_id: true,
      profiles_organization_follows_follower_idToprofiles: {
        select: { username: true, fullName: true, avatarUrl: true },
      },
    },
    take: limit,
    orderBy: { id: "desc" },
  });

  const items = rows
    .map((row) => ({
      userId: row.follower_id,
      username: row.profiles_organization_follows_follower_idToprofiles?.username ?? null,
      fullName: row.profiles_organization_follows_follower_idToprofiles?.fullName ?? null,
      avatarUrl: row.profiles_organization_follows_follower_idToprofiles?.avatarUrl ?? null,
    }))
    .filter((item) => item.userId);

  return NextResponse.json({ ok: true, items }, { status: 200 });
}
