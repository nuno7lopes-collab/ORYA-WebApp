import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { resolveOrganizerIdFromRequest } from "@/lib/organizerId";
import { TicketStatus } from "@prisma/client";
import { isOrgAdminOrAbove } from "@/lib/organizerPermissions";

type SegmentKeys = "frequent" | "newLast60d" | "highSpenders" | "groups" | "dormant90d" | "local";

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

    const organizerId = resolveOrganizerIdFromRequest(req);
    const { organizer, membership } = await getActiveOrganizerForUser(user.id, {
      organizerId: organizerId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });

    if (!organizer || !membership || !isOrgAdminOrAbove(membership.role)) {
      return NextResponse.json({ ok: false, error: "NOT_ORGANIZER" }, { status: 403 });
    }

    const events = await prisma.event.findMany({
      where: { organizerId: organizer.id },
      select: { id: true, locationCity: true },
    });
    const eventIds = events.map((e) => e.id);

    const mainCity =
      events
        .map((e) => e.locationCity?.trim())
        .filter(Boolean)
        .reduce<{ [city: string]: number }>((acc, city) => {
          if (!city) return acc;
          acc[city] = (acc[city] ?? 0) + 1;
          return acc;
        }, {});
    const topCity = Object.entries(mainCity).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const tickets = await prisma.ticket.findMany({
      where: {
        status: { in: [TicketStatus.ACTIVE, TicketStatus.USED] },
        eventId: { in: eventIds },
      },
      select: {
        pricePaid: true,
        purchasedAt: true,
        userId: true,
        event: { select: { locationCity: true } },
        guestLink: { select: { guestEmail: true } },
      },
    });

    const now = new Date();
    const buyers = new Map<
      string,
      { count: number; total: number; first: Date; last: Date; city?: string | null }
    >();
    const userIds: Set<string> = new Set();

    for (const ticket of tickets) {
      const key = ticket.userId ?? ticket.guestLink?.guestEmail ?? null;
      if (!key) continue;
      if (ticket.userId) userIds.add(ticket.userId);
      const stats = buyers.get(key) ?? {
        count: 0,
        total: 0,
        first: ticket.purchasedAt,
        last: ticket.purchasedAt,
        city: ticket.event.locationCity,
      };
      stats.count += 1;
      stats.total += ticket.pricePaid ?? 0;
      stats.first = stats.first < ticket.purchasedAt ? stats.first : ticket.purchasedAt;
      stats.last = stats.last > ticket.purchasedAt ? stats.last : ticket.purchasedAt;
      stats.city = stats.city ?? ticket.event.locationCity;
      buyers.set(key, stats);
    }

    const profiles = await prisma.profile.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, city: true },
    });
    const cityByUser = new Map(profiles.map((p) => [p.id, p.city ?? null]));

    const segments: Record<SegmentKeys, number> = {
      frequent: 0,
      newLast60d: 0,
      highSpenders: 0,
      groups: 0,
      dormant90d: 0,
      local: 0,
    };

    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    for (const [key, stats] of buyers.entries()) {
      const buyerCity = stats.city;
      const profileCity = cityByUser.get(key) ?? buyerCity;
      if (stats.count >= 3) segments.frequent += 1;
      if (stats.first >= sixtyDaysAgo) segments.newLast60d += 1;
      if (stats.total >= 10000) segments.highSpenders += 1;
      if (stats.count >= 4) segments.groups += 1;
      if (stats.last <= ninetyDaysAgo) segments.dormant90d += 1;
      if (topCity && profileCity && profileCity.trim().toLowerCase() === topCity.trim().toLowerCase()) {
        segments.local += 1;
      }
    }

    return NextResponse.json({ ok: true, segments }, { status: 200 });
  } catch (err) {
    console.error("[organizador/marketing/audience/summary]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
