import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { TicketStatus, type Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;

function parsePositiveInt(raw: string | null, fallback: number) {
  if (!raw) return fallback;
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
}

async function _GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const statusRaw = (url.searchParams.get("status") || "ALL").toUpperCase();
    const intent = (url.searchParams.get("intent") || "").trim();
    const slug = (url.searchParams.get("slug") || "").trim();
    const userQuery = (url.searchParams.get("userQuery") || "").trim();
    const page = parsePositiveInt(url.searchParams.get("page"), 1);
    const pageSizeRaw = parsePositiveInt(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);
    const pageSize = Math.min(pageSizeRaw, MAX_PAGE_SIZE);
    const skip = (page - 1) * pageSize;

    const where: Prisma.TicketWhereInput = {};
    const andFilters: Prisma.TicketWhereInput[] = [];
    if (statusRaw !== "ALL") {
      if (statusRaw === "CHECKED_IN") {
        andFilters.push({
          entitlement: { checkins: { some: {} } },
        });
      } else if (Object.values(TicketStatus).includes(statusRaw as TicketStatus)) {
        where.status = statusRaw as TicketStatus;
      }
    }
    if (intent) {
      where.purchaseId = { contains: intent, mode: "insensitive" };
    }
    if (slug) {
      where.event = { slug: { contains: slug, mode: "insensitive" } };
    }
    let filteredUserIds: string[] | null = null;
    if (userQuery) {
      const profiles = await prisma.profile.findMany({
        where: {
          OR: [
            { username: { contains: userQuery, mode: "insensitive" } },
            { fullName: { contains: userQuery, mode: "insensitive" } },
            { users: { email: { contains: userQuery, mode: "insensitive" } } },
          ],
        },
        select: { id: true },
        take: 50,
      });
      filteredUserIds = profiles.map((p) => p.id);
      if (filteredUserIds.length === 0) {
        return jsonWrap(
          { ok: true, tickets: [], page, pageSize, total: 0 },
          { status: 200 },
        );
      }
      where.userId = { in: filteredUserIds };
    }
    if (q) {
      andFilters.push({
        OR: [
          { id: { contains: q, mode: "insensitive" } },
          { purchaseId: { contains: q, mode: "insensitive" } },
          { stripePaymentIntentId: { contains: q, mode: "insensitive" } },
          { event: { title: { contains: q, mode: "insensitive" } } },
          { event: { slug: { contains: q, mode: "insensitive" } } },
        ],
      });
    }
    if (andFilters.length > 0) {
      const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
      where.AND = [...existingAnd, ...andFilters];
    }

    const [total, tickets] = await prisma.$transaction([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        orderBy: { purchasedAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          status: true,
          purchasedAt: true,
          pricePaid: true,
          totalPaidCents: true,
          platformFeeCents: true,
          currency: true,
          purchaseId: true,
          stripePaymentIntentId: true,
          userId: true,
          ownerUserId: true,
          event: { select: { id: true, title: true, slug: true, startsAt: true } },
          ticketType: { select: { id: true, name: true } },
          saleSummary: { select: { status: true } },
        },
      }),
    ]);

    const ticketIds = tickets.map((ticket) => ticket.id);
    const entitlements = ticketIds.length
      ? await prisma.entitlement.findMany({
          where: { ticketId: { in: ticketIds } },
          select: {
            ticketId: true,
            checkins: { select: { checkedInAt: true }, orderBy: { checkedInAt: "desc" }, take: 1 },
          },
        })
      : [];
    const consumedMap = new Map(
      entitlements.map((ent) => [ent.ticketId, ent.checkins?.[0]?.checkedInAt ?? null]),
    );

    const userIds = Array.from(
      new Set(
        tickets
          .map((ticket) => ticket.userId ?? ticket.ownerUserId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const profiles = userIds.length
      ? await prisma.profile.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, fullName: true, users: { select: { email: true } } },
        })
      : [];
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

    const payload = tickets.map((ticket) => {
      const consumedAt = consumedMap.get(ticket.id) ?? null;
      const status = consumedAt && ticket.status === TicketStatus.ACTIVE ? "CHECKED_IN" : ticket.status;
      return {
        userId: ticket.userId ?? ticket.ownerUserId ?? null,
        id: ticket.id,
        status,
        consumedAt,
        purchasedAt: ticket.purchasedAt,
        currency: ticket.currency,
        purchaseId: ticket.purchaseId,
        paymentIntentId: ticket.stripePaymentIntentId ?? null,
        platformFeeCents: ticket.platformFeeCents,
        totalPaidCents: ticket.totalPaidCents,
        pricePaidCents: ticket.pricePaid,
        paymentEventStatus: ticket.saleSummary?.status ?? null,
        event: ticket.event
          ? {
              id: ticket.event.id,
              title: ticket.event.title,
              slug: ticket.event.slug,
              startsAt: ticket.event.startsAt,
            }
          : null,
        ticketType: ticket.ticketType
          ? { id: ticket.ticketType.id, name: ticket.ticketType.name }
          : null,
        user: (() => {
          const resolvedUserId = ticket.userId ?? ticket.ownerUserId ?? null;
          if (!resolvedUserId) return null;
          const profile = profileById.get(resolvedUserId) ?? null;
          return {
            id: resolvedUserId,
            email: profile?.users?.email ?? null,
            profile: {
              username: profile?.username ?? null,
              fullName: profile?.fullName ?? null,
            },
          };
        })(),
      };
    });

    return jsonWrap(
      { ok: true, tickets: payload, page, pageSize, total },
      { status: 200 },
    );
  } catch (err) {
    logError("admin.tickets.list_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
