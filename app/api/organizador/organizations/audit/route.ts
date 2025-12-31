import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { OrganizerMemberRole } from "@prisma/client";

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

    const url = new URL(req.url);
    const organizerId = Number(url.searchParams.get("organizerId"));
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

    if (!organizerId || Number.isNaN(organizerId)) {
      return NextResponse.json({ ok: false, error: "INVALID_ORGANIZER" }, { status: 400 });
    }

    const membership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId, userId: user.id } },
    });
    const allowedRoles: OrganizerMemberRole[] = [
      OrganizerMemberRole.OWNER,
      OrganizerMemberRole.CO_OWNER,
      OrganizerMemberRole.ADMIN,
    ];
    if (!membership || !allowedRoles.includes(membership.role)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const auditModel = (prisma as any).organizationAuditLog;
    const logs = auditModel?.findMany
      ? await auditModel.findMany({
          where: { organizerId },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : [];

    return NextResponse.json({ ok: true, items: logs }, { status: 200 });
  } catch (err) {
    console.error("[organizador/audit]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
