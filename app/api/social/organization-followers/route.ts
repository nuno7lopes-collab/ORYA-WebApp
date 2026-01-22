export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseOrganizationId } from "@/lib/organizationId";
import { listOrganizationFollowers } from "@/domain/social/follows";

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

  const items = await listOrganizationFollowers({ organizationId, limit });

  return NextResponse.json({ ok: true, items }, { status: 200 });
}
