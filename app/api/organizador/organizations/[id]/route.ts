import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { clearUsernameForOwner } from "@/lib/globalUsernames";

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const { id } = await context.params;
    const organizerId = Number(id);
    if (!organizerId || Number.isNaN(organizerId)) {
      return NextResponse.json({ ok: false, error: "INVALID_ORGANIZER_ID" }, { status: 400 });
    }

    const membership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId, userId: user.id } },
    });

    if (!membership || membership.role !== "OWNER") {
      return NextResponse.json({ ok: false, error: "ONLY_OWNER_CAN_DELETE" }, { status: 403 });
    }

    // Bloquear se existir algum bilhete ativo/usado associado a eventos desta org
    const hasSales = await prisma.ticket.count({
      where: {
        status: { in: ["ACTIVE", "USED"] },
        event: { organizerId },
      },
    });
    if (hasSales > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Não é possível apagar: existem bilhetes vendidos nesta organização.",
        },
        { status: 400 },
      );
    }

    // Soft delete simples: marcar como SUSPENDED, libertar username e limpar memberships
    await prisma.organizer.update({
      where: { id: organizerId },
      data: { status: "SUSPENDED", username: null },
    });
    await prisma.organizerMember.deleteMany({ where: { organizerId } });
    await clearUsernameForOwner({ ownerType: "organizer", ownerId: organizerId });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organizador/organizations/delete]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
