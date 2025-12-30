import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const body = (await req.json().catch(() => null)) as { assignmentId?: number } | null;
    const assignmentId = typeof body?.assignmentId === "number" ? body.assignmentId : null;

    if (!assignmentId) {
      return NextResponse.json({ ok: false, error: "MISSING_ASSIGNMENT_ID" }, { status: 400 });
    }

    const assignment = await prisma.staffAssignment.findFirst({
      where: { id: assignmentId, userId: user.id, status: "PENDING", revokedAt: null },
    });

    if (!assignment) {
      return NextResponse.json({ ok: false, error: "INVITE_NOT_FOUND" }, { status: 404 });
    }

    await prisma.staffAssignment.update({
      where: { id: assignment.id },
      data: { status: "REVOKED", revokedAt: new Date() },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("[staff/invitations/reject] error:", err);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
