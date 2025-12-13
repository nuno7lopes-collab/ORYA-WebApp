import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { OrganizerMemberRole } from "@prisma/client";
import { resolveUserIdentifier } from "@/lib/userResolver";
import { getOrgTransferEnabled } from "@/lib/platformSettings";
import { setSoleOwner } from "@/lib/organizerRoles";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const transferEnabled = await getOrgTransferEnabled();
    if (!transferEnabled) {
      return NextResponse.json({ ok: false, error: "ORG_TRANSFER_DISABLED" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const organizerId = Number(body?.organizerId);
    const targetIdentifierRaw = typeof body?.targetUserId === "string" ? body.targetUserId.trim() : null;

    if (!organizerId || Number.isNaN(organizerId) || !targetIdentifierRaw) {
      return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    const resolvedUser = await resolveUserIdentifier(targetIdentifierRaw);
    const targetUserId = resolvedUser?.userId ?? null;
    if (!targetUserId) {
      return NextResponse.json({ ok: false, error: "TARGET_NOT_FOUND" }, { status: 404 });
    }

    // Confirma que o caller é OWNER desta org
    const callerMembership = await prisma.organizerMember.findFirst({
      where: { organizerId, userId: user.id },
    });
    if (!callerMembership || callerMembership.role !== OrganizerMemberRole.OWNER) {
      return NextResponse.json({ ok: false, error: "ONLY_OWNER_CAN_TRANSFER" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await setSoleOwner(tx, organizerId, targetUserId, user.id);
    });

    await recordOrganizationAuditSafe({
      organizerId,
      actorUserId: user.id,
      action: "OWNER_TRANSFER_DIRECT",
      fromUserId: user.id,
      toUserId: targetUserId,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organizador/organizations/transfer]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
