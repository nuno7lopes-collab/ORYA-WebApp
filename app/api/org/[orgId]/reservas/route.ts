import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { getAvailableSlotsForScope } from "@/lib/reservas/availabilitySelect";
import { groupByScope, type AvailabilityScopeType, type ScopedOverride, type ScopedTemplate } from "@/lib/reservas/scopedAvailability";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { getResourceModeBlockedPayload, resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";
import {
  AddressSourceProvider,
  OrganizationMemberRole,
  OrganizationRolePack,
  PaymentStatus,
  ServiceLocationMode,
  SourceType,
} from "@prisma/client";
import { evaluateCandidate, type AgendaCandidate } from "@/domain/agenda/conflictEngine";
import { buildAgendaConflictPayload } from "@/domain/agenda/conflictResponse";
import { createBooking } from "@/domain/bookings/commands";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { loadScheduleDelays, resolveBookingDelay } from "@/lib/reservas/scheduleDelay";
import { intersectIds, resolveReservasScopesForMember, resolveTrainerProfessionalIds } from "@/lib/reservas/memberScopes";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const PENDING_HOLD_MINUTES = 10;
const SLOT_STEP_MINUTES = 5;

type CalendarPaymentStatus = "PAID" | "PARTIAL" | "PROCESSING" | "PENDING" | "UNKNOWN";
type CalendarChannel = "ONLINE" | "PRESENTIAL" | "BACKOFFICE" | "UNKNOWN";

function fail(
  ctx: { requestId: string; correlationId: string },
  status: number,
  errorCode: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return respondError(
    ctx,
    { errorCode, message, retryable: status >= 500, ...(details ? { details } : {}) },
    { status },
  );
}

function getMinutesOfDay(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  const hour = Number(map.get("hour"));
  const minute = Number(map.get("minute"));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function parsePositiveInt(value: unknown) {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function mapCalendarPaymentStatus(status: PaymentStatus): CalendarPaymentStatus {
  if (status === PaymentStatus.SUCCEEDED) return "PAID";
  if (status === PaymentStatus.PARTIAL_REFUND) return "PARTIAL";
  if (status === PaymentStatus.CREATED) return "PENDING";
  if (status === PaymentStatus.REQUIRES_ACTION || status === PaymentStatus.PROCESSING) return "PROCESSING";
  if (
    status === PaymentStatus.DISPUTED ||
    status === PaymentStatus.CHARGEBACK_LOST ||
    status === PaymentStatus.CHARGEBACK_WON
  ) {
    return "PROCESSING";
  }
  if (status === PaymentStatus.CANCELLED || status === PaymentStatus.FAILED || status === PaymentStatus.REFUNDED) {
    return "PENDING";
  }
  return "UNKNOWN";
}

function resolveBookingChannel(params: {
  resourceId: number | null;
  courtId: number | null;
  bookingAddressId: string | null;
  bookingLocationMode: ServiceLocationMode;
}): CalendarChannel {
  if (params.resourceId || params.courtId || params.bookingAddressId) {
    return "PRESENTIAL";
  }
  if (params.bookingLocationMode === ServiceLocationMode.FIXED) return "PRESENTIAL";
  if (params.bookingLocationMode === ServiceLocationMode.CHOOSE_AT_BOOKING) return "ONLINE";
  return "UNKNOWN";
}

function buildBlocks(
  bookings: Array<{ startsAt: Date; durationMinutes: number; professionalId: number | null; resourceId: number | null }>,
) {
  return bookings.map((booking) => ({
    start: booking.startsAt,
    end: new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000),
    professionalId: booking.professionalId,
    resourceId: booking.resourceId,
  }));
}

function buildSessionBlocks(sessions: Array<{ startsAt: Date; endsAt: Date; professionalId: number | null }>) {
  return sessions.map((session) => ({
    start: session.startsAt,
    end: session.endsAt,
    professionalId: session.professionalId,
    resourceId: null,
  }));
}

function agendaConflictResponse(decision?: Parameters<typeof buildAgendaConflictPayload>[0]["decision"]) {
  return buildAgendaConflictPayload({ decision: decision ?? null, fallbackReason: "MISSING_EXISTING_DATA" });
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const url = new URL(req.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const padelClubParam = url.searchParams.get("padelClubId");
    const courtParam = url.searchParams.get("courtId");
    const padelClubId = padelClubParam ? parsePositiveInt(padelClubParam) : null;
    const courtId = courtParam ? parsePositiveInt(courtParam) : null;
    if (padelClubParam && !padelClubId) {
      return fail(ctx, 400, "INVALID_CLUB", "Clube inválido.");
    }
    if (courtParam && !courtId) {
      return fail(ctx, 400, "INVALID_COURT", "Campo inválido.");
    }
    const fromDate = fromParam ? new Date(fromParam) : null;
    const toDate = toParam ? new Date(toParam) : null;
    const rangeFilter =
      (fromDate && !Number.isNaN(fromDate.getTime())) || (toDate && !Number.isNaN(toDate.getTime()))
        ? {
            startsAt: {
              ...(fromDate && !Number.isNaN(fromDate.getTime()) ? { gte: fromDate } : {}),
              ...(toDate && !Number.isNaN(toDate.getTime()) ? { lt: toDate } : {}),
            },
          }
        : {};
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return fail(ctx, 403, "PROFILE_NOT_FOUND", "Perfil não encontrado.");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
    }
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return fail(ctx, 403, "RESERVAS_UNAVAILABLE", reservasAccess.error ?? "Reservas indisponíveis.");
    }

    let resolvedClubId: number | null = padelClubId;
    const resolvedCourtId: number | null = courtId;
    if (resolvedClubId) {
      const club = await prisma.padelClub.findFirst({
        where: { id: resolvedClubId, organizationId: organization.id, deletedAt: null },
        select: { id: true },
      });
      if (!club) return fail(ctx, 404, "CLUB_NOT_FOUND", "Clube não encontrado.");
    }
    if (resolvedCourtId) {
      const court = await prisma.padelClubCourt.findFirst({
        where: { id: resolvedCourtId, club: { organizationId: organization.id, deletedAt: null } },
        select: { id: true, padelClubId: true },
      });
      if (!court) return fail(ctx, 404, "COURT_NOT_FOUND", "Campo não encontrado.");
      if (resolvedClubId && court.padelClubId !== resolvedClubId) {
        return fail(ctx, 400, "COURT_CLUB_MISMATCH", "Campo não pertence ao clube selecionado.");
      }
      if (!resolvedClubId) resolvedClubId = court.padelClubId;
    }

    const assignmentMode =
      (organization as { reservationAssignmentMode?: string | null }).reservationAssignmentMode ??
      "PROFESSIONAL";
    let scopeFilter: Record<string, unknown> | null = null;
    if (membership.role === OrganizationMemberRole.STAFF) {
      const isCoach = membership.rolePack === OrganizationRolePack.COACH;
      const scopes = await resolveReservasScopesForMember({
        organizationId: organization.id,
        userId: profile.id,
      });
      if (!scopes.hasAny) {
        return respondOk(ctx, { items: [] });
      }
      if (isCoach) {
        const trainerProfessionalIds = await resolveTrainerProfessionalIds({
          organizationId: organization.id,
          userId: profile.id,
        });
        if (trainerProfessionalIds.length === 0) {
          return respondOk(ctx, { items: [] });
        }
        const allowedProfessionals = intersectIds(trainerProfessionalIds, scopes.professionalIds);
        scopeFilter = {
          ...(allowedProfessionals.length > 0 ? { professionalId: { in: allowedProfessionals } } : {}),
          ...(scopes.courtIds.length > 0 ? { courtId: { in: scopes.courtIds } } : {}),
          ...(scopes.resourceIds.length > 0 ? { resourceId: { in: scopes.resourceIds } } : {}),
        };
      } else {
        const scopeOr: Array<Record<string, unknown>> = [];
        if (scopes.courtIds.length > 0) scopeOr.push({ courtId: { in: scopes.courtIds } });
        if (scopes.resourceIds.length > 0) scopeOr.push({ resourceId: { in: scopes.resourceIds } });
        if (scopes.professionalIds.length > 0) scopeOr.push({ professionalId: { in: scopes.professionalIds } });
        scopeFilter = scopeOr.length > 0 ? { OR: scopeOr } : null;
      }
    }

    const items = await prisma.booking.findMany({
      where: {
        organizationId: organization.id,
        ...rangeFilter,
        ...(scopeFilter ?? {}),
        ...(resolvedClubId ? { court: { padelClubId: resolvedClubId } } : {}),
        ...(resolvedCourtId ? { courtId: resolvedCourtId } : {}),
        status: {
          in: [
            "PENDING_CONFIRMATION",
            "PENDING",
            "CONFIRMED",
            "CANCELLED_BY_CLIENT",
            "CANCELLED_BY_ORG",
            "CANCELLED",
            "COMPLETED",
            "NO_SHOW",
            "DISPUTED",
          ],
        },
      },
      orderBy: { startsAt: "asc" },
      take: 200,
      select: {
        id: true,
        startsAt: true,
        durationMinutes: true,
        status: true,
        price: true,
        currency: true,
        createdAt: true,
        locationMode: true,
        addressId: true,
        assignmentMode: true,
        partySize: true,
        court: { select: { id: true, name: true, isActive: true } },
        professional: {
          select: {
            id: true,
            name: true,
            user: { select: { fullName: true, avatarUrl: true } },
          },
        },
        resource: {
          select: {
            id: true,
            label: true,
            capacity: true,
          },
        },
        service: {
          select: {
            id: true,
            title: true,
            kind: true,
            locationMode: true,
            addressId: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        },
        invites: {
          select: { status: true },
        },
        participants: {
          select: { status: true },
        },
        changeRequests: {
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            requestedBy: true,
            status: true,
            proposedStartsAt: true,
            proposedCourtId: true,
            proposedProfessionalId: true,
            proposedResourceId: true,
            priceDeltaCents: true,
            currency: true,
            expiresAt: true,
            createdAt: true,
          },
        },
      },
    });

    const professionalIds = Array.from(
      new Set(items.map((item) => item.professional?.id).filter((id): id is number => typeof id === "number")),
    );
    const resourceIds = Array.from(
      new Set(items.map((item) => item.resource?.id).filter((id): id is number => typeof id === "number")),
    );

    const bookingSourceIds = Array.from(new Set(items.map((item) => String(item.id))));
    const [payments, paymentSnapshots] = bookingSourceIds.length
      ? await Promise.all([
          prisma.payment.findMany({
            where: {
              organizationId: organization.id,
              sourceType: SourceType.BOOKING,
              sourceId: { in: bookingSourceIds },
            },
            select: {
              sourceId: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
          prisma.paymentSnapshot.findMany({
            where: {
              organizationId: organization.id,
              sourceType: SourceType.BOOKING,
              sourceId: { in: bookingSourceIds },
            },
            select: {
              sourceId: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
        ])
      : [[], []];

    const latestPaymentStatusBySourceId = new Map<string, PaymentStatus>();
    const latestTimestampBySourceId = new Map<string, number>();
    const pushCandidate = (sourceId: string, status: PaymentStatus, date: Date) => {
      const timestamp = date.getTime();
      const current = latestTimestampBySourceId.get(sourceId);
      if (current != null && current >= timestamp) return;
      latestTimestampBySourceId.set(sourceId, timestamp);
      latestPaymentStatusBySourceId.set(sourceId, status);
    };
    payments.forEach((payment) => {
      pushCandidate(payment.sourceId, payment.status, payment.updatedAt ?? payment.createdAt);
    });
    paymentSnapshots.forEach((snapshot) => {
      pushCandidate(snapshot.sourceId, snapshot.status, snapshot.updatedAt ?? snapshot.createdAt);
    });

    const delayMap = await loadScheduleDelays({
      tx: prisma,
      organizationId: organization.id,
      professionalIds,
      resourceIds,
    });
    const itemsWithDelay = items.map((item) => {
      const delay = resolveBookingDelay({
        startsAt: item.startsAt,
        assignmentMode: item.assignmentMode,
        professionalId: item.professional?.id ?? null,
        resourceId: item.resource?.id ?? null,
        delayMap,
      });
      const inviteCounts = item.invites.reduce(
        (acc, invite) => {
          if (invite.status === "ACCEPTED") acc.accepted += 1;
          else if (invite.status === "DECLINED") acc.declined += 1;
          else acc.pending += 1;
          acc.total += 1;
          return acc;
        },
        { total: 0, accepted: 0, declined: 0, pending: 0 },
      );
      const participantCounts = item.participants.reduce(
        (acc, participant) => {
          if (participant.status === "CONFIRMED") acc.confirmed += 1;
          else acc.cancelled += 1;
          acc.total += 1;
          return acc;
        },
        { total: 0, confirmed: 0, cancelled: 0 },
      );
      const { invites: _invites, participants: _participants, changeRequests: _changeRequests, ...rest } = item;
      const canonicalPaymentStatus = latestPaymentStatusBySourceId.get(String(item.id));
      const paymentStatus: CalendarPaymentStatus =
        canonicalPaymentStatus != null ? mapCalendarPaymentStatus(canonicalPaymentStatus) : "UNKNOWN";
      const channel = resolveBookingChannel({
        resourceId: item.resource?.id ?? null,
        courtId: item.court?.id ?? null,
        bookingAddressId: item.addressId ?? null,
        bookingLocationMode: item.locationMode,
      });
      return {
        ...rest,
        channel,
        paymentStatus,
        inviteSummary: inviteCounts,
        participantSummary: participantCounts,
        estimatedStartsAt: delay.estimatedStartsAt ? delay.estimatedStartsAt.toISOString() : null,
        delayMinutes: delay.delayMinutes,
        delayReason: delay.reason,
        changeRequest: item.changeRequests?.[0]
          ? {
              id: item.changeRequests[0].id,
              requestedBy: item.changeRequests[0].requestedBy,
              status: item.changeRequests[0].status,
              proposedStartsAt: item.changeRequests[0].proposedStartsAt,
              proposedCourtId: item.changeRequests[0].proposedCourtId,
              proposedProfessionalId: item.changeRequests[0].proposedProfessionalId,
              proposedResourceId: item.changeRequests[0].proposedResourceId,
              priceDeltaCents: item.changeRequests[0].priceDeltaCents,
              currency: item.changeRequests[0].currency,
              expiresAt: item.changeRequests[0].expiresAt,
              createdAt: item.changeRequests[0].createdAt,
            }
          : null,
      };
    });

    return respondOk(ctx, { items: itemsWithDelay });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("GET /api/org/[orgId]/reservas error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao carregar reservas.");
  }
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { id: true },
    });
    if (!profile) {
      return fail(ctx, 403, "PROFILE_NOT_FOUND", "Perfil não encontrado.");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
    }
    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
    });
    if (!reservasAccess.ok) {
      return fail(ctx, 403, "RESERVAS_UNAVAILABLE", reservasAccess.error ?? "Reservas indisponíveis.");
    }

    const isStaff = membership.role === OrganizationMemberRole.STAFF;
    const isCoach = isStaff && membership.rolePack === OrganizationRolePack.COACH;
    let memberScopes: Awaited<ReturnType<typeof resolveReservasScopesForMember>> | null = null;
    let trainerProfessionalIds: number[] = [];
    if (isStaff) {
      memberScopes = await resolveReservasScopesForMember({
        organizationId: organization.id,
        userId: profile.id,
      });
      if (!memberScopes.hasAny) {
        return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
      }
      if (isCoach) {
        trainerProfessionalIds = await resolveTrainerProfessionalIds({
          organizationId: organization.id,
          userId: profile.id,
        });
        if (trainerProfessionalIds.length === 0) {
          return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
        }
      }
    }

    const payload = await req.json().catch(() => ({}));
    const serviceId = Number(payload?.serviceId);
    const startsAtRaw = typeof payload?.startsAt === "string" ? payload.startsAt : null;
    const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;
    const userId = typeof payload?.userId === "string" ? payload.userId : null;
    const addressIdInput = typeof payload?.addressId === "string" ? payload.addressId.trim() : "";
    const professionalIdRaw = parsePositiveInt(payload?.professionalId);
    const resourceIdRaw = parsePositiveInt(payload?.resourceId);
    const courtIdRaw = parsePositiveInt(payload?.courtId);
    const partySizeRaw = parsePositiveInt(payload?.partySize);

    if (!Number.isFinite(serviceId)) {
      return fail(ctx, 400, "INVALID_SERVICE", "Serviço inválido.");
    }
    if (!userId) {
      return fail(ctx, 400, "INVALID_CLIENT", "Cliente inválido.");
    }
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      return fail(ctx, 400, "INVALID_TIME", "Horário inválido.");
    }

    const clientProfile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true, contactPhone: true },
    });
    if (!clientProfile) {
      return fail(ctx, 404, "CLIENT_NOT_FOUND", "Cliente não encontrado.");
    }
    if (!clientProfile.contactPhone) {
      return fail(ctx, 400, "PHONE_REQUIRED", "PHONE_REQUIRED");
    }

    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        organizationId: organization.id,
        isActive: true,
      },
      select: {
        id: true,
        organizationId: true,
        title: true,
        kind: true,
        assignmentMode: true,
        durationMinutes: true,
        unitPriceCents: true,
        currency: true,
        locationMode: true,
        addressId: true,
        professionalLinks: {
          select: { professionalId: true, professional: { select: { isActive: true } } },
        },
        resourceLinks: {
          select: { resourceId: true, resource: { select: { isActive: true, courtId: true } } },
        },
        organization: {
          select: { timezone: true, addressId: true, reservationAssignmentMode: true },
        },
      },
    });

    if (!service) {
      return fail(ctx, 404, "SERVICE_NOT_FOUND", "Serviço não encontrado.");
    }
    const serviceTitle = typeof service.title === "string" ? service.title.trim() : "";
    if (!serviceTitle) {
      return fail(ctx, 400, "SERVICE_TITLE_REQUIRED", "Serviço sem título.");
    }
    if (!Number.isFinite(service.durationMinutes) || service.durationMinutes <= 0) {
      return fail(ctx, 400, "SERVICE_DURATION_REQUIRED", "Duração do serviço inválida.");
    }

    const timezone = service.organization?.timezone || "Europe/Lisbon";
    const minutesOfDay = getMinutesOfDay(startsAt, timezone);
    if (minutesOfDay == null || minutesOfDay % SLOT_STEP_MINUTES !== 0) {
      return fail(ctx, 400, "INVALID_TIME_SLOT", "Horário fora da grelha de 5 minutos.");
    }

    const now = new Date();
    if (startsAt <= now) {
      return fail(ctx, 400, "TIME_PASSED", "Este horário já passou.");
    }

    const assignmentConfig = resolveServiceAssignmentMode({
      organizationMode: service.organization?.reservationAssignmentMode ?? null,
      serviceMode: service.assignmentMode ?? null,
      serviceKind: service.kind ?? null,
    });
    const assignmentMode = assignmentConfig.mode;
    const bookingAssignmentMode = assignmentConfig.assignmentMode;
    const allowedProfessionalIds = service.professionalLinks.length
      ? service.professionalLinks
          .filter((link) => link.professional?.isActive)
          .map((link) => link.professionalId)
      : null;
    const allowedResourceIds = service.resourceLinks.length
      ? service.resourceLinks
          .filter((link) => link.resource?.isActive)
          .map((link) => link.resourceId)
      : null;
    const allowedCourtIdsFromService = service.resourceLinks.length
      ? service.resourceLinks
          .filter((link) => link.resource?.isActive && (link.resource?.courtId ?? null) != null)
          .map((link) => link.resource?.courtId)
          .filter((value): value is number => typeof value === "number" && value > 0)
      : null;
    let professionalId: number | null = null;
    let resourceId: number | null = null;
    let bookingCourtId: number | null = null;
    let partySize: number | null = null;
    const scopeType: AvailabilityScopeType = assignmentMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
    let scopeIds: number[] = [];
    const resourceCourtById = new Map<number, number | null>();
    const enforceServiceResourceLinks = !assignmentConfig.isCourtService;

    if (!assignmentConfig.isCourtService && (partySizeRaw || resourceIdRaw || courtIdRaw)) {
      const blocked = getResourceModeBlockedPayload();
      return fail(
        ctx,
        409,
        blocked.error ?? "RESOURCE_MODE_NOT_ALLOWED",
        blocked.message ?? "Este serviço não permite reservas por recurso.",
      );
    }

    if (assignmentMode === "RESOURCE") {
      if (!partySizeRaw) {
        return fail(ctx, 400, "CAPACITY_REQUIRED", "Capacidade obrigatória.");
      }
      if (enforceServiceResourceLinks && allowedResourceIds && allowedResourceIds.length === 0) {
        return fail(ctx, 409, "RESOURCES_UNAVAILABLE", "Sem recursos disponíveis para este serviço.");
      }
      partySize = partySizeRaw;

      if (resourceIdRaw || (assignmentConfig.isCourtService && courtIdRaw)) {
        const selectedResource = await prisma.reservationResource.findFirst({
          where: {
            organizationId: service.organizationId,
            isActive: true,
            ...(resourceIdRaw ? { id: resourceIdRaw } : { courtId: courtIdRaw }),
          },
          select: { id: true, capacity: true, courtId: true },
        });
        if (!selectedResource) {
          if (assignmentConfig.isCourtService && courtIdRaw) {
            return fail(ctx, 404, "COURT_INVALID", "Campo inválido.");
          }
          return fail(ctx, 404, "RESOURCE_INVALID", "Recurso inválido.");
        }

        if (assignmentConfig.isCourtService) {
          if (!selectedResource.courtId) {
            return fail(ctx, 409, "COURT_RESOURCE_INVALID", "Recurso sem ligação canónica a campo.");
          }
          if (courtIdRaw && selectedResource.courtId !== courtIdRaw) {
            return fail(ctx, 409, "COURT_RESOURCE_MISMATCH", "Recurso não corresponde ao campo selecionado.");
          }
          if (
            allowedCourtIdsFromService &&
            allowedCourtIdsFromService.length > 0 &&
            !allowedCourtIdsFromService.includes(selectedResource.courtId) &&
            !(allowedResourceIds?.includes(selectedResource.id) ?? false)
          ) {
            return fail(ctx, 404, "RESOURCE_INVALID", "Recurso inválido.");
          }
        } else if (enforceServiceResourceLinks && allowedResourceIds && !allowedResourceIds.includes(selectedResource.id)) {
          return fail(ctx, 404, "RESOURCE_INVALID", "Recurso inválido.");
        }

        if (isStaff) {
          const allowedByResource = memberScopes?.resourceIds?.includes(selectedResource.id) ?? false;
          const allowedByCourt = selectedResource.courtId
            ? (memberScopes?.courtIds?.includes(selectedResource.courtId) ?? false)
            : false;
          if (!allowedByResource && !allowedByCourt) {
            return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
          }
        }

        if (selectedResource.capacity < partySize) {
          return fail(ctx, 400, "RESOURCE_CAPACITY_EXCEEDED", "Capacidade acima do recurso.");
        }

        resourceCourtById.set(selectedResource.id, selectedResource.courtId ?? null);
        resourceId = selectedResource.id;
        scopeIds = [selectedResource.id];
        bookingCourtId = assignmentConfig.isCourtService ? selectedResource.courtId ?? null : null;
      } else {
        if (memberScopes?.resourceIds?.length) {
          scopeIds = memberScopes.resourceIds;
        } else if (isStaff) {
          return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
        }
        const resources = await prisma.reservationResource.findMany({
          where: {
            organizationId: service.organizationId,
            isActive: true,
            capacity: { gte: partySize },
            ...(assignmentConfig.isCourtService ? { courtId: { not: null } } : {}),
            ...(enforceServiceResourceLinks && allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
            ...(scopeIds.length ? { id: { in: scopeIds } } : {}),
          },
          orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
          select: { id: true, courtId: true },
        });
        resources.forEach((resource) => {
          resourceCourtById.set(resource.id, resource.courtId ?? null);
        });
        scopeIds = resources.map((resource) => resource.id);
        if (scopeIds.length === 0) {
          return fail(ctx, 409, "RESOURCES_UNAVAILABLE", "Sem recursos disponíveis para esta capacidade.");
        }
      }
    } else {
      if (professionalIdRaw) {
        if (memberScopes?.professionalIds?.length) {
          if (!memberScopes.professionalIds.includes(professionalIdRaw)) {
            return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
          }
        } else if (isStaff) {
          return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
        }
        if (isCoach) {
          const allowedTrainers = memberScopes?.professionalIds?.length
            ? intersectIds(trainerProfessionalIds, memberScopes.professionalIds)
            : trainerProfessionalIds;
          if (!allowedTrainers.includes(professionalIdRaw)) {
            return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
          }
        }
        if (allowedProfessionalIds && !allowedProfessionalIds.includes(professionalIdRaw)) {
          return fail(ctx, 404, "PROFESSIONAL_INVALID", "Profissional inválido.");
        }
        const professional = await prisma.reservationProfessional.findFirst({
          where: { id: professionalIdRaw, organizationId: service.organizationId, isActive: true },
          select: { id: true },
        });
        if (!professional) {
          return fail(ctx, 404, "PROFESSIONAL_INVALID", "Profissional inválido.");
        }
        professionalId = professional.id;
        scopeIds = [professional.id];
      } else {
        if (memberScopes?.professionalIds?.length) {
          scopeIds = memberScopes.professionalIds;
        } else if (isCoach) {
          scopeIds = trainerProfessionalIds;
        } else if (isStaff) {
          return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
        }
        if (allowedProfessionalIds && allowedProfessionalIds.length === 0) {
          return fail(ctx, 409, "PROFESSIONALS_UNAVAILABLE", "Sem profissionais disponíveis para este serviço.");
        }
        const professionals = await prisma.reservationProfessional.findMany({
          where: {
            organizationId: service.organizationId,
            isActive: true,
            ...(allowedProfessionalIds ? { id: { in: allowedProfessionalIds } } : {}),
            ...(scopeIds.length ? { id: { in: scopeIds } } : {}),
          },
          orderBy: [{ priority: "asc" }, { id: "asc" }],
          select: { id: true },
        });
        scopeIds = professionals.map((professional) => professional.id);
      }
    }

    if (assignmentMode === "PROFESSIONAL" && scopeIds.length === 0) {
      return fail(ctx, 409, "PROFESSIONALS_MISSING", "Sem profissionais configurados.");
    }

    if (assignmentMode === "RESOURCE" && scopeIds.length === 0) {
      return fail(ctx, 409, "RESOURCES_MISSING", "Sem recursos configurados.");
    }

    const dateParts = getDateParts(startsAt, timezone);
    const dayStart = makeUtcDateFromLocal({ ...dateParts, hour: 0, minute: 0 }, timezone);
    const dayEnd = makeUtcDateFromLocal({ ...dateParts, hour: 23, minute: 59 }, timezone);

    if (scopeIds.length === 0) {
      return fail(ctx, 409, "NO_AVAILABILITY", "Sem disponibilidade para este serviço.");
    }

    const shouldUseOrgOnly = false;
    const bookingEndsAt = new Date(startsAt.getTime() + service.durationMinutes * 60 * 1000);
    const [templates, overrides, blockingBookings, classSessions] = await Promise.all([
      prisma.weeklyAvailabilityTemplate.findMany({
        where: {
          organizationId: service.organizationId,
          ...(shouldUseOrgOnly
            ? { scopeType: "ORGANIZATION", scopeId: 0 }
            : {
                OR: [
                  { scopeType: "ORGANIZATION", scopeId: 0 },
                  { scopeType, scopeId: { in: scopeIds } },
                ],
              }),
        },
        select: { scopeType: true, scopeId: true, dayOfWeek: true, intervals: true },
      }),
      prisma.availabilityOverride.findMany({
        where: {
          organizationId: service.organizationId,
          ...(shouldUseOrgOnly
            ? { scopeType: "ORGANIZATION", scopeId: 0 }
            : {
                OR: [
                  { scopeType: "ORGANIZATION", scopeId: 0 },
                  { scopeType, scopeId: { in: scopeIds } },
                ],
              }),
          date: new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day)),
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: { scopeType: true, scopeId: true, date: true, kind: true, intervals: true },
      }),
      prisma.booking.findMany({
        where: {
          organizationId: service.organizationId,
          startsAt: { lt: bookingEndsAt },
          OR: [
            { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] } },
            { status: { in: ["PENDING_CONFIRMATION", "PENDING"] }, pendingExpiresAt: { gt: now } },
          ],
        },
        select: { id: true, startsAt: true, durationMinutes: true, professionalId: true, resourceId: true },
      }),
      prisma.classSession.findMany({
        where: {
          organizationId: service.organizationId,
          status: "SCHEDULED",
          startsAt: { lt: bookingEndsAt },
          endsAt: { gt: startsAt },
        },
        select: { id: true, startsAt: true, endsAt: true, professionalId: true },
      }),
    ]);

    const orgTemplates = templates.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
    const orgOverrides = overrides.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
    const templatesByScope = groupByScope(templates);
    const overridesByScope = groupByScope(overrides);
    const blocks = [...buildBlocks(blockingBookings), ...buildSessionBlocks(classSessions)];

    const slotKey = startsAt.toISOString();
    const scopesToCheck = shouldUseOrgOnly
      ? [{ scopeType: "ORGANIZATION" as const, scopeId: 0, assignable: false }]
      : scopeIds.map((id) => ({ scopeType, scopeId: id, assignable: true }));
    let slotIsAvailable = false;
    let assignedScopeId: number | null = null;

    for (const scope of scopesToCheck) {
      const slots = getAvailableSlotsForScope({
        rangeStart: dayStart,
        rangeEnd: dayEnd,
        timezone,
        durationMinutes: service.durationMinutes,
        stepMinutes: SLOT_STEP_MINUTES,
        now,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        orgTemplates: orgTemplates as ScopedTemplate[],
        orgOverrides: orgOverrides as ScopedOverride[],
        templatesByScope,
        overridesByScope,
        blocks,
      });
      if (slots.some((slot) => slot.startsAt.toISOString() === slotKey)) {
        slotIsAvailable = true;
        if (scope.assignable) {
          assignedScopeId = scope.scopeId;
        }
        break;
      }
    }

    if (!slotIsAvailable) {
      return fail(ctx, 409, "SLOT_UNAVAILABLE", "Horário indisponível.");
    }

    if (assignmentMode === "RESOURCE" && !resourceId && assignedScopeId) {
      resourceId = assignedScopeId;
    }
    if (assignmentMode === "PROFESSIONAL" && !professionalId && assignedScopeId) {
      professionalId = assignedScopeId;
    }
    if (assignmentMode === "RESOURCE" && resourceId) {
      let linkedCourtId = resourceCourtById.get(resourceId) ?? null;
      if (linkedCourtId == null) {
        const resource = await prisma.reservationResource.findUnique({
          where: { id: resourceId },
          select: { courtId: true },
        });
        linkedCourtId = resource?.courtId ?? null;
      }
      bookingCourtId = assignmentConfig.isCourtService ? linkedCourtId : null;
      if (assignmentConfig.isCourtService && !bookingCourtId) {
        return fail(ctx, 409, "COURT_RESOURCE_INVALID", "Sem ligação canónica entre campo e recurso.");
      }
    }

    const scopeIdForConflict = assignmentMode === "RESOURCE" ? resourceId : professionalId;
    if (!scopeIdForConflict) {
      const conflict = agendaConflictResponse();
      return fail(ctx, 503, conflict.errorCode, "AGENDA_CONFLICT", conflict.details);
    }

    const candidate: AgendaCandidate = {
      type: "BOOKING",
      sourceId: `booking:new:${service.id}:${startsAt.toISOString()}`,
      startsAt,
      endsAt: bookingEndsAt,
    };
    const existing: AgendaCandidate[] = blockingBookings
      .filter((booking) =>
        assignmentMode === "RESOURCE" ? booking.resourceId === scopeIdForConflict : booking.professionalId === scopeIdForConflict,
      )
      .map((booking) => ({
        type: "BOOKING" as const,
        sourceId: String(booking.id),
        startsAt: booking.startsAt,
        endsAt: new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000),
      }));
    classSessions.forEach((session) => {
      if (assignmentMode === "RESOURCE") return;
      if (!session.professionalId || session.professionalId !== scopeIdForConflict) return;
      existing.push({
        type: "BOOKING",
        sourceId: `class:${session.id}`,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
      });
    });
    const decision = evaluateCandidate({ candidate, existing });
    if (!decision.allowed) {
      const conflict = agendaConflictResponse(decision);
      return fail(ctx, 409, conflict.errorCode, "AGENDA_CONFLICT", conflict.details);
    }

    const pendingExpiresAt = new Date(now.getTime() + PENDING_HOLD_MINUTES * 60 * 1000);
    const resolvedAddressId =
      service.locationMode === "CHOOSE_AT_BOOKING"
        ? addressIdInput || null
        : service.addressId ?? service.organization?.addressId ?? null;
    if (!resolvedAddressId) {
      return fail(ctx, 400, "LOCATION_REQUIRED", "Morada obrigatória para esta marcação.");
    }
    if (resolvedAddressId) {
      const address = await prisma.address.findUnique({
        where: { id: resolvedAddressId },
        select: { sourceProvider: true },
      });
      if (!address) {
        return fail(ctx, 400, "LOCATION_REQUIRED", "Morada inválida.");
      }
      if (address.sourceProvider !== AddressSourceProvider.APPLE_MAPS) {
        return fail(ctx, 400, "LOCATION_REQUIRED", "Morada deve ser Apple Maps.");
      }
    }

    const { booking } = await createBooking({
      organizationId: service.organizationId,
      actorUserId: profile.id,
      data: {
        serviceId: service.id,
        organizationId: service.organizationId,
        userId,
        startsAt,
        durationMinutes: service.durationMinutes,
        price: service.unitPriceCents,
        currency: service.currency,
        status: "PENDING_CONFIRMATION",
        assignmentMode: bookingAssignmentMode,
        professionalId,
        resourceId,
        courtId: bookingCourtId,
        partySize,
        pendingExpiresAt,
        snapshotTimezone: timezone,
        locationMode: service.locationMode,
        addressId: resolvedAddressId,
      },
      select: { id: true, status: true, pendingExpiresAt: true },
    });

    await recordOrganizationAudit(prisma, {
      organizationId: service.organizationId,
      actorUserId: profile.id,
      action: "BOOKING_PENDING_CREATED",
      metadata: {
        bookingId: booking.id,
        serviceId: service.id,
        startsAt: startsAt.toISOString(),
        clientUserId: userId,
      },
    });

    return respondOk(ctx, { booking });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }
    console.error("POST /api/org/[orgId]/reservas error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao criar reserva.");
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
