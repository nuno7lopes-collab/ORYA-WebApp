import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { isOrgAdminOrAbove } from "@/lib/organizationPermissions";
import { PendingPayoutStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 50;

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

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership || !isOrgAdminOrAbove(membership.role)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    if (organization.orgType === "PLATFORM" || !organization.stripeAccountId) {
      return NextResponse.json({ ok: true, items: [], pagination: { nextCursor: null, hasMore: false } });
    }

    const url = new URL(req.url);
    const statusParam = (url.searchParams.get("status") || "ALL").toUpperCase();
    const q = url.searchParams.get("q")?.trim() ?? "";
    const cursorRaw = url.searchParams.get("cursor");
    const cursor = cursorRaw ? Number(cursorRaw) : null;

    const where: Prisma.PendingPayoutWhereInput = {
      recipientConnectAccountId: organization.stripeAccountId,
    };
    if (statusParam === "ACTION_REQUIRED") {
      where.status = PendingPayoutStatus.HELD;
      where.blockedReason = { startsWith: "ACTION_REQUIRED" };
    } else if (statusParam !== "ALL") {
      where.status = statusParam as PendingPayoutStatus;
    }
    if (q) {
      where.OR = [
        { paymentIntentId: { contains: q, mode: "insensitive" } },
        { sourceId: { contains: q, mode: "insensitive" } },
        { sourceType: { contains: q, mode: "insensitive" } },
        { transferId: { contains: q, mode: "insensitive" } },
        { blockedReason: { contains: q, mode: "insensitive" } },
      ];
    }

    const items = await prisma.pendingPayout.findMany({
      where,
      orderBy: { id: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > PAGE_SIZE;
    const trimmed = hasMore ? items.slice(0, PAGE_SIZE) : items;
    const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id ?? null : null;

    const eventIds = new Set<number>();
    const bookingIds = new Set<number>();
    const pairingIds = new Set<number>();
    for (const payout of trimmed) {
      const parsed = Number(payout.sourceId);
      if (!Number.isFinite(parsed)) continue;
      if (payout.sourceType === "EVENT_TICKET") eventIds.add(parsed);
      if (payout.sourceType === "SERVICE_BOOKING") bookingIds.add(parsed);
      if (payout.sourceType === "PADEL_PAIRING") pairingIds.add(parsed);
    }

    const [events, bookings, pairings] = await Promise.all([
      eventIds.size
        ? prisma.event.findMany({
            where: { id: { in: Array.from(eventIds) } },
            select: { id: true, title: true },
          })
        : [],
      bookingIds.size
        ? prisma.booking.findMany({
            where: { id: { in: Array.from(bookingIds) } },
            select: { id: true, service: { select: { title: true } } },
          })
        : [],
      pairingIds.size
        ? prisma.padelPairing.findMany({
            where: { id: { in: Array.from(pairingIds) } },
            select: { id: true, event: { select: { id: true, title: true } } },
          })
        : [],
    ]);

    const eventById = new Map(events.map((ev) => [ev.id, ev]));
    const bookingById = new Map(bookings.map((bk) => [bk.id, bk]));
    const pairingById = new Map(pairings.map((pairing) => [pairing.id, pairing]));

    const enriched = trimmed.map((payout) => {
      const parsedId = Number(payout.sourceId);
      let source: { title: string | null; href: string | null } = { title: null, href: null };
      if (Number.isFinite(parsedId)) {
        if (payout.sourceType === "EVENT_TICKET") {
          const ev = eventById.get(parsedId);
          source = {
            title: ev?.title ?? null,
            href: ev ? `/organizacao/eventos/${ev.id}` : null,
          };
        } else if (payout.sourceType === "SERVICE_BOOKING") {
          const booking = bookingById.get(parsedId);
          source = {
            title: booking?.service?.title ?? "Reserva",
            href: null,
          };
        } else if (payout.sourceType === "PADEL_PAIRING") {
          const pairing = pairingById.get(parsedId);
          source = {
            title: pairing?.event?.title ?? "Torneio de Padel",
            href: pairing?.event?.id ? `/organizacao/eventos/${pairing.event.id}` : null,
          };
        }
      }

      return {
        id: payout.id,
        sourceType: payout.sourceType,
        sourceId: payout.sourceId,
        paymentIntentId: payout.paymentIntentId,
        amountCents: payout.amountCents,
        grossAmountCents: payout.grossAmountCents,
        platformFeeCents: payout.platformFeeCents,
        currency: payout.currency,
        status: payout.status,
        holdUntil: payout.holdUntil,
        blockedReason: payout.blockedReason,
        nextAttemptAt: payout.nextAttemptAt,
        releasedAt: payout.releasedAt,
        transferId: payout.transferId,
        createdAt: payout.createdAt,
        source,
      };
    });

    return NextResponse.json(
      { ok: true, items: enriched, pagination: { nextCursor, hasMore } },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organizacao/payouts/list]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
