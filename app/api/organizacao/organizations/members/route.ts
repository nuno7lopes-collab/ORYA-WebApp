import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { OrganizationMemberRole } from "@prisma/client";
import { canManageMembers, isOrgOwner } from "@/lib/organizationPermissions";
import { setSoleOwner } from "@/lib/organizationRoles";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { parseOrganizationId, resolveOrganizationIdFromParams, resolveOrganizationIdFromRequest } from "@/lib/organizationId";

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
    const eventIdRaw = url.searchParams.get("eventId");
    let organizationId =
      resolveOrganizationIdFromParams(url.searchParams) ??
      resolveOrganizationIdFromRequest(req);

    if (!organizationId && eventIdRaw) {
      const eventId = Number(eventIdRaw);
      if (eventId && !Number.isNaN(eventId)) {
        const ev = await prisma.event.findUnique({
          where: { id: eventId },
          select: { organizationId: true },
        });
        organizationId = ev?.organizationId ?? null;
      }
    }

    if (!organizationId) {
      return NextResponse.json({ ok: false, error: "INVALID_ORGANIZATION_ID" }, { status: 400 });
    }

    const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);

    // Qualquer membro pode consultar; ações ficam restritas por role
    const callerMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    if (!callerMembership) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const members = await prisma.organizationMember.findMany({
      where: { organizationId, user: { isDeleted: false } },
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
      return {
        userId: m.userId,
        role: m.role,
        invitedByUserId: m.invitedByUserId,
        createdAt: m.createdAt,
        fullName: m.user && "fullName" in m.user ? (m.user as { fullName?: string | null }).fullName ?? null : null,
        username: m.user && "username" in m.user ? (m.user as { username?: string | null }).username ?? null : null,
        avatarUrl: m.user && "avatarUrl" in m.user ? (m.user as { avatarUrl?: string | null }).avatarUrl ?? null : null,
        email: null,
        visibility: (m.user as { visibility?: string | null })?.visibility ?? "PUBLIC",
      };
    });

    return NextResponse.json(
      { ok: true, items, viewerRole: callerMembership.role, organizationId },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organização/members][GET]", err);
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
    const organizationId = parseOrganizationId(body?.organizationId);
    const targetUserId = typeof body?.userId === "string" ? body.userId : null;
    const role = typeof body?.role === "string" ? body.role.toUpperCase() : null;

    if (!organizationId || !targetUserId || !role) {
      return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }
    if (!Object.values(OrganizationMemberRole).includes(role as OrganizationMemberRole)) {
      return NextResponse.json({ ok: false, error: "INVALID_ROLE" }, { status: 400 });
    }
    if (role === "VIEWER") {
      return NextResponse.json({ ok: false, error: "ROLE_NOT_ALLOWED" }, { status: 400 });
    }

    const callerMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    if (!callerMembership) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    const callerRole = callerMembership.role as OrganizationMemberRole | null;

    const targetMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
    });
    if (!targetMembership) {
      return NextResponse.json({ ok: false, error: "NOT_MEMBER" }, { status: 404 });
    }

    if (!canManageMembers(callerRole, targetMembership.role, role as OrganizationMemberRole)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    if (role === "OWNER" && !isOrgOwner(callerRole)) {
      return NextResponse.json({ ok: false, error: "ONLY_OWNER_CAN_SET_OWNER" }, { status: 403 });
    }

    if (targetMembership.role === "OWNER" && role !== "OWNER") {
      const otherOwners = await prisma.organizationMember.count({
        where: {
          organizationId,
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
      await prisma.$transaction(async (tx) => setSoleOwner(tx, organizationId, targetUserId));
      await recordOrganizationAuditSafe({
        organizationId,
        actorUserId: user.id,
        action: "OWNER_PROMOTED",
        toUserId: targetUserId,
        metadata: { via: "members.patch" },
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Bloqueia que o único owner se despromova a si próprio
    if (targetMembership.role === "OWNER" && targetUserId === user.id && role !== "OWNER") {
      const otherOwners = await prisma.organizationMember.count({
        where: { organizationId, role: "OWNER", userId: { not: user.id } },
      });
      if (otherOwners === 0) {
        return NextResponse.json(
          { ok: false, error: "Garante outro Owner antes de descer o teu papel." },
          { status: 400 },
        );
      }
    }

    await prisma.organizationMember.update({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
      data: { role: role as OrganizationMemberRole },
    });

    if (targetMembership.role === "OWNER" && role !== "OWNER") {
      await recordOrganizationAuditSafe({
        organizationId,
        actorUserId: user.id,
        action: "OWNER_DEMOTED",
        fromUserId: targetUserId,
        metadata: { newRole: role },
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organização/members][PATCH]", err);
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
    const organizationId = resolveOrganizationIdFromParams(url.searchParams);
    const targetUserId = url.searchParams.get("userId");

    if (!organizationId || !targetUserId) {
      return NextResponse.json({ ok: false, error: "INVALID_PARAMS" }, { status: 400 });
    }

    const callerMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    if (!callerMembership) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    const callerRole = callerMembership.role as OrganizationMemberRole | null;

    const targetMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
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

      const otherOwners = await prisma.organizationMember.count({
        where: {
          organizationId,
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

    await prisma.organizationMember.delete({
      where: { organizationId_userId: { organizationId, userId: targetUserId } },
    });

    if (targetMembership.role === "OWNER") {
      await recordOrganizationAuditSafe({
        organizationId,
        actorUserId: user.id,
        action: "OWNER_REMOVED",
        fromUserId: targetUserId,
        metadata: { via: "members.delete" },
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organização/members][DELETE]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
