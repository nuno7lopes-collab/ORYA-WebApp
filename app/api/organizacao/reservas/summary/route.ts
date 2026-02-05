import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { BookingStatus, OrganizationMemberRole } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { jsonWrap } from "@/lib/api/wrapResponse";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const BOOKING_SCOPE_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING_CONFIRMATION,
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.CANCELLED_BY_CLIENT,
  BookingStatus.CANCELLED_BY_ORG,
  BookingStatus.CANCELLED,
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
  BookingStatus.DISPUTED,
];
const BOOKING_CONFIRMED_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
];
const BOOKING_PENDING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING_CONFIRMATION,
  BookingStatus.PENDING,
];

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { id: true },
    });
    if (!profile) {
      return jsonWrap({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });
    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return jsonWrap(
        { ok: false, error: reservasAccess.error ?? "Reservas indisponíveis." },
        { status: 403 },
      );
    }

    const now = new Date();
    const weekAhead = new Date(now);
    weekAhead.setDate(weekAhead.getDate() + 7);

    const [
      servicesTotal,
      servicesActive,
      availabilityCount,
      upcoming,
      confirmed,
      pending,
      revenueAgg,
    ] = await prisma.$transaction([
      prisma.service.count({ where: { organizationId: organization.id } }),
      prisma.service.count({ where: { organizationId: organization.id, isActive: true } }),
      prisma.availability.count({
        where: {
          service: { organizationId: organization.id },
        },
      }),
      prisma.booking.count({
        where: {
          organizationId: organization.id,
          status: { in: BOOKING_SCOPE_STATUSES },
          startsAt: { gte: now, lte: weekAhead },
        },
      }),
      prisma.booking.count({
        where: {
          organizationId: organization.id,
          status: { in: BOOKING_CONFIRMED_STATUSES },
        },
      }),
      prisma.booking.count({
        where: {
          organizationId: organization.id,
          status: { in: BOOKING_PENDING_STATUSES },
        },
      }),
      prisma.booking.aggregate({
        where: {
          organizationId: organization.id,
          status: { in: BOOKING_CONFIRMED_STATUSES },
        },
        _sum: { price: true },
      }),
    ]);

    return jsonWrap({
      ok: true,
      services: {
        total: servicesTotal,
        active: servicesActive,
        availabilityCount,
      },
      bookings: {
        upcoming,
        confirmed,
        pending,
        revenueCents: revenueAgg._sum.price ?? 0,
      },
    });
  } catch (error) {
    return jsonWrap({ ok: false, error: "Erro ao carregar resumo de reservas." }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
