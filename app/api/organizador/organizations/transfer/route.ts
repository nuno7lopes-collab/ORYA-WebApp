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
    const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId.trim() : null;

    if (!organizerId || Number.isNaN(organizerId) || !targetUserId) {
      return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    // Confirma que o caller é OWNER desta org
    const callerMembership = await prisma.organizerMember.findFirst({
      where: { organizerId, userId: user.id },
    });
    if (!callerMembership || callerMembership.role !== OrganizerMemberRole.OWNER) {
      return NextResponse.json({ ok: false, error: "ONLY_OWNER_CAN_TRANSFER" }, { status: 403 });
    }

    // Se o target não for membro, cria como ADMIN por default
    const targetMembership = await prisma.organizerMember.findUnique({
      where: {
        organizerId_userId: { organizerId, userId: targetUserId },
      },
    });

    if (!targetMembership) {
      await prisma.organizerMember.create({
        data: {
          organizerId,
          userId: targetUserId,
          role: OrganizerMemberRole.ADMIN, // entra como admin
          invitedByUserId: user.id,
        },
      });
    }

    // Promover target a OWNER
    await prisma.organizerMember.update({
      where: { organizerId_userId: { organizerId, userId: targetUserId } },
      data: { role: OrganizerMemberRole.OWNER },
    });

    // Opcional: despromover o caller para ADMIN (mantém-se OWNER se quisermos vários)
    await prisma.organizerMember.update({
      where: { organizerId_userId: { organizerId, userId: user.id } },
      data: { role: OrganizerMemberRole.ADMIN },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organizador/organizations/transfer]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
