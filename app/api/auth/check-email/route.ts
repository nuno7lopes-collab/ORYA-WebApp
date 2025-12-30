import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Endpoint simples para verificar se um email está bloqueado por conta PENDING_DELETE.
 * GET /api/auth/check-email?email=...
 */
export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email");
    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "INVALID_EMAIL" }, { status: 400 });
    }
    const normalized = email.trim().toLowerCase();
    const authUser = await prisma.users.findFirst({
      where: { email: normalized },
      select: { id: true },
    });
    const pending = authUser
      ? await prisma.profile.findFirst({
          where: { id: authUser.id, status: "PENDING_DELETE" },
          select: { deletionScheduledFor: true },
        })
      : null;
    if (pending) {
      return NextResponse.json(
        {
          ok: true,
          blocked: true,
          message:
            "Este email está associado a uma conta marcada para eliminação. Inicia sessão para a recuperar ou usa outro email.",
          deletionScheduledFor: pending.deletionScheduledFor,
        },
        { status: 200 },
      );
    }
    return NextResponse.json({ ok: true, blocked: false }, { status: 200 });
  } catch (err) {
    console.error("[auth/check-email] erro", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
