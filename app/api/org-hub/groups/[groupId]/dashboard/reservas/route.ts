import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondError, respondOk } from "@/lib/http/envelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { prisma } from "@/lib/prisma";
import { parseOrgIds, parsePositiveInt, resolveGroupDashboardScope } from "../_helpers";

async function _GET(req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const user = await requireUser();
    const { groupId: groupIdRaw } = await context.params;
    const groupId = parsePositiveInt(groupIdRaw);
    if (!groupId) {
      return respondError(
        ctx,
        { errorCode: "INVALID_GROUP_ID", message: "Grupo inválido.", retryable: false },
        { status: 400 },
      );
    }

    const url = new URL(req.url);
    const requestedOrgIds = parseOrgIds(url.searchParams.get("orgIds"));
    const scope = await resolveGroupDashboardScope({
      groupId,
      userId: user.id,
      requestedOrgIds,
    });
    if (!scope.ok) {
      return respondError(
        ctx,
        { errorCode: scope.errorCode, message: scope.message, retryable: false },
        { status: scope.status },
      );
    }

    if (scope.scopedOrgIds.length === 0) {
      return respondOk(
        ctx,
        {
          summary: {
            organizations: 0,
            bookings: 0,
            confirmed: 0,
            completed: 0,
            cancelled: 0,
            noShow: 0,
            upcoming7d: 0,
            revenueCents: 0,
            services: 0,
          },
          items: [],
        },
        { status: 200 },
      );
    }

    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [bookings, activeServices] = await Promise.all([
      prisma.booking.findMany({
        where: { organizationId: { in: scope.scopedOrgIds } },
        select: {
          organizationId: true,
          status: true,
          startsAt: true,
          price: true,
        },
      }),
      prisma.service.groupBy({
        by: ["organizationId"],
        where: { organizationId: { in: scope.scopedOrgIds }, isActive: true },
        _count: { _all: true },
      }),
    ]);

    type OrgReservasRow = {
      organizationId: number;
      organizationName: string;
      bookings: number;
      confirmed: number;
      completed: number;
      cancelled: number;
      noShow: number;
      upcoming7d: number;
      revenueCents: number;
      services: number;
    };

    const rows = new Map<number, OrgReservasRow>();
    scope.organizations.forEach((org) => {
      rows.set(org.id, {
        organizationId: org.id,
        organizationName: org.name,
        bookings: 0,
        confirmed: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
        upcoming7d: 0,
        revenueCents: 0,
        services: 0,
      });
    });

    activeServices.forEach((row) => {
      const target = rows.get(row.organizationId);
      if (!target) return;
      target.services = row._count._all;
    });

    let bookingsCount = 0;
    let confirmedCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let noShowCount = 0;
    let upcoming7dCount = 0;
    let revenueCents = 0;
    const servicesCount = activeServices.reduce((acc, row) => acc + row._count._all, 0);

    for (const { organizationId, status, startsAt, price } of bookings) {
      const row = rows.get(organizationId);
      if (!row) continue;
      row.bookings += 1;
      bookingsCount += 1;
      if (status === "CONFIRMED") {
        row.confirmed += 1;
        confirmedCount += 1;
      } else if (status === "COMPLETED") {
        row.completed += 1;
        completedCount += 1;
      } else if (status === "NO_SHOW") {
        row.noShow += 1;
        noShowCount += 1;
      } else if (
        status === "CANCELLED" ||
        status === "CANCELLED_BY_CLIENT" ||
        status === "CANCELLED_BY_ORG"
      ) {
        row.cancelled += 1;
        cancelledCount += 1;
      }

      if (startsAt >= now && startsAt <= next7Days) {
        row.upcoming7d += 1;
        upcoming7dCount += 1;
      }

      if (status === "CONFIRMED" || status === "COMPLETED") {
        const amount = price ?? 0;
        row.revenueCents += amount;
        revenueCents += amount;
      }
    }

    const items = Array.from(rows.values()).sort((a, b) => b.bookings - a.bookings);

    return respondOk(
      ctx,
      {
        summary: {
          organizations: scope.scopedOrgIds.length,
          bookings: bookingsCount,
          confirmed: confirmedCount,
          completed: completedCount,
          cancelled: cancelledCount,
          noShow: noShowCount,
          upcoming7d: upcoming7dCount,
          revenueCents,
          services: servicesCount,
        },
        items,
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return respondError(
        ctx,
        { errorCode: err.code, message: err.code, retryable: false },
        { status: err.status ?? 401 },
      );
    }
    console.error("[org-hub/groups/dashboard/reservas][GET]", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro inesperado.", retryable: true },
      { status: 500 },
    );
  }
}

export const GET = withApiEnvelope(_GET);
