import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { OrganizerMemberRole } from "@prisma/client";

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

    const url = new URL(req.url);
    const organizerIdParam = url.searchParams.get("organizerId");
    const parsedId = organizerIdParam ? Number(organizerIdParam) : null;

    const activeMembership = await prisma.organizerMember.findFirst({
      where: { userId: user.id, organizer: { status: "ACTIVE" } },
      orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
    });

    const organizerId = parsedId && !Number.isNaN(parsedId) ? parsedId : activeMembership?.organizerId ?? null;
    if (!organizerId) {
      return NextResponse.json({ ok: false, error: "INVALID_ORGANIZER" }, { status: 400 });
    }

    const membership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId, userId: user.id } },
    });
    if (!membership || ![OrganizerMemberRole.OWNER, OrganizerMemberRole.CO_OWNER, OrganizerMemberRole.ADMIN].includes(membership.role)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const sales = await prisma.saleSummary.findMany({
      where: {
        event: { organizerId },
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        event: { select: { id: true, title: true, slug: true, payoutMode: true } },
        lines: true,
      },
      take: 200,
    });

    const summary = sales.reduce(
      (acc, sale) => {
        acc.grossCents += sale.subtotalCents;
        acc.discountCents += sale.discountCents;
        acc.platformFeeCents += sale.platformFeeCents;
        acc.netCents += sale.netCents;
        acc.tickets += sale.lines.reduce((s, l) => s + l.quantity, 0);
        return acc;
      },
      { grossCents: 0, discountCents: 0, platformFeeCents: 0, netCents: 0, tickets: 0 },
    );

    return NextResponse.json({ ok: true, items: sales, summary }, { status: 200 });
  } catch (err) {
    console.error("[api/organizador/pagamentos/invoices]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
