// app/api/organizador/staff/revoke/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated } from "@/lib/security";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { isOrgAdminOrAbove } from "@/lib/organizerPermissions";

type RevokeStaffBody = {
  assignmentId?: number;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    let body: RevokeStaffBody | null = null;
    try {
      body = (await req.json()) as RevokeStaffBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Body inválido." },
        { status: 400 }
      );
    }

    const { assignmentId } = body;

    if (!assignmentId || typeof assignmentId !== "number") {
      return NextResponse.json(
        { ok: false, error: "assignmentId é obrigatório." },
        { status: 400 }
      );
    }

    const existing = await prisma.staffAssignment.findFirst({
      where: { id: assignmentId },
    });

    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Assignment de staff não encontrado." },
        { status: 404 }
      );
    }

    // Validar permissões na organização do assignment
    const { organizer, membership } = await getActiveOrganizerForUser(user.id, {
      organizerId: existing.organizerId,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });

    if (!organizer || !membership || !isOrgAdminOrAbove(membership.role)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Sem permissões para revogar staff nesta organização.",
        },
        { status: 403 }
      );
    }

    await prisma.staffAssignment.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/organizador/staff/revoke error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao revogar staff." },
      { status: 500 }
    );
  }
}
