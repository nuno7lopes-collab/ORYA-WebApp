import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { OrganizationStatus, Prisma, TicketStatus } from "@prisma/client";

/**
 * 6.11 – Listar organizações (admin)
 *
 * GET /api/admin/organizacoes/list
 *
 * Query params opcionais:
 *  - search: string (filtra por publicName com contains, case-insensitive)
 *  - status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' (ou outros valores do enum OrganizationStatus)
 *  - page: número da página (1-based, default 1)
 *  - pageSize: tamanho da página (default 20, máx 100)
 *
 * Apenas utilizadores com role "admin" podem aceder.
 */

function parsePositiveInt(value: string | null, defaultValue: number): number {
  if (!value) return defaultValue;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return defaultValue;
  return Math.floor(n);
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
    }

    const url = new URL(req.url);
    const searchParam = url.searchParams.get("search");
    const statusParam = url.searchParams.get("status");
    const pageParam = url.searchParams.get("page");
    const pageSizeParam = url.searchParams.get("pageSize");

    const page = parsePositiveInt(pageParam, 1);
    const pageSizeRaw = parsePositiveInt(pageSizeParam, 50);
    const pageSize = Math.min(pageSizeRaw, 100);
    const skip = (page - 1) * pageSize;

    let statusFilter: OrganizationStatus | undefined;
    if (statusParam && (Object.values(OrganizationStatus) as string[]).includes(statusParam)) {
      statusFilter = statusParam as OrganizationStatus;
    }

    const where: Prisma.OrganizationWhereInput = {};
    if (statusFilter) where.status = statusFilter;
    if (searchParam && searchParam.trim() !== "") {
      const search = searchParam.trim();
      where.publicName = { contains: search, mode: "insensitive" };
    }

    const [orgs, total, eventCounts] = await Promise.all([
      prisma.organization.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          publicName: true,
          status: true,
          createdAt: true,
          orgType: true,
          stripeAccountId: true,
          stripeChargesEnabled: true,
          stripePayoutsEnabled: true,
          officialEmail: true,
          officialEmailVerifiedAt: true,
          members: {
            where: { role: { in: ["OWNER", "CO_OWNER"] } },
            select: {
              role: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  fullName: true,
                  users: { select: { email: true } },
                },
              },
            },
          },
        },
      }),
      prisma.organization.count({ where }),
      prisma.event.groupBy({
        by: ["organizationId"],
        _count: { _all: true },
      }),
    ]);

    const orgIds = orgs.map((org) => org.id);

    const ticketTotals = orgIds.length
      ? await prisma.$queryRaw<
          Array<{ organization_id: number; tickets: number }>
        >(
          Prisma.sql`
            SELECT e.organization_id, COUNT(*)::int AS tickets
            FROM app_v3.tickets t
            JOIN app_v3.events e ON e.id = t.event_id
            WHERE e.organization_id IN (${Prisma.join(orgIds)})
              AND t.status IN (${Prisma.join([TicketStatus.ACTIVE, TicketStatus.USED, TicketStatus.REFUNDED])})
            GROUP BY e.organization_id
          `,
        )
      : [];

    const revenueTotals = orgIds.length
      ? await prisma.$queryRaw<
          Array<{ organization_id: number; total_revenue_cents: number }>
        >(
          Prisma.sql`
            SELECT e.organization_id, COALESCE(SUM(s.total_cents), 0)::int AS total_revenue_cents
            FROM app_v3.sale_summaries s
            JOIN app_v3.events e ON e.id = s.event_id
            WHERE e.organization_id IN (${Prisma.join(orgIds)})
            GROUP BY e.organization_id
          `,
        )
      : [];

    const eventsMap = new Map(eventCounts.map((row) => [row.organizationId, row._count._all]));
    const ticketsMap = new Map(ticketTotals.map((row) => [row.organization_id, row.tickets]));
    const revenueMap = new Map(revenueTotals.map((row) => [row.organization_id, row.total_revenue_cents]));

    const organizations = orgs.map((org) => {
      const ownerMember = org.members[0];
      return {
        id: org.id,
        publicName: org.publicName,
        status: org.status,
        createdAt: org.createdAt,
        orgType: org.orgType,
        stripeAccountId: org.stripeAccountId,
        stripeChargesEnabled: org.stripeChargesEnabled,
        stripePayoutsEnabled: org.stripePayoutsEnabled,
        officialEmail: org.officialEmail,
        officialEmailVerifiedAt: org.officialEmailVerifiedAt,
        owner: ownerMember?.user
          ? {
              id: ownerMember.user.id,
              username: ownerMember.user.username,
              fullName: ownerMember.user.fullName,
              email: ownerMember.user.users?.email ?? null,
            }
          : null,
        eventsCount: eventsMap.get(org.id) ?? 0,
        totalTickets: ticketsMap.get(org.id) ?? 0,
        totalRevenueCents: revenueMap.get(org.id) ?? 0,
      };
    });

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return NextResponse.json(
      {
        ok: true,
        organizations,
        items: organizations,
        pagination: { page, pageSize, total, totalPages },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[/api/admin/organizacoes/list] Erro inesperado:", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
