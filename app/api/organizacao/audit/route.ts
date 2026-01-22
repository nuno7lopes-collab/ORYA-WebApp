import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { resolveOrganizationIdFromParams, resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { isOrgAdminOrAbove } from "@/lib/organizationPermissions";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const organizationId =
      resolveOrganizationIdFromParams(req.nextUrl.searchParams) ??
      resolveOrganizationIdFromRequest(req);
    if (!organizationId) {
      return NextResponse.json({ ok: false, error: "INVALID_ORGANIZATION_ID" }, { status: 400 });
    }

    const callerMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });

    if (!callerMembership || !isOrgAdminOrAbove(callerMembership.role)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 50);
    const limit = Math.max(5, Math.min(200, Number.isFinite(limitRaw) ? limitRaw : 50));

    const logs = await prisma.organizationAuditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const userIds = new Set<string>();
    logs.forEach((log) => {
      if (log.actorUserId) userIds.add(log.actorUserId);
      if (log.fromUserId) userIds.add(log.fromUserId);
      if (log.toUserId) userIds.add(log.toUserId);
    });

    const profiles = userIds.size
      ? await prisma.profile.findMany({
          where: { id: { in: Array.from(userIds) } },
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        })
      : [];
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

    const items = logs.map((log) => ({
      id: log.id,
      action: log.action,
      metadata: log.metadata ?? null,
      createdAt: log.createdAt,
      actor: log.actorUserId ? profileMap.get(log.actorUserId) ?? { id: log.actorUserId } : null,
      fromUser: log.fromUserId ? profileMap.get(log.fromUserId) ?? { id: log.fromUserId } : null,
      toUser: log.toUserId ? profileMap.get(log.toUserId) ?? { id: log.toUserId } : null,
      ip: log.ip ?? null,
      userAgent: log.userAgent ?? null,
    }));

    return NextResponse.json({ ok: true, items, organizationId }, { status: 200 });
  } catch (err) {
    console.error("[organizacao/audit][GET]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
