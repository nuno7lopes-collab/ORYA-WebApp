import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";

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
    if (!organizerId || Number.isNaN(organizerId)) {
      return NextResponse.json({ ok: false, error: "INVALID_ORGANIZER_ID" }, { status: 400 });
    }

    const membership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId, userId: user.id } },
    });

    if (!membership) {
      return NextResponse.json({ ok: false, error: "NOT_MEMBER" }, { status: 403 });
    }

    if (membership.role === "OWNER") {
      const otherOwners = await prisma.organizerMember.count({
        where: {
          organizerId,
          role: "OWNER",
          userId: { not: user.id },
        },
      });
      if (otherOwners === 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "És o último Owner desta organização. Transfere a propriedade antes de sair.",
          },
          { status: 400 },
        );
      }
    }

    await prisma.organizerMember.delete({
      where: { organizerId_userId: { organizerId, userId: user.id } },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organizador/organizations/leave]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
