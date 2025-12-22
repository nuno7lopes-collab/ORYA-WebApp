import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { TicketStatus } from "@prisma/client";
import { isOrgAdminOrAbove } from "@/lib/organizerPermissions";

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
    const eventIdParam = url.searchParams.get("eventId");

    if (!eventIdParam) {
      return NextResponse.json({ ok: false, error: "MISSING_EVENT_ID" }, { status: 400 });
    }

    const eventId = Number(eventIdParam);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ ok: false, error: "INVALID_EVENT_ID" }, { status: 400 });
    }

    const { organizer, membership } = await getActiveOrganizerForUser(user.id, {
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });

    if (!organizer || !membership || !isOrgAdminOrAbove(membership.role)) {
      return NextResponse.json({ ok: false, error: "NOT_ORGANIZER" }, { status: 403 });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerId: organizer.id },
      select: { id: true },
    });

    if (!event) {
      return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    }

    const tickets = await prisma.ticket.findMany({
      where: {
        eventId: event.id,
        status: {
          in: [
            TicketStatus.ACTIVE,
            TicketStatus.USED,
            TicketStatus.REFUNDED,
            TicketStatus.TRANSFERRED,
            TicketStatus.RESALE_LISTED,
          ],
        },
      },
      orderBy: { purchasedAt: "desc" },
      select: {
        id: true,
        pricePaid: true,
        totalPaidCents: true,
        status: true,
        purchasedAt: true,
        userId: true,
        stripePaymentIntentId: true,
        ticketType: { select: { name: true } },
        guestLink: { select: { guestEmail: true, guestName: true } },
      },
    });

    const userIds = tickets.map((t) => t.userId).filter(Boolean) as string[];
    const profiles = userIds.length
      ? await prisma.profile.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true, username: true, city: true },
        })
      : [];
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const items = tickets.map((t) => {
      const profile = t.userId ? profileMap.get(t.userId) : null;
      const buyerName = t.guestLink?.guestName || profile?.fullName || profile?.username || (t.userId ? "Conta ORYA" : "Convidado");
      const buyerEmail = t.guestLink?.guestEmail || "—";

      return {
        id: t.id,
        ticketType: t.ticketType?.name ?? "Bilhete",
        priceCents: t.pricePaid ?? 0,
        totalPaidCents: t.totalPaidCents ?? t.pricePaid ?? 0,
        status: t.status,
        purchasedAt: t.purchasedAt,
        buyerName,
        buyerEmail,
        buyerCity: profile?.city ?? null,
        paymentIntentId: t.stripePaymentIntentId,
      };
    });

    return NextResponse.json({ ok: true, eventId: event.id, items }, { status: 200 });
  } catch (err) {
    console.error("[organizador/buyers] erro inesperado", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
