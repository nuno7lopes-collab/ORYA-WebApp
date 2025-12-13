import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { OrganizerMemberRole } from "@prisma/client";
import { canManageMembers, isOrgOwner } from "@/lib/organizerPermissions";
import { setSoleOwner } from "@/lib/organizerRoles";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";

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
    const organizerIdRaw = url.searchParams.get("organizerId");
    const eventIdRaw = url.searchParams.get("eventId");
    let organizerId = organizerIdRaw ? Number(organizerIdRaw) : null;

    if (!organizerId && eventIdRaw) {
      const eventId = Number(eventIdRaw);
      if (eventId && !Number.isNaN(eventId)) {
        const ev = await prisma.event.findUnique({
          where: { id: eventId },
          select: { organizerId: true },
        });
        organizerId = ev?.organizerId ?? null;
      }
    }

    if (!organizerId || Number.isNaN(organizerId)) {
      return NextResponse.json({ ok: false, error: "INVALID_ORGANIZER_ID" }, { status: 400 });
    }

    const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);

    // Qualquer membro pode consultar; ações ficam restritas por role
    const callerMembership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId, userId: user.id } },
    });
    if (!callerMembership) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const members = await prisma.organizerMember.findMany({
      where: { organizerId, user: { isDeleted: false } },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
            visibility: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    const items = members.map((m) => {
      const visibility = (m.user as { visibility?: string | null })?.visibility ?? "PUBLIC";
      const isSelf = m.userId === user.id;
      const isPrivate = visibility === "PRIVATE" && !isSelf;

      return {
        userId: m.userId,
        role: m.role,
        invitedByUserId: m.invitedByUserId,
        createdAt: m.createdAt,
        fullName: isPrivate
          ? null
          : (m.user && "fullName" in m.user ? (m.user as { fullName?: string | null }).fullName ?? null : null),
        username: m.user && "username" in m.user ? (m.user as { username?: string | null }).username ?? null : null,
        avatarUrl: m.user && "avatarUrl" in m.user ? (m.user as { avatarUrl?: string | null }).avatarUrl ?? null : null,
        email: isPrivate ? null : null,
        visibility,
      };
    });

    return NextResponse.json(
      { ok: true, items, viewerRole: callerMembership.role, organizerId },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organizador/members][GET]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
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
    const targetUserId = typeof body?.userId === "string" ? body.userId : null;
    const role = typeof body?.role === "string" ? body.role.toUpperCase() : null;

    if (!organizerId || Number.isNaN(organizerId) || !targetUserId || !role) {
      return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }
    if (!Object.values(OrganizerMemberRole).includes(role as OrganizerMemberRole)) {
      return NextResponse.json({ ok: false, error: "INVALID_ROLE" }, { status: 400 });
    }

    const callerMembership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId, userId: user.id } },
    });
    if (!callerMembership) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    const callerRole = callerMembership.role as OrganizerMemberRole | null;

    const targetMembership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId, userId: targetUserId } },
    });
    if (!targetMembership) {
      return NextResponse.json({ ok: false, error: "NOT_MEMBER" }, { status: 404 });
    }

    if (!canManageMembers(callerRole, targetMembership.role, role as OrganizerMemberRole)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    if (role === "OWNER" && !isOrgOwner(callerRole)) {
      return NextResponse.json({ ok: false, error: "ONLY_OWNER_CAN_SET_OWNER" }, { status: 403 });
    }

    if (targetMembership.role === "OWNER" && role !== "OWNER") {
      const otherOwners = await prisma.organizerMember.count({
        where: {
          organizerId,
          role: "OWNER",
          userId: { not: targetUserId },
        },
      });
      if (otherOwners === 0) {
        return NextResponse.json(
          { ok: false, error: "Não podes remover o último Owner." },
          { status: 400 },
        );
      }
    }

    // Se promover para OWNER, garantir que fica único (demovendo outros para CO_OWNER)
    if (role === "OWNER") {
      await prisma.$transaction(async (tx) => setSoleOwner(tx, organizerId, targetUserId));
      await recordOrganizationAuditSafe({
        organizerId,
        actorUserId: user.id,
        action: "OWNER_PROMOTED",
        toUserId: targetUserId,
        metadata: { via: "members.patch" },
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Bloqueia que o único owner se despromova a si próprio
    if (targetMembership.role === "OWNER" && targetUserId === user.id && role !== "OWNER") {
      const otherOwners = await prisma.organizerMember.count({
        where: { organizerId, role: "OWNER", userId: { not: user.id } },
      });
      if (otherOwners === 0) {
        return NextResponse.json(
          { ok: false, error: "Garante outro Owner antes de descer o teu papel." },
          { status: 400 },
        );
      }
    }

    await prisma.organizerMember.update({
      where: { organizerId_userId: { organizerId, userId: targetUserId } },
      data: { role: role as OrganizerMemberRole },
    });

    if (targetMembership.role === "OWNER" && role !== "OWNER") {
      await recordOrganizationAuditSafe({
        organizerId,
        actorUserId: user.id,
        action: "OWNER_DEMOTED",
        fromUserId: targetUserId,
        metadata: { newRole: role },
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organizador/members][PATCH]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
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
    const targetUserId = url.searchParams.get("userId");

    if (!organizerId || Number.isNaN(organizerId) || !targetUserId) {
      return NextResponse.json({ ok: false, error: "INVALID_PARAMS" }, { status: 400 });
    }

    const callerMembership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId, userId: user.id } },
    });
    if (!callerMembership) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    const callerRole = callerMembership.role as OrganizerMemberRole | null;

    const targetMembership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId, userId: targetUserId } },
    });
    if (!targetMembership) {
      return NextResponse.json({ ok: false, error: "NOT_MEMBER" }, { status: 404 });
    }

    if (!canManageMembers(callerRole, targetMembership.role, targetMembership.role)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    if (targetMembership.role === "OWNER") {
      if (!isOrgOwner(callerRole)) {
        return NextResponse.json({ ok: false, error: "ONLY_OWNER_CAN_REMOVE_OWNER" }, { status: 403 });
      }

      const otherOwners = await prisma.organizerMember.count({
        where: {
          organizerId,
          role: "OWNER",
          userId: { not: targetUserId },
        },
      });
      if (otherOwners === 0) {
        return NextResponse.json(
          { ok: false, error: "Não podes remover o último Owner." },
          { status: 400 },
        );
      }
    }

    await prisma.organizerMember.delete({
      where: { organizerId_userId: { organizerId, userId: targetUserId } },
    });

    if (targetMembership.role === "OWNER") {
      await recordOrganizationAuditSafe({
        organizerId,
        actorUserId: user.id,
        action: "OWNER_REMOVED",
        fromUserId: targetUserId,
        metadata: { via: "members.delete" },
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organizador/members][DELETE]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
