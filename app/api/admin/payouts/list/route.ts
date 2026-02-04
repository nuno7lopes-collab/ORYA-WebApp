import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { PendingPayoutStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return respondError(
        ctx,
        { errorCode: admin.error, message: admin.error, retryable: false },
        { status: admin.status },
      );
    }

    const url = new URL(req.url);
    const statusParam = (url.searchParams.get("status") || "ALL").toUpperCase();
    const q = url.searchParams.get("q")?.trim() ?? "";
    const cursorRaw = url.searchParams.get("cursor");
    const cursor = cursorRaw ? Number(cursorRaw) : null;

    const where: Prisma.PendingPayoutWhereInput = {};
    if (statusParam === "ACTION_REQUIRED") {
      where.status = PendingPayoutStatus.HELD;
      where.blockedReason = { startsWith: "ACTION_REQUIRED" };
    } else if (statusParam !== "ALL") {
      where.status = statusParam as PendingPayoutStatus;
    }
    if (q) {
      where.OR = [
        { paymentIntentId: { contains: q, mode: "insensitive" } },
        { recipientConnectAccountId: { contains: q, mode: "insensitive" } },
        { sourceType: { contains: q, mode: "insensitive" } },
        { sourceId: { contains: q, mode: "insensitive" } },
        { transferId: { contains: q, mode: "insensitive" } },
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

    const accountIds = Array.from(
      new Set(trimmed.map((p) => p.recipientConnectAccountId).filter((id): id is string => Boolean(id))),
    );
    const organizations = accountIds.length
      ? await prisma.organization.findMany({
          where: { stripeAccountId: { in: accountIds } },
          select: { id: true, publicName: true, username: true, stripeAccountId: true },
        })
      : [];
    const orgByAccount = new Map(organizations.map((org) => [org.stripeAccountId, org]));

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
            select: { id: true, slug: true, title: true },
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
            select: { id: true, event: { select: { slug: true, title: true } } },
          })
        : [],
    ]);

    const eventById = new Map<number, (typeof events)[number]>(
      events.map((ev) => [ev.id, ev] as const),
    );
    const bookingById = new Map<number, (typeof bookings)[number]>(
      bookings.map((bk) => [bk.id, bk] as const),
    );
    const pairingById = new Map<number, (typeof pairings)[number]>(
      pairings.map((pairing) => [pairing.id, pairing] as const),
    );

    const enriched = trimmed.map((payout) => {
      const organization = payout.recipientConnectAccountId
        ? orgByAccount.get(payout.recipientConnectAccountId) ?? null
        : null;
      const organizationId = organization?.id ?? null;
      const parsedId = Number(payout.sourceId);
      let source: { title: string | null; href: string | null } = { title: null, href: null };
      if (Number.isFinite(parsedId)) {
        if (payout.sourceType === "EVENT_TICKET") {
          const ev = eventById.get(parsedId);
          source = {
            title: ev?.title ?? null,
            href: ev?.slug ? `/eventos/${ev.slug}` : null,
          };
        } else if (payout.sourceType === "SERVICE_BOOKING") {
          const booking = bookingById.get(parsedId);
          source = {
            title: booking?.service?.title ?? "Reserva",
            href: appendOrganizationIdToHref(`/organizacao/reservas/${parsedId}`, organizationId),
          };
        } else if (payout.sourceType === "PADEL_PAIRING") {
          const pairing = pairingById.get(parsedId);
          source = {
            title: pairing?.event?.title ?? null,
            href: pairing?.event?.slug ? `/eventos/${pairing.event.slug}?pairingId=${parsedId}` : null,
          };
        }
      }

      return {
        ...payout,
        organization: organization
          ? {
              id: organization.id,
              publicName: organization.publicName,
              username: organization.username,
              stripeAccountId: organization.stripeAccountId,
            }
          : null,
        source,
      };
    });

    return respondOk(ctx, { items: enriched, pagination: { nextCursor, hasMore } }, { status: 200 });
  } catch (err) {
    logError("admin.payouts.list_failed", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro interno.", retryable: true },
      { status: 500 },
    );
  }
}
