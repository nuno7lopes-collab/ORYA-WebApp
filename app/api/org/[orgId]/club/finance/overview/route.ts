export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { OrganizationMemberRole } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!profile) {
      return jsonWrap({ ok: false, error: "Perfil nao encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "Sem permissoes." }, { status: 403 });
    }

    const bookings = await prisma.booking.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ startsAt: "asc" }, { id: "desc" }],
      take: 200,
      select: {
        id: true,
        startsAt: true,
        durationMinutes: true,
        status: true,
        price: true,
        currency: true,
        service: { select: { title: true } },
        court: { select: { name: true } },
        user: { select: { fullName: true, username: true } },
      },
    });

    const confirmedRevenueCents = bookings.reduce(
      (sum, booking) => (booking.status === "CONFIRMED" ? sum + booking.price : sum),
      0,
    );
    const confirmedCount = bookings.filter((booking) => booking.status === "CONFIRMED").length;
    const pendingCount = bookings.filter((booking) =>
      ["PENDING_CONFIRMATION", "PENDING"].includes(booking.status),
    ).length;
    const totalCount = bookings.length;
    const now = new Date();
    const upcomingCount = bookings.filter((booking) => new Date(booking.startsAt) >= now).length;

    return jsonWrap({
      ok: true,
      bookings: {
        confirmedRevenueCents,
        confirmedCount,
        pendingCount,
        totalCount,
        upcomingCount,
      },
      recentBookings: bookings.slice(0, 8).map((booking) => ({
        id: booking.id,
        startsAt: booking.startsAt,
        status: booking.status,
        price: booking.price,
        currency: booking.currency,
        serviceName: booking.service?.title ?? null,
        courtName: booking.court?.name ?? null,
        userName: booking.user?.fullName || (booking.user?.username ? `@${booking.user.username}` : null),
      })),
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/org/[orgId]/club/finance/overview error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar caixa." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);