import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { OrganizerMemberRole } from "@prisma/client";

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
    const targetUserId = typeof body?.userId === "string" ? body.userId.trim() : null;
    const roleRaw = typeof body?.role === "string" ? body.role.toUpperCase() : null;

    if (!organizerId || Number.isNaN(organizerId) || !targetUserId || !roleRaw) {
      return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }
    if (!Object.values(OrganizerMemberRole).includes(roleRaw as OrganizerMemberRole)) {
      return NextResponse.json({ ok: false, error: "INVALID_ROLE" }, { status: 400 });
    }

    // Apenas OWNER pode gerir membros
    const callerMembership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId, userId: user.id } },
    });
    if (!callerMembership || callerMembership.role !== "OWNER") {
      return NextResponse.json({ ok: false, error: "ONLY_OWNER_CAN_MANAGE" }, { status: 403 });
    }

    const role = roleRaw as OrganizerMemberRole;

    // Se for a remover o último owner, bloquear
    if (role !== "OWNER") {
      const targetMembership = await prisma.organizerMember.findUnique({
        where: { organizerId_userId: { organizerId, userId: targetUserId } },
      });
      if (targetMembership?.role === "OWNER") {
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
    }

    await prisma.organizerMember.upsert({
      where: { organizerId_userId: { organizerId, userId: targetUserId } },
      update: { role },
      create: { organizerId, userId: targetUserId, role, invitedByUserId: user.id },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organizador/members/upsert]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
