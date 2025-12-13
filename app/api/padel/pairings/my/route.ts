export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

// Lista pairings Padel v2 associados ao utilizador (captão ou slot preenchido).
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventIdParam = req.nextUrl.searchParams.get("eventId");
  const eventId = eventIdParam ? Number(eventIdParam) : null;

  try {
    const pairings = await prisma.padelPairing.findMany({
      where: {
        ...(eventId ? { eventId } : {}),
        OR: [
          { createdByUserId: user.id },
          { slots: { some: { profileId: user.id } } },
        ],
      },
      include: {
        slots: {
          include: {
            ticket: {
              select: { id: true, status: true, stripePaymentIntentId: true },
            },
          },
        },
        event: {
          select: { id: true, title: true, slug: true, organizerId: true, templateType: true },
        },
        category: { select: { label: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ ok: true, pairings }, { status: 200 });
  } catch (err) {
    console.error("[padel/pairings/my] query error", err);
    // fallback seguro para não partir o UI se a tabela ainda não existir ou schema estiver desfasado
    return NextResponse.json({ ok: true, pairings: [], warning: "PAIRINGS_UNAVAILABLE" }, { status: 200 });
  }
}
