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
    if (!organizerId || Number.isNaN(organizerId)) {
      return NextResponse.json({ ok: false, error: "INVALID_ORGANIZER_ID" }, { status: 400 });
    }

    // Só OWNER/ADMIN podem ver
    const callerMembership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId, userId: user.id } },
    });
    if (!callerMembership || !["OWNER", "ADMIN"].includes(callerMembership.role)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const members = await prisma.organizerMember.findMany({
      where: { organizerId },
      include: {
        user: {
          select: { id: true, fullName: true, username: true, email: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const items = members.map((m) => ({
      userId: m.userId,
      role: m.role,
      invitedByUserId: m.invitedByUserId,
      createdAt: m.createdAt,
      fullName: (m.user && "fullName" in m.user ? (m.user as { fullName?: string | null }).fullName ?? null : null),
      username: (m.user && "username" in m.user ? (m.user as { username?: string | null }).username ?? null : null),
      email: (m.user && "email" in m.user ? (m.user as { email?: string | null }).email ?? null : null),
    }));

    return NextResponse.json({ ok: true, items }, { status: 200 });
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
    if (!callerMembership || callerMembership.role !== "OWNER") {
      return NextResponse.json({ ok: false, error: "ONLY_OWNER_CAN_CHANGE_ROLES" }, { status: 403 });
    }

    // Não permitir remover o último OWNER
    if (role !== "OWNER") {
      const targetMembership = await prisma.organizerMember.findUnique({
        where: { organizerId_userId: { organizerId, userId: targetUserId } },
      });
      if (targetMembership?.role === "OWNER") {
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
    }

    await prisma.organizerMember.update({
      where: { organizerId_userId: { organizerId, userId: targetUserId } },
      data: { role: role as OrganizerMemberRole },
    });

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
    if (!callerMembership || callerMembership.role !== "OWNER") {
      return NextResponse.json({ ok: false, error: "ONLY_OWNER_CAN_REMOVE" }, { status: 403 });
    }

    const targetMembership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId, userId: targetUserId } },
    });
    if (!targetMembership) {
      return NextResponse.json({ ok: false, error: "NOT_MEMBER" }, { status: 404 });
    }

    if (targetMembership.role === "OWNER") {
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

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organizador/members][DELETE]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
