import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

// Lista compras do utilizador a partir de sale_summaries/tickets
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

    const sales = await prisma.saleSummary.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        event: { select: { id: true, title: true, slug: true, startsAt: true, endsAt: true } },
        lines: {
          select: {
            id: true,
            ticketTypeId: true,
            quantity: true,
            unitPriceCents: true,
            discountPerUnitCents: true,
            grossCents: true,
          },
        },
      },
      take: 50,
    });

    const items = sales.map((sale) => ({
      id: sale.id,
      paymentIntentId: sale.paymentIntentId,
      event: sale.event
        ? {
            id: sale.event.id,
            title: sale.event.title,
            slug: sale.event.slug,
            startsAt: sale.event.startsAt,
            endsAt: sale.event.endsAt,
          }
        : null,
      subtotalCents: sale.subtotalCents,
      discountCents: sale.discountCents,
      platformFeeCents: sale.platformFeeCents,
      totalCents: sale.totalCents,
      netCents: sale.netCents,
      feeMode: sale.feeMode,
      createdAt: sale.createdAt,
      lines: sale.lines.map((l) => ({
        ticketTypeId: l.ticketTypeId,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        discountPerUnitCents: l.discountPerUnitCents,
        grossCents: l.grossCents,
      })),
    }));

    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (err) {
    console.error("[me/purchases]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
