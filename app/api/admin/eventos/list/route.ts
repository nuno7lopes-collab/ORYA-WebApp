import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { Prisma, EventStatus, EventType, TicketStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";

// Fase 6.13 – Listar eventos (admin)
// GET /api/admin/eventos/list
// Permite ao admin pesquisar eventos globalmente por título/slug/organizacao

async function _GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const statusFilter = searchParams.get("status")?.trim() || "";
    const typeFilter = searchParams.get("type")?.trim() || "";
    const organizationIdParam = searchParams.get("organizationId")?.trim() || "";
    const cursorRaw = searchParams.get("cursor");
    const cursor = cursorRaw ? Number(cursorRaw) : null;

    const takeRaw = searchParams.get("take");
    const take = Math.min(Math.max(Number(takeRaw) || 50, 1), 200);

    const where: Prisma.EventWhereInput = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { organization: { publicName: { contains: search, mode: "insensitive" } } },
      ];
    }
    if (statusFilter) {
      where.status = statusFilter as EventStatus;
    }
    if (typeFilter) {
      where.type = typeFilter as EventType;
    }
    if (organizationIdParam && Number.isFinite(Number(organizationIdParam))) {
      where.organizationId = Number(organizationIdParam);
    }

    const events = await prisma.event.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        type: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
        organization: {
          select: { id: true, publicName: true },
        },
      },
      orderBy: { id: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = events.length > take;
    const trimmed = hasMore ? events.slice(0, take) : events;
    const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id ?? null : null;
    const eventIds = trimmed.map((evt) => evt.id);

    const [ticketStats, summaryStats] = await Promise.all([
      eventIds.length
        ? prisma.ticket.groupBy({
            by: ["eventId"],
            where: {
              eventId: { in: eventIds },
              status: { in: [TicketStatus.ACTIVE, TicketStatus.USED, TicketStatus.REFUNDED] },
            },
            _count: { _all: true },
          })
        : [],
      eventIds.length
        ? prisma.saleSummary.groupBy({
            by: ["eventId"],
            where: { eventId: { in: eventIds } },
            _sum: {
              subtotalCents: true,
              totalCents: true,
              platformFeeCents: true,
              cardPlatformFeeCents: true,
            },
          })
        : [],
    ]);

    type SummaryRow = { revenueCents: number; revenueTotalCents: number; platformFeeCents: number };

    const ticketMap = new Map<number, number>(
      ticketStats.map((row) => [row.eventId, row._count._all] as const),
    );
    const summaryMap = new Map<number, SummaryRow>(
      summaryStats.map(
        (row) =>
          [
            row.eventId,
            {
              revenueCents: row._sum.subtotalCents ?? 0,
              revenueTotalCents: row._sum.totalCents ?? 0,
              platformFeeCents: (row._sum.platformFeeCents ?? 0) + (row._sum.cardPlatformFeeCents ?? 0),
            },
          ] as const,
      ),
    );

    const items = trimmed.map((evt) => {
      const summary: SummaryRow = summaryMap.get(evt.id) ?? {
        revenueCents: 0,
        revenueTotalCents: 0,
        platformFeeCents: 0,
      };
      return {
        id: evt.id,
        slug: evt.slug,
        title: evt.title,
        status: evt.status,
        type: evt.type,
        startsAt: evt.startsAt,
        endsAt: evt.endsAt,
        createdAt: evt.createdAt,
        organization: evt.organization
          ? { id: evt.organization.id, publicName: evt.organization.publicName }
          : null,
        ticketsSold: ticketMap.get(evt.id) ?? 0,
        revenueCents: summary.revenueCents,
        revenueTotalCents: summary.revenueTotalCents,
        platformFeeCents: summary.platformFeeCents,
      };
    });

    return jsonWrap(
      { ok: true, items, pagination: { nextCursor, hasMore } },
      { status: 200 },
    );
  } catch (error) {
    logError("admin.eventos.list_failed", error);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
