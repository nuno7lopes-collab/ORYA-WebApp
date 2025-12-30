import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { OrganizerMemberRole } from "@prisma/client";
import { resolveUserIdentifier } from "@/lib/userResolver";
import { canManageMembers, isOrgOwner } from "@/lib/organizerPermissions";
import { ensureUserIsOrganizer, setSoleOwner } from "@/lib/organizerRoles";
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

    const body = await req.json().catch(() => null);
    const organizerId = Number(body?.organizerId);
    const targetIdentifier = typeof body?.userId === "string" ? body.userId.trim() : null;
    const roleRaw = typeof body?.role === "string" ? body.role.toUpperCase() : null;

    if (!organizerId || Number.isNaN(organizerId) || !targetIdentifier || !roleRaw) {
      return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }
    if (!Object.values(OrganizerMemberRole).includes(roleRaw as OrganizerMemberRole)) {
      return NextResponse.json({ ok: false, error: "INVALID_ROLE" }, { status: 400 });
    }

    const callerMembership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId, userId: user.id } },
    });
    if (!callerMembership) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    const callerRole = callerMembership.role as OrganizerMemberRole | null;

    const resolved = await resolveUserIdentifier(targetIdentifier);
    if (!resolved) {
      return NextResponse.json({ ok: false, error: "Utilizador não encontrado." }, { status: 404 });
    }

    const targetUserId = resolved.userId;
    const role = roleRaw as OrganizerMemberRole;

    const targetMembership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId, userId: targetUserId } },
    });

    if (!canManageMembers(callerRole, targetMembership?.role ?? null, role)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    if (role === "OWNER" && !isOrgOwner(callerRole)) {
      return NextResponse.json({ ok: false, error: "ONLY_OWNER_CAN_SET_OWNER" }, { status: 403 });
    }

    // Se for a remover o último owner, bloquear
    if (role !== "OWNER" && targetMembership?.role === "OWNER") {
      const otherOwners = await prisma.organizerMember.count({
        where: { organizerId, role: "OWNER", userId: { not: targetUserId } },
      });
      if (otherOwners === 0) {
        return NextResponse.json(
          { ok: false, error: "Não podes remover o último Owner." },
          { status: 400 },
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      if (role === "OWNER") {
        await setSoleOwner(tx, organizerId, targetUserId, user.id);
      } else {
        await tx.organizerMember.upsert({
          where: { organizerId_userId: { organizerId, userId: targetUserId } },
          update: { role },
          create: { organizerId, userId: targetUserId, role, invitedByUserId: user.id },
        });
      }

      await ensureUserIsOrganizer(tx, targetUserId);
    });

    if (role === "OWNER") {
      await recordOrganizationAuditSafe({
        organizerId,
        actorUserId: user.id,
        action: "OWNER_PROMOTED",
        toUserId: targetUserId,
        metadata: { via: "members.upsert" },
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organizador/members/upsert]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
