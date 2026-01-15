import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const items = await prisma.serviceCreditBalance.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { expiresAt: "asc" }],
      select: {
        remainingUnits: true,
        expiresAt: true,
        status: true,
        service: {
          select: {
            id: true,
            title: true,
            durationMinutes: true,
            unitPriceCents: true,
            currency: true,
            organization: {
              select: {
                id: true,
                publicName: true,
                businessName: true,
                username: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/me/creditos error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar créditos." }, { status: 500 });
  }
}
