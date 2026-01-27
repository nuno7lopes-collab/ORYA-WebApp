import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";

export async function GET(req: NextRequest) {
  if (!process.env.ORYA_CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "MISSING_SECRET" }, { status: 500 });
  }
  if (!requireInternalSecret(req)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);
  const orgId = Number(url.searchParams.get("organizationId"));
  const groupId = Number(url.searchParams.get("groupId"));
  const action = url.searchParams.get("action");
  const actorUserId = url.searchParams.get("actorUserId");

  const where: any = {};
  if (Number.isFinite(orgId)) where.organizationId = orgId;
  if (Number.isFinite(groupId)) where.groupId = groupId;
  if (action) where.action = action;
  if (actorUserId) where.actorUserId = actorUserId;

  const items = await prisma.organizationAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ ok: true, items }, { status: 200 });
}
