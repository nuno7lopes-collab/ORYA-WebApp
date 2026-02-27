import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { getAvailableSlotsForScope } from "@/lib/reservas/availabilitySelect";
import { groupByScope, type AvailabilityScopeType, type ScopedOverride, type ScopedSchedule, type ScopedTemplate } from "@/lib/reservas/scopedAvailability";
import { getConflictWindowStart } from "@/lib/reservas/conflictWindow";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";
import { resolveServicePartySizeRules, validateRequestedPartySize } from "@/lib/reservas/servicePartySize";
import {
  buildHybridSlotMatrix,
  selectBestHybridPairForSlot,
  type HybridProfessionalScope,
  type HybridResourceScope,
} from "@/lib/reservas/hybridAssignment";
import {
  AddressSourceProvider,
  OrganizationMemberRole,
  OrganizationRolePack,
  PaymentStatus,
  ServiceLocationMode,
  SourceType,
} from "@prisma/client";
import { evaluateCandidate, type AgendaCandidate } from "@/domain/agenda/conflictEngine";
import { createBooking } from "@/domain/bookings/commands";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { loadScheduleDelays, resolveBookingDelay } from "@/lib/reservas/scheduleDelay";
import { intersectIds, resolveReservasScopesForMember, resolveTrainerProfessionalIds } from "@/lib/reservas/memberScopes";
import {
  getOrganizationBookingPolicy,
  validateDurationAgainstPolicy,
  validateStartAtAgainstPolicy,
} from "@/lib/reservas/gridPolicy";
import { resolveCourtDurationPrice } from "@/lib/reservas/serviceDurationPrices";
import { ensureReservasOperationalOpen } from "@/lib/reservas/operationalState";
import { resolveAllowedServiceScopeIds } from "@/lib/reservas/serviceScopes";
import {
  agendaConflictResponse,
  buildBookingConflictBlocks,
  buildSessionConflictBlocks,
} from "@/lib/reservas/agendaConflictHelpers";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const PENDING_HOLD_MINUTES = 10;
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
    const reservasOperational = await ensureReservasOperationalOpen({
      organizationId: organization.id,
      tx: prisma,
    });
    if (!reservasOperational.ok) {
      return fail(ctx, 409, reservasOperational.errorCode, reservasOperational.message);
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
    const durationMinutesRaw = parsePositiveInt(payload?.durationMinutes);

    if (!Number.isFinite(serviceId)) {
      return fail(ctx, 400, "INVALID_SERVICE", "Serviço inválido.");
    }
    if (!userId) {
      return fail(ctx, 400, "INVALID_CLIENT", "Cliente inválido.");
    }
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      return fail(ctx, 400, "INVALID_TIME", "Horário inválido.");
    }
    if (payload?.durationMinutes != null && !durationMinutesRaw) {
      return fail(ctx, 400, "INVALID_DURATION", "Duração inválida.");
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
        partySizeRequired: true,
        partySizeMin: true,
        partySizeMax: true,
        partySizeStep: true,
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
    const assignmentConfig = resolveServiceAssignmentMode({
      organizationMode: service.organization?.reservationAssignmentMode ?? null,
      serviceMode: service.assignmentMode ?? null,
      serviceKind: service.kind ?? null,
    });
    const requestedDurationMinutes = durationMinutesRaw ?? null;
    if (requestedDurationMinutes != null && !assignmentConfig.isCourtService) {
      return fail(ctx, 400, "INVALID_DURATION_OVERRIDE", "durationMinutes só é permitido para serviços COURT.");
    }
    let effectiveDurationMinutes = requestedDurationMinutes ?? service.durationMinutes;
    let effectivePriceCents = service.unitPriceCents;
    if (assignmentConfig.isCourtService) {
      const durationPrice = await resolveCourtDurationPrice({
        tx: prisma,
        serviceId: service.id,
        durationMinutes: effectiveDurationMinutes,
      });
      if (!durationPrice) {
        return fail(ctx, 400, "DURATION_NOT_PRICED", "Duração sem preço configurado.");
      }
      effectiveDurationMinutes = durationPrice.durationMinutes;
      effectivePriceCents = durationPrice.priceCents;
    }

    const timezone = service.organization?.timezone || "Europe/Lisbon";
    const bookingPolicy = await getOrganizationBookingPolicy({
      organizationId: organization.id,
      tx: prisma,
    });
    const startValidation = validateStartAtAgainstPolicy({
      startsAt,
      timezone,
      policy: bookingPolicy,
    });
    if (!startValidation.ok) {
      return fail(ctx, 400, startValidation.errorCode, startValidation.message);
    }
    const durationValidation = validateDurationAgainstPolicy({
      durationMinutes: effectiveDurationMinutes,
      policy: bookingPolicy,
    });
    if (!durationValidation.ok) {
      return fail(ctx, 400, durationValidation.errorCode, durationValidation.message);
    }

    const now = new Date();
    if (startsAt <= now) {
      return fail(ctx, 400, "TIME_PASSED", "Este horário já passou.");
    }

    const availabilityMode = assignmentConfig.availabilityMode;
    const bookingAssignmentMode = assignmentConfig.assignmentMode;
    const partySizeRules = resolveServicePartySizeRules({
      assignmentMode: bookingAssignmentMode,
      serviceKind: service.kind ?? null,
      partySizeRequired: service.partySizeRequired,
      partySizeMin: service.partySizeMin,
      partySizeMax: service.partySizeMax,
      partySizeStep: service.partySizeStep,
    });
    const { allowedProfessionalIds, allowedResourceIds } = resolveAllowedServiceScopeIds({
      professionalLinks: service.professionalLinks,
      resourceLinks: service.resourceLinks,
    });
    let professionalId: number | null = null;
    let resourceId: number | null = null;
    let bookingCourtId: number | null = null;
    const partySizeValidation = validateRequestedPartySize({
      requested: partySizeRaw,
      rules: partySizeRules,
    });
    if (!partySizeValidation.ok) {
      return fail(ctx, 400, partySizeValidation.errorCode, partySizeValidation.message, { partySizeRules });
    }
    const partySize: number | null = partySizeValidation.partySize;

    const scopeType: AvailabilityScopeType = availabilityMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
    let scopeIds: number[] = [];
    const resourceCourtById = new Map<number, number | null>();
    let professionalScopes: HybridProfessionalScope[] = [];
    let resourceScopes: HybridResourceScope[] = [];

    if (availabilityMode === "RESOURCE") {
      if (allowedResourceIds && allowedResourceIds.length === 0) {
        return fail(ctx, 409, "RESOURCES_UNAVAILABLE", "Sem recursos disponíveis para este serviço.");
      }

      if (resourceIdRaw || (assignmentConfig.isCourtService && courtIdRaw)) {
        const selectedResource = await prisma.reservationResource.findFirst({
          where: {
            organizationId: service.organizationId,
            isActive: true,
            ...(resourceIdRaw ? { id: resourceIdRaw } : { courtId: courtIdRaw }),
            ...(partySize != null ? { capacity: { gte: partySize } } : {}),
            ...(allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
          },
          select: { id: true, capacity: true, priority: true, courtId: true },
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

        if (partySize != null && selectedResource.capacity < partySize) {
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
            ...(partySize != null ? { capacity: { gte: partySize } } : {}),
            ...(assignmentConfig.isCourtService ? { courtId: { not: null } } : {}),
            ...(allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
            ...(scopeIds.length ? { id: { in: scopeIds } } : {}),
          },
          orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
          select: { id: true, capacity: true, priority: true, courtId: true },
        });
        resources.forEach((resource) => {
          resourceCourtById.set(resource.id, resource.courtId ?? null);
        });
        scopeIds = resources.map((resource) => resource.id);
        if (scopeIds.length === 0) {
          return fail(ctx, 409, "RESOURCES_UNAVAILABLE", "Sem recursos disponíveis para esta capacidade.");
        }
      }
    } else if (availabilityMode === "PROFESSIONAL") {
      if (resourceIdRaw || courtIdRaw || partySizeRaw) {
        return fail(ctx, 400, "RESOURCE_NOT_ALLOWED", "Este serviço não aceita recurso/capacidade neste fluxo.");
      }
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
          select: { id: true, priority: true },
        });
        if (!professional) {
          return fail(ctx, 404, "PROFESSIONAL_INVALID", "Profissional inválido.");
        }
        professionalId = professional.id;
        professionalScopes = [{ id: professional.id, priority: professional.priority }];
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
          select: { id: true, priority: true },
        });
        professionalScopes = professionals.map((professional) => ({ id: professional.id, priority: professional.priority }));
        scopeIds = professionals.map((professional) => professional.id);
      }
    } else {
      if (allowedProfessionalIds && allowedProfessionalIds.length === 0) {
        return fail(ctx, 409, "SERVICE_CONFIG_INVALID", "Serviço híbrido sem profissionais disponíveis.");
      }
      if (allowedResourceIds && allowedResourceIds.length === 0) {
        return fail(ctx, 409, "SERVICE_CONFIG_INVALID", "Serviço híbrido sem recursos disponíveis.");
      }

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
          select: { id: true, priority: true },
        });
        if (!professional) {
          return fail(ctx, 404, "PROFESSIONAL_INVALID", "Profissional inválido.");
        }
        professionalScopes = [{ id: professional.id, priority: professional.priority }];
      } else {
        let scopedProfessionalIds: number[] = [];
        if (memberScopes?.professionalIds?.length) {
          scopedProfessionalIds = memberScopes.professionalIds;
        } else if (isCoach) {
          scopedProfessionalIds = trainerProfessionalIds;
        } else if (isStaff) {
          return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
        }
        const professionals = await prisma.reservationProfessional.findMany({
          where: {
            organizationId: service.organizationId,
            isActive: true,
            ...(allowedProfessionalIds ? { id: { in: allowedProfessionalIds } } : {}),
            ...(scopedProfessionalIds.length ? { id: { in: scopedProfessionalIds } } : {}),
          },
          orderBy: [{ priority: "asc" }, { id: "asc" }],
          select: { id: true, priority: true },
        });
        professionalScopes = professionals.map((professional) => ({ id: professional.id, priority: professional.priority }));
      }

      if (professionalScopes.length === 0) {
        return fail(ctx, 409, "SERVICE_CONFIG_INVALID", "Serviço híbrido sem profissionais configurados.");
      }

      const scopedResourceIds: number[] = memberScopes?.resourceIds?.length ? memberScopes.resourceIds : [];
      if (isStaff && scopedResourceIds.length === 0) {
        return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
      }

      if (resourceIdRaw || (assignmentConfig.isCourtService && courtIdRaw)) {
        const selectedResource = await prisma.reservationResource.findFirst({
          where: {
            organizationId: service.organizationId,
            isActive: true,
            ...(resourceIdRaw ? { id: resourceIdRaw } : { courtId: courtIdRaw }),
            ...(partySize != null ? { capacity: { gte: partySize } } : {}),
            ...(allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
            ...(scopedResourceIds.length ? { id: { in: scopedResourceIds } } : {}),
          },
          orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
          select: { id: true, capacity: true, priority: true, courtId: true },
        });
        if (!selectedResource) {
          if (assignmentConfig.isCourtService && courtIdRaw) {
            return fail(ctx, 404, "COURT_INVALID", "Campo inválido.");
          }
          return fail(ctx, 404, "RESOURCE_INVALID", "Recurso inválido.");
        }
        if (assignmentConfig.isCourtService && !selectedResource.courtId) {
          return fail(ctx, 409, "COURT_RESOURCE_INVALID", "Recurso sem ligação canónica a campo.");
        }
        resourceScopes = [
          {
            id: selectedResource.id,
            capacity: selectedResource.capacity,
            priority: selectedResource.priority,
            courtId: selectedResource.courtId ?? null,
          },
        ];
        resourceCourtById.set(selectedResource.id, selectedResource.courtId ?? null);
      } else {
        const resources = await prisma.reservationResource.findMany({
          where: {
            organizationId: service.organizationId,
            isActive: true,
            ...(partySize != null ? { capacity: { gte: partySize } } : {}),
            ...(assignmentConfig.isCourtService ? { courtId: { not: null } } : {}),
            ...(allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
            ...(scopedResourceIds.length ? { id: { in: scopedResourceIds } } : {}),
          },
          orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
          select: { id: true, capacity: true, priority: true, courtId: true },
        });
        resourceScopes = resources.map((resource) => ({
          id: resource.id,
          capacity: resource.capacity,
          priority: resource.priority,
          courtId: resource.courtId ?? null,
        }));
        resources.forEach((resource) => {
          resourceCourtById.set(resource.id, resource.courtId ?? null);
        });
      }

      if (resourceScopes.length === 0) {
        return fail(ctx, 409, "SERVICE_CONFIG_INVALID", "Serviço híbrido sem recursos configurados.");
      }
    }

    if (availabilityMode === "PROFESSIONAL" && scopeIds.length === 0) {
      return fail(ctx, 409, "PROFESSIONALS_MISSING", "Sem profissionais configurados.");
    }

    if (availabilityMode === "RESOURCE" && scopeIds.length === 0) {
      return fail(ctx, 409, "RESOURCES_MISSING", "Sem recursos configurados.");
    }

    const dateParts = getDateParts(startsAt, timezone);
    const dayStart = makeUtcDateFromLocal({ ...dateParts, hour: 0, minute: 0 }, timezone);
    const dayEnd = makeUtcDateFromLocal({ ...dateParts, hour: 23, minute: 59 }, timezone);
    const conflictWindowStart = getConflictWindowStart(dayStart);

    if (availabilityMode !== "HYBRID" && scopeIds.length === 0) {
      return fail(ctx, 409, "NO_AVAILABILITY", "Sem disponibilidade para este serviço.");
    }

    const bookingEndsAt = new Date(startsAt.getTime() + effectiveDurationMinutes * 60 * 1000);
    const professionalScopeIds =
      availabilityMode === "HYBRID"
        ? professionalScopes.map((scope) => scope.id)
        : availabilityMode === "PROFESSIONAL"
          ? scopeIds
          : [];
    const resourceScopeIds =
      availabilityMode === "HYBRID"
        ? resourceScopes.map((scope) => scope.id)
        : availabilityMode === "RESOURCE"
          ? scopeIds
          : [];
    const scopedConflictFilter =
      availabilityMode === "RESOURCE"
        ? { resourceId: { in: resourceScopeIds } }
        : availabilityMode === "PROFESSIONAL"
          ? { professionalId: { in: professionalScopeIds } }
          : {
              OR: [
                { professionalId: { in: professionalScopeIds } },
                { resourceId: { in: resourceScopeIds } },
              ],
            };
    const scopeFilters =
      availabilityMode === "HYBRID"
        ? [
            { scopeType: "ORGANIZATION" as const, scopeId: 0 },
            { scopeType: "PROFESSIONAL" as const, scopeId: { in: professionalScopeIds } },
            { scopeType: "RESOURCE" as const, scopeId: { in: resourceScopeIds } },
          ]
        : [
            { scopeType: "ORGANIZATION" as const, scopeId: 0 },
            { scopeType, scopeId: { in: scopeIds } },
          ];
    const [schedules, overrides, blockingBookings, classSessions] = await Promise.all([
      prisma.availabilitySchedule.findMany({
        where: {
          organizationId: service.organizationId,
          OR: scopeFilters,
        },
        select: { id: true, scopeType: true, scopeId: true, startDate: true, endDate: true, createdAt: true },
      }),
      prisma.availabilityOverride.findMany({
        where: {
          organizationId: service.organizationId,
          OR: scopeFilters,
          date: new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day)),
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: { scopeType: true, scopeId: true, date: true, kind: true, intervals: true },
      }),
      prisma.booking.findMany({
        where: {
          organizationId: service.organizationId,
          startsAt: { lt: bookingEndsAt, gte: conflictWindowStart },
          ...scopedConflictFilter,
          OR: [
            { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] } },
            { status: { in: ["PENDING_CONFIRMATION", "PENDING"] }, pendingExpiresAt: { gt: now }, startsAt: { gt: now } },
          ],
        },
        select: { id: true, startsAt: true, durationMinutes: true, professionalId: true, resourceId: true },
      }),
      availabilityMode === "PROFESSIONAL" || availabilityMode === "HYBRID"
        ? prisma.classSession.findMany({
            where: {
              organizationId: service.organizationId,
              status: "SCHEDULED",
              startsAt: { lt: bookingEndsAt, gte: conflictWindowStart },
              endsAt: { gt: conflictWindowStart },
              ...(professionalScopeIds.length > 0 ? { professionalId: { in: professionalScopeIds } } : {}),
            },
            select: { id: true, startsAt: true, endsAt: true, professionalId: true },
          })
        : Promise.resolve([]),
    ]);

    const scheduleIds = schedules.map((schedule) => schedule.id);
    const templates = scheduleIds.length
      ? await prisma.weeklyAvailabilityTemplate.findMany({
          where: { availabilityId: { in: scheduleIds } },
          select: { availabilityId: true, dayOfWeek: true, intervals: true },
        })
      : [];
    const orgSchedules = schedules.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
    const orgOverrides = overrides.filter((row) => row.scopeType === "ORGANIZATION" && row.scopeId === 0);
    const schedulesByScope = groupByScope(schedules);
    const overridesByScope = groupByScope(overrides);
    const blocks = [
      ...buildBookingConflictBlocks(blockingBookings),
      ...buildSessionConflictBlocks(classSessions),
    ];

    const slotKey = startsAt.toISOString();
    let slotIsAvailable = false;
    let assignedScopeId: number | null = null;

    if (availabilityMode === "HYBRID") {
      const matrix = buildHybridSlotMatrix({
        rangeStart: dayStart,
        rangeEnd: dayEnd,
        timezone,
        durationMinutes: effectiveDurationMinutes,
        stepMinutes: bookingPolicy.gridMinutes,
        now,
        professionals: professionalScopes,
        resources: resourceScopes,
        orgSchedules: orgSchedules as ScopedSchedule[],
        templates: templates as ScopedTemplate[],
        orgOverrides: orgOverrides as ScopedOverride[],
        schedulesByScope,
        overridesByScope,
        blocks,
      });
      const pair = selectBestHybridPairForSlot({
        slotKey,
        professionals: professionalScopes,
        resources: resourceScopes,
        professionalSlotKeysById: matrix.professionalSlotKeysById,
        resourceSlotKeysById: matrix.resourceSlotKeysById,
      });
      if (!pair) {
        return fail(ctx, 409, "SLOT_UNAVAILABLE", "Horário indisponível.");
      }
      slotIsAvailable = true;
      professionalId = pair.professionalId;
      resourceId = pair.resourceId;
      bookingCourtId = assignmentConfig.isCourtService ? pair.courtId : null;
      if (assignmentConfig.isCourtService && !bookingCourtId) {
        return fail(ctx, 409, "SERVICE_CONFIG_INVALID", "Par híbrido sem ligação a campo.");
      }
    } else {
      const scopesToCheck = scopeIds.map((id) => ({ scopeType, scopeId: id, assignable: true }));

      for (const scope of scopesToCheck) {
        const slots = getAvailableSlotsForScope({
          rangeStart: dayStart,
          rangeEnd: dayEnd,
          timezone,
          durationMinutes: effectiveDurationMinutes,
          stepMinutes: bookingPolicy.gridMinutes,
          now,
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
          orgSchedules: orgSchedules as ScopedSchedule[],
          templates: templates as ScopedTemplate[],
          orgOverrides: orgOverrides as ScopedOverride[],
          schedulesByScope,
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
    }

    if (!slotIsAvailable) {
      return fail(ctx, 409, "SLOT_UNAVAILABLE", "Horário indisponível.");
    }

    if (availabilityMode === "RESOURCE" && !resourceId && assignedScopeId) {
      resourceId = assignedScopeId;
    }
    if (availabilityMode === "PROFESSIONAL" && !professionalId && assignedScopeId) {
      professionalId = assignedScopeId;
    }
    if ((availabilityMode === "RESOURCE" || availabilityMode === "HYBRID") && resourceId && bookingCourtId == null) {
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

    const candidate: AgendaCandidate = {
      type: "BOOKING",
      sourceId: `booking:new:${service.id}:${startsAt.toISOString()}`,
      startsAt,
      endsAt: bookingEndsAt,
    };
    if (availabilityMode === "HYBRID") {
      if (!professionalId || !resourceId) {
        const conflict = agendaConflictResponse();
        return fail(ctx, 503, conflict.errorCode, "AGENDA_CONFLICT", conflict.details);
      }
      const existingProfessional: AgendaCandidate[] = blockingBookings
        .filter((booking) => booking.professionalId === professionalId)
        .map((booking) => ({
          type: "BOOKING" as const,
          sourceId: String(booking.id),
          startsAt: booking.startsAt,
          endsAt: new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000),
        }));
      classSessions.forEach((session) => {
        if (!session.professionalId || session.professionalId !== professionalId) return;
        existingProfessional.push({
          type: "BOOKING",
          sourceId: `class:${session.id}`,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
        });
      });
      const professionalDecision = evaluateCandidate({ candidate, existing: existingProfessional });
      if (!professionalDecision.allowed) {
        const conflict = agendaConflictResponse(professionalDecision);
        return fail(ctx, 409, conflict.errorCode, "AGENDA_CONFLICT", conflict.details);
      }

      const existingResource: AgendaCandidate[] = blockingBookings
        .filter((booking) => booking.resourceId === resourceId)
        .map((booking) => ({
          type: "BOOKING" as const,
          sourceId: String(booking.id),
          startsAt: booking.startsAt,
          endsAt: new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000),
        }));
      const resourceDecision = evaluateCandidate({ candidate, existing: existingResource });
      if (!resourceDecision.allowed) {
        const conflict = agendaConflictResponse(resourceDecision);
        return fail(ctx, 409, conflict.errorCode, "AGENDA_CONFLICT", conflict.details);
      }
    } else {
      const scopeIdForConflict = availabilityMode === "RESOURCE" ? resourceId : professionalId;
      if (!scopeIdForConflict) {
        const conflict = agendaConflictResponse();
        return fail(ctx, 503, conflict.errorCode, "AGENDA_CONFLICT", conflict.details);
      }
      const existing: AgendaCandidate[] = blockingBookings
        .filter((booking) =>
          availabilityMode === "RESOURCE" ? booking.resourceId === scopeIdForConflict : booking.professionalId === scopeIdForConflict,
        )
        .map((booking) => ({
          type: "BOOKING" as const,
          sourceId: String(booking.id),
          startsAt: booking.startsAt,
          endsAt: new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000),
        }));
      classSessions.forEach((session) => {
        if (availabilityMode === "RESOURCE") return;
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

    const { booking } = await prisma.$transaction(async (tx) => {
      const lockKey = `booking:${service.organizationId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const lockedScopeFilter =
        availabilityMode === "RESOURCE"
          ? { resourceId: resourceId ?? -1 }
          : availabilityMode === "PROFESSIONAL"
            ? { professionalId: professionalId ?? -1 }
            : {
                OR: [
                  { professionalId: professionalId ?? -1 },
                  { resourceId: resourceId ?? -1 },
                ],
              };
      const lockedBookings = await tx.booking.findMany({
        where: {
          organizationId: service.organizationId,
          startsAt: { lt: bookingEndsAt, gte: conflictWindowStart },
          AND: [
            {
              OR: [
                { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] } },
                { status: { in: ["PENDING_CONFIRMATION", "PENDING"] }, pendingExpiresAt: { gt: now }, startsAt: { gt: now } },
              ],
            },
            lockedScopeFilter,
          ],
        },
        select: {
          id: true,
          startsAt: true,
          durationMinutes: true,
          professionalId: true,
          resourceId: true,
        },
      });

      const lockedConflict = lockedBookings.some((item) => {
        const itemEndsAt = new Date(item.startsAt.getTime() + item.durationMinutes * 60 * 1000);
        const overlaps = item.startsAt < bookingEndsAt && itemEndsAt > startsAt;
        if (!overlaps) return false;
        if (availabilityMode === "RESOURCE") {
          return resourceId != null && item.resourceId === resourceId;
        }
        if (availabilityMode === "PROFESSIONAL") {
          return professionalId != null && item.professionalId === professionalId;
        }
        return (
          (professionalId != null && item.professionalId === professionalId) ||
          (resourceId != null && item.resourceId === resourceId)
        );
      });
      if (lockedConflict) {
        throw new Error("AGENDA_CONFLICT_LOCKED");
      }

      if ((availabilityMode === "PROFESSIONAL" || availabilityMode === "HYBRID") && professionalId != null) {
        const lockedSessions = await tx.classSession.findMany({
          where: {
            organizationId: service.organizationId,
            status: "SCHEDULED",
            professionalId,
            startsAt: { lt: bookingEndsAt, gte: conflictWindowStart },
            endsAt: { gt: startsAt },
          },
          select: { id: true },
        });
        if (lockedSessions.length > 0) {
          throw new Error("AGENDA_CONFLICT_LOCKED");
        }
      }

      return createBooking({
        tx,
        organizationId: service.organizationId,
        actorUserId: profile.id,
        data: {
          serviceId: service.id,
          organizationId: service.organizationId,
          userId,
          startsAt,
          durationMinutes: effectiveDurationMinutes,
          price: effectivePriceCents,
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
    if (err instanceof Error && err.message === "AGENDA_CONFLICT_LOCKED") {
      const conflict = agendaConflictResponse();
      return fail(ctx, 409, conflict.errorCode, "AGENDA_CONFLICT", conflict.details);
    }
    console.error("POST /api/org/[orgId]/reservas error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR", "Erro ao criar reserva.");
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
