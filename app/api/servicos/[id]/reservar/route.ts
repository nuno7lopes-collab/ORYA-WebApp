export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import {
  AddressSourceProvider,
  ConsentStatus,
  ConsentType,
  CrmContactLegalBasis,
  CrmContactType,
  CrmInteractionSource,
  CrmInteractionType,
  Prisma,
} from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isUnauthenticatedError } from "@/lib/security";
import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { getAvailableSlotsForScope } from "@/lib/reservas/availabilitySelect";
import { groupByScope, type AvailabilityScopeType, type ScopedOverride, type ScopedSchedule, type ScopedTemplate } from "@/lib/reservas/scopedAvailability";
import { getConflictWindowStart } from "@/lib/reservas/conflictWindow";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";
import {
  buildHybridSlotMatrix,
  selectBestHybridPairForSlot,
} from "@/lib/reservas/hybridAssignment";
import {
  resolveServicePartySizeRules,
  validateRequestedPartySize,
} from "@/lib/reservas/servicePartySize";
import { evaluateCandidate, type AgendaCandidate } from "@/domain/agenda/conflictEngine";
import { buildAgendaConflictPayload } from "@/domain/agenda/conflictResponse";
import { createBooking } from "@/domain/bookings/commands";
import { applyAddonTotals, normalizeAddonSelection, resolveServiceAddonSelection } from "@/lib/reservas/serviceAddons";
import { applyPackageBase, parsePackageId, resolveServicePackageSelection } from "@/lib/reservas/servicePackages";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { normalizeEmail } from "@/lib/utils/email";
import { isValidPhone, normalizePhone, resolvePhoneNormalizationOptions } from "@/lib/phone";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import {
  getOrganizationBookingPolicy,
  validateDurationAgainstPolicy,
  validateStartAtAgainstPolicy,
} from "@/lib/reservas/gridPolicy";
import { resolveCourtDurationPrice } from "@/lib/reservas/serviceDurationPrices";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { ensureReservasOperationalOpen } from "@/lib/reservas/operationalState";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const PENDING_HOLD_MINUTES = 10;
const MAX_PENDING_PER_USER = 1;
function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

function parsePositiveInt(value: unknown) {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildSelectionRulesPayload(params: {
  partySizeRequired: boolean;
  partySizeMin: number;
  partySizeMax: number;
  partySizeStep: number;
  requiresProfessional: boolean;
  requiresResource: boolean;
}) {
  return {
    partySizeRequired: params.partySizeRequired,
    partySizeRange: {
      min: params.partySizeMin,
      max: params.partySizeMax,
      step: params.partySizeStep,
    },
    partySizeMin: params.partySizeMin,
    partySizeMax: params.partySizeMax,
    partySizeStep: params.partySizeStep,
    requiresProfessional: params.requiresProfessional,
    requiresResource: params.requiresResource,
  };
}

function buildBlocks(bookings: Array<{ startsAt: Date; durationMinutes: number; professionalId: number | null; resourceId: number | null }>) {
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
  return {
    ok: false,
    ...buildAgendaConflictPayload({ decision: decision ?? null, fallbackReason: "MISSING_EXISTING_DATA" }),
  };
}

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const serviceId = Number(resolved.id);
  if (!Number.isFinite(serviceId)) {
    return jsonWrap({ ok: false, error: "Serviço inválido." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const { data: userData } = await getUserWithPolicy("optional_verified", { supabaseOverride: supabase });
    const user = userData?.user ?? null;
    const payload = await req.json().catch(() => ({}));
    const phoneOptions = resolvePhoneNormalizationOptions({ headers: req.headers });
    const guestInput = payload?.guest ?? null;
    const guestEmailRaw = typeof guestInput?.email === "string" ? guestInput.email.trim() : "";
    const guestNameRaw = typeof guestInput?.name === "string" ? guestInput.name.trim() : "";
    const guestPhoneRaw = typeof guestInput?.phone === "string" ? guestInput.phone.trim() : "";
    const guestConsent = guestInput?.consent === true;
    const guestEmailNormalized = normalizeEmail(guestEmailRaw);
    const guestEmail = guestEmailRaw && EMAIL_REGEX.test(guestEmailRaw) ? guestEmailRaw : "";
    const guestPhone = guestPhoneRaw ? normalizePhone(guestPhoneRaw, phoneOptions) : "";
    const startsAtRaw = typeof payload?.startsAt === "string" ? payload.startsAt : null;
    const startsAt = startsAtRaw ? new Date(startsAtRaw) : null;
    const addressIdInput = typeof payload?.addressId === "string" ? payload.addressId.trim() : "";
    const addonSelection = normalizeAddonSelection(payload?.selectedAddons ?? payload?.addons);
    const packageId = parsePackageId(payload?.packageId);
    if (payload?.packageId != null && !packageId) {
      return jsonWrap({ ok: false, error: "Pacote inválido." }, { status: 400 });
    }

    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      return jsonWrap({ ok: false, error: "Horário inválido." }, { status: 400 });
    }

    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        isActive: true,
        organization: {
          status: "ACTIVE",
        },
      },
      select: {
        id: true,
        kind: true,
        assignmentMode: true,
        partySizeRequired: true,
        partySizeMin: true,
        partySizeMax: true,
        partySizeStep: true,
        organizationId: true,
        durationMinutes: true,
        unitPriceCents: true,
        currency: true,
        locationMode: true,
        addressId: true,
        policy: { select: { guestBookingAllowed: true } },
        professionalLinks: {
          select: { professionalId: true, professional: { select: { isActive: true } } },
        },
        resourceLinks: {
          select: { resourceId: true, resource: { select: { isActive: true } } },
        },
        organization: {
          select: {
            primaryModule: true,
            timezone: true,
            addressId: true,
            reservationAssignmentMode: true,
            orgType: true,
            stripeAccountId: true,
            stripeChargesEnabled: true,
            stripePayoutsEnabled: true,
            officialEmail: true,
            officialEmailVerifiedAt: true,
          },
        },
      },
    });

    if (!service) {
      return jsonWrap({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }
    const reservasAccess = await ensureReservasModuleAccess(
      {
        id: service.organizationId,
        primaryModule: service.organization?.primaryModule ?? null,
      },
      prisma,
    );
    if (!reservasAccess.ok) {
      return jsonWrap(
        { ok: false, error: reservasAccess.errorCode ?? "RESERVAS_UNAVAILABLE", message: reservasAccess.error },
        { status: 403 },
      );
    }
    const reservasOperational = await ensureReservasOperationalOpen({
      organizationId: service.organizationId,
      tx: prisma,
    });
    if (!reservasOperational.ok) {
      return jsonWrap(
        { ok: false, error: reservasOperational.errorCode, message: reservasOperational.message },
        { status: 409 },
      );
    }

    if (user) {
      const profile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { contactPhone: true },
      });
      if (!profile?.contactPhone) {
        return jsonWrap(
          { ok: false, error: "PHONE_REQUIRED", message: "Telemóvel obrigatório para reservar." },
          { status: 400 },
        );
      }
    } else {
      const guestAllowed = Boolean(service.policy?.guestBookingAllowed);
      if (!guestAllowed) {
        return jsonWrap({ ok: false, error: "AUTH_REQUIRED", message: "Inicia sessão para reservar." }, { status: 401 });
      }
      if (!guestEmail || !guestNameRaw) {
        return jsonWrap(
          { ok: false, error: "GUEST_REQUIRED", message: "Nome e email obrigatórios para convidado." },
          { status: 400 },
        );
      }
      if (!guestConsent) {
        return jsonWrap(
          { ok: false, error: "CONSENT_REQUIRED", message: "Tens de aceitar a política de privacidade." },
          { status: 400 },
        );
      }
      if (!EMAIL_REGEX.test(guestEmailRaw)) {
        return jsonWrap({ ok: false, error: "INVALID_GUEST_EMAIL", message: "Email inválido." }, { status: 400 });
      }
      if (!guestPhone || !isValidPhone(guestPhone)) {
        return jsonWrap(
          { ok: false, error: "PHONE_REQUIRED", message: "Telemóvel obrigatório para reservar." },
          { status: 400 },
        );
      }
    }

    if (!user && guestEmail && guestConsent) {
      const consentNow = new Date();
      const consents = [
        {
          type: ConsentType.CONTACT_EMAIL,
          status: ConsentStatus.GRANTED,
          source: "BOOKING_GUEST",
          grantedAt: consentNow,
        },
        ...(guestPhone
          ? [
              {
                type: ConsentType.CONTACT_SMS,
                status: ConsentStatus.GRANTED,
                source: "BOOKING_GUEST",
                grantedAt: consentNow,
              },
            ]
          : []),
      ];

      try {
        await ingestCrmInteraction({
          organizationId: service.organizationId,
          userId: null,
          type: CrmInteractionType.FORM_SUBMITTED,
          sourceType: CrmInteractionSource.FORM,
          sourceId: String(service.id),
          externalId: `guest-consent:service:${service.id}:${guestEmailNormalized ?? guestEmail}`,
          occurredAt: consentNow,
          contactEmail: guestEmail,
          contactPhone: guestPhone || null,
          displayName: guestNameRaw || null,
          contactType: CrmContactType.GUEST,
          legalBasis: CrmContactLegalBasis.CONSENT,
          consents,
          metadata: {
            serviceId: service.id,
            organizationId: service.organizationId,
          },
        });
      } catch (err) {
        console.warn("[reservas/reservar] CRM consent ingest failed", err);
      }
    }

    const assignmentConfig = resolveServiceAssignmentMode({
      organizationMode: service.organization?.reservationAssignmentMode ?? null,
      serviceMode: service.assignmentMode ?? null,
      serviceKind: service.kind ?? null,
    });
    const availabilityMode = assignmentConfig.availabilityMode;
    const partySizeRules = resolveServicePartySizeRules({
      assignmentMode: assignmentConfig.assignmentMode,
      serviceKind: service.kind ?? null,
      partySizeRequired: service.partySizeRequired,
      partySizeMin: service.partySizeMin,
      partySizeMax: service.partySizeMax,
      partySizeStep: service.partySizeStep,
    });
    const selectionRules = buildSelectionRulesPayload({
      ...partySizeRules,
      requiresProfessional: assignmentConfig.requiresProfessional,
      requiresResource: assignmentConfig.requiresResource,
    });

    const timezone = service.organization?.timezone || "Europe/Lisbon";
    const isCourtService = service.kind === "COURT";
    let addonResolution: Awaited<ReturnType<typeof resolveServiceAddonSelection>> = {
      ok: true,
      addons: [],
      totalDeltaMinutes: 0,
      totalDeltaPriceCents: 0,
    };
    let packageResolution: Awaited<ReturnType<typeof resolveServicePackageSelection>> = {
      ok: true,
      package: null,
    };
    if (packageId && !isCourtService) {
      packageResolution = await resolveServicePackageSelection({
        tx: prisma,
        serviceId: service.id,
        packageId,
      });
      if (!packageResolution.ok) {
        return jsonWrap({ ok: false, error: packageResolution.error }, { status: 400 });
      }
    }
    if (addonSelection.length > 0) {
      addonResolution = await resolveServiceAddonSelection({
        tx: prisma,
        serviceId: service.id,
        selection: addonSelection,
      });
      if (!addonResolution.ok) {
        return jsonWrap({ ok: false, error: addonResolution.error }, { status: 400 });
      }
    }
    const base = applyPackageBase({
      baseDurationMinutes: service.durationMinutes,
      basePriceCents: service.unitPriceCents ?? 0,
      pkg: packageResolution.ok ? packageResolution.package : null,
    });
    const totals = applyAddonTotals({
      baseDurationMinutes: base.durationMinutes,
      basePriceCents: base.priceCents,
      totalDeltaMinutes: addonResolution.totalDeltaMinutes,
      totalDeltaPriceCents: addonResolution.totalDeltaPriceCents,
    });
    const durationOverride = parsePositiveInt(payload?.durationMinutes);
    let effectiveDurationMinutes = durationOverride ?? totals.durationMinutes;
    let effectivePriceCents = totals.priceCents;

    if (isCourtService) {
      if (!durationOverride) {
        effectiveDurationMinutes = service.durationMinutes;
      }
      const courtDurationPrice = await resolveCourtDurationPrice({
        tx: prisma,
        serviceId: service.id,
        durationMinutes: effectiveDurationMinutes,
      });
      if (!courtDurationPrice) {
        return jsonWrap(
          { ok: false, error: "DURATION_NOT_PRICED", message: "Duração sem preço configurado." },
          { status: 400 },
        );
      }
      effectivePriceCents = Math.max(0, courtDurationPrice.priceCents + Math.max(0, effectivePriceCents - base.priceCents));
    }

    if (effectivePriceCents > 0) {
      const isPlatformOrg = service.organization?.orgType === "PLATFORM";
      const gate = getPaidSalesGate({
        officialEmail: service.organization?.officialEmail ?? null,
        officialEmailVerifiedAt: service.organization?.officialEmailVerifiedAt ?? null,
        stripeAccountId: service.organization?.stripeAccountId ?? null,
        stripeChargesEnabled: service.organization?.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: service.organization?.stripePayoutsEnabled ?? false,
        requireStripe: !isPlatformOrg,
      });
      if (!gate.ok) {
        return jsonWrap(
          {
            ok: false,
            error: "PAYMENTS_NOT_READY",
            message: formatPaidSalesGateMessage(gate, "Pagamentos indisponíveis. Para ativar,"),
            missingEmail: gate.missingEmail,
            missingStripe: gate.missingStripe,
          },
          { status: 409 },
        );
      }
    }
    const bookingPolicy = await getOrganizationBookingPolicy({
      organizationId: service.organizationId,
      tx: prisma,
    });
    const startValidation = validateStartAtAgainstPolicy({
      startsAt,
      timezone,
      policy: bookingPolicy,
    });
    if (!startValidation.ok) {
      return jsonWrap({ ok: false, error: startValidation.errorCode, message: startValidation.message }, { status: 400 });
    }
    const durationValidation = validateDurationAgainstPolicy({
      durationMinutes: effectiveDurationMinutes,
      policy: bookingPolicy,
    });
    if (!durationValidation.ok) {
      return jsonWrap({ ok: false, error: durationValidation.errorCode, message: durationValidation.message }, { status: 400 });
    }

    const now = new Date();
    if (startsAt <= now) {
      return jsonWrap({ ok: false, error: "Este horário já passou." }, { status: 400 });
    }

    const pendingCount = await prisma.booking.count({
      where: {
        ...(user
          ? { userId: user.id }
          : guestEmailNormalized
            ? { guestEmail: guestEmailNormalized }
            : { guestEmail: "__invalid__" }),
        status: { in: ["PENDING_CONFIRMATION", "PENDING"] },
        pendingExpiresAt: { gt: now },
      },
    });
    if (pendingCount >= MAX_PENDING_PER_USER) {
      return jsonWrap({ ok: false, error: "Demasiadas pré-reservas ativas." }, { status: 429 });
    }

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
    const professionalIdRaw = parsePositiveInt(payload?.professionalId);
    const partySizeRaw = parsePositiveInt(payload?.partySize);
    const partySizeValidation = validateRequestedPartySize({
      requested: partySizeRaw,
      rules: partySizeRules,
    });
    if (!partySizeValidation.ok) {
      return jsonWrap(
        {
          ok: false,
          error: partySizeValidation.errorCode,
          message: partySizeValidation.message,
          selectionRules,
        },
        { status: 400 },
      );
    }
    const partySize = partySizeValidation.partySize;
    let professionalId: number | null = null;
    let resourceId: number | null = null;
    let courtId: number | null = null;
    const scopeType: AvailabilityScopeType =
      availabilityMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
    let scopeIds: number[] = [];
    const resourceCourtById = new Map<number, number | null>();
    let professionalScopes: Array<{ id: number; priority: number }> = [];
    let resourceScopes: Array<{
      id: number;
      capacity: number;
      priority: number;
      courtId: number | null;
    }> = [];

    if (availabilityMode === "RESOURCE") {
      if (allowedResourceIds && allowedResourceIds.length === 0) {
        return jsonWrap({ ok: false, error: "Sem recursos disponíveis para este serviço." }, { status: 409 });
      }
      const resources = await prisma.reservationResource.findMany({
        where: {
          organizationId: service.organizationId,
          isActive: true,
          ...(partySize != null ? { capacity: { gte: partySize } } : {}),
          ...(assignmentConfig.isCourtService ? { courtId: { not: null } } : {}),
          ...(allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
        },
        orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
        select: { id: true, capacity: true, priority: true, courtId: true },
      });
      resources.forEach((resource) => {
        resourceCourtById.set(resource.id, resource.courtId ?? null);
      });
      resourceScopes = resources;
      scopeIds = resources.map((resource) => resource.id);
      if (scopeIds.length === 0) {
        return jsonWrap({ ok: false, error: "Sem recursos disponíveis para esta capacidade.", selectionRules }, { status: 409 });
      }
    } else if (availabilityMode === "PROFESSIONAL") {
      if (professionalIdRaw) {
        if (allowedProfessionalIds && !allowedProfessionalIds.includes(professionalIdRaw)) {
          return jsonWrap({ ok: false, error: "Profissional indisponível." }, { status: 404 });
        }
        const professional = await prisma.reservationProfessional.findFirst({
          where: { id: professionalIdRaw, organizationId: service.organizationId, isActive: true },
          select: { id: true, priority: true },
        });
        if (!professional) {
          return jsonWrap({ ok: false, error: "Profissional inválido." }, { status: 404 });
        }
        professionalScopes = [professional];
        scopeIds = [professional.id];
      } else {
        if (allowedProfessionalIds && allowedProfessionalIds.length === 0) {
          return jsonWrap({ ok: false, error: "Sem profissionais disponíveis para este serviço." }, { status: 409 });
        }
        const professionals = await prisma.reservationProfessional.findMany({
          where: {
            organizationId: service.organizationId,
            isActive: true,
            ...(allowedProfessionalIds ? { id: { in: allowedProfessionalIds } } : {}),
          },
          orderBy: [{ priority: "asc" }, { id: "asc" }],
          select: { id: true, priority: true },
        });
        professionalScopes = professionals;
        scopeIds = professionals.map((professional) => professional.id);
      }
    } else {
      if (professionalIdRaw) {
        if (allowedProfessionalIds && !allowedProfessionalIds.includes(professionalIdRaw)) {
          return jsonWrap({ ok: false, error: "Profissional indisponível." }, { status: 404 });
        }
        const professional = await prisma.reservationProfessional.findFirst({
          where: { id: professionalIdRaw, organizationId: service.organizationId, isActive: true },
          select: { id: true, priority: true },
        });
        if (!professional) {
          return jsonWrap({ ok: false, error: "Profissional inválido." }, { status: 404 });
        }
        professionalScopes = [professional];
      } else {
        if (allowedProfessionalIds && allowedProfessionalIds.length === 0) {
          return jsonWrap({ ok: false, error: "Sem profissionais disponíveis para este serviço." }, { status: 409 });
        }
        professionalScopes = await prisma.reservationProfessional.findMany({
          where: {
            organizationId: service.organizationId,
            isActive: true,
            ...(allowedProfessionalIds ? { id: { in: allowedProfessionalIds } } : {}),
          },
          orderBy: [{ priority: "asc" }, { id: "asc" }],
          select: { id: true, priority: true },
        });
      }
      if (professionalScopes.length === 0) {
        return jsonWrap({ ok: false, error: "Sem profissionais disponíveis para este serviço.", selectionRules }, { status: 409 });
      }

      if (allowedResourceIds && allowedResourceIds.length === 0) {
        return jsonWrap({ ok: false, error: "Sem recursos disponíveis para este serviço.", selectionRules }, { status: 409 });
      }
      resourceScopes = await prisma.reservationResource.findMany({
        where: {
          organizationId: service.organizationId,
          isActive: true,
          ...(partySize != null ? { capacity: { gte: partySize } } : {}),
          ...(assignmentConfig.isCourtService ? { courtId: { not: null } } : {}),
          ...(allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
        },
        orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
        select: { id: true, capacity: true, priority: true, courtId: true },
      });
      resourceScopes.forEach((resource) => {
        resourceCourtById.set(resource.id, resource.courtId ?? null);
      });
      if (resourceScopes.length === 0) {
        return jsonWrap({ ok: false, error: "Sem recursos disponíveis para esta capacidade.", selectionRules }, { status: 409 });
      }
      scopeIds = professionalScopes.map((professional) => professional.id);
    }

    if (availabilityMode !== "HYBRID" && scopeIds.length === 0) {
      return jsonWrap({ ok: false, error: "Sem disponibilidade para este serviço." }, { status: 409 });
    }

    const dateParts = getDateParts(startsAt, timezone);
    const dayStart = makeUtcDateFromLocal({ ...dateParts, hour: 0, minute: 0 }, timezone);
    const dayEnd = makeUtcDateFromLocal({ ...dateParts, hour: 23, minute: 59 }, timezone);
    const conflictWindowStart = getConflictWindowStart(dayStart);

    const bookingEndsAt = new Date(startsAt.getTime() + effectiveDurationMinutes * 60 * 1000);
    const professionalScopeIds =
      availabilityMode === "HYBRID"
        ? professionalScopes.map((professional) => professional.id)
        : availabilityMode === "PROFESSIONAL"
          ? scopeIds
          : [];
    const resourceScopeIds =
      availabilityMode === "HYBRID"
        ? resourceScopes.map((resource) => resource.id)
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
    const activeBookedStates = ["CONFIRMED", "DISPUTED", "NO_SHOW"] as const;
    const activePendingStates = ["PENDING_CONFIRMATION", "PENDING"] as const;
    const activeBookingStateFilter: Prisma.BookingWhereInput = {
      OR: [
        { status: { in: [...activeBookedStates] as any } },
        { status: { in: [...activePendingStates] as any }, pendingExpiresAt: { gt: now } },
      ],
    };
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
          AND: [scopedConflictFilter, activeBookingStateFilter],
        },
        select: { id: true, startsAt: true, durationMinutes: true, professionalId: true, resourceId: true },
      }),
      availabilityMode === "RESOURCE"
        ? Promise.resolve([])
        : prisma.classSession.findMany({
            where: {
              organizationId: service.organizationId,
              status: "SCHEDULED",
              startsAt: { lt: bookingEndsAt, gte: conflictWindowStart },
              endsAt: { gt: conflictWindowStart },
              ...(professionalScopeIds.length > 0 ? { professionalId: { in: professionalScopeIds } } : {}),
            },
            select: { id: true, startsAt: true, endsAt: true, professionalId: true },
          }),
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
    const blocks = [...buildBlocks(blockingBookings), ...buildSessionBlocks(classSessions)];
    const slotKey = startsAt.toISOString();

    let allowed = false;
    let lastDecision: Parameters<typeof buildAgendaConflictPayload>[0]["decision"] | null = null;

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
        return jsonWrap({ ok: false, error: "Horário indisponível.", selectionRules }, { status: 409 });
      }
      professionalId = pair.professionalId;
      resourceId = pair.resourceId;
      courtId = pair.courtId;

      const candidate: AgendaCandidate = {
        type: "BOOKING",
        sourceId: `booking:new:${service.id}:${startsAt.toISOString()}`,
        startsAt,
        endsAt: bookingEndsAt,
      };
      const professionalExisting: AgendaCandidate[] = blockingBookings
        .filter((booking) => booking.professionalId === professionalId)
        .map((booking) => ({
          type: "BOOKING",
          sourceId: String(booking.id),
          startsAt: booking.startsAt,
          endsAt: new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000),
        }));
      classSessions.forEach((session) => {
        if (session.professionalId !== professionalId) return;
        professionalExisting.push({
          type: "BOOKING",
          sourceId: `class:${session.id}`,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
        });
      });
      const resourceExisting: AgendaCandidate[] = blockingBookings
        .filter((booking) => booking.resourceId === resourceId)
        .map((booking) => ({
          type: "BOOKING",
          sourceId: String(booking.id),
          startsAt: booking.startsAt,
          endsAt: new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000),
        }));
      const professionalDecision = evaluateCandidate({ candidate, existing: professionalExisting });
      const resourceDecision = evaluateCandidate({ candidate, existing: resourceExisting });
      if (!professionalDecision.allowed) {
        lastDecision = professionalDecision;
      } else if (!resourceDecision.allowed) {
        lastDecision = resourceDecision;
      } else {
        allowed = true;
      }
    } else {
      const localScopeType: AvailabilityScopeType = availabilityMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
      const localScopeIds = availabilityMode === "RESOURCE" ? resourceScopeIds : professionalScopeIds;
      const scopesToCheck = localScopeIds.map((id) => ({ scopeType: localScopeType, scopeId: id }));
      let selectedScopeId: number | null = null;
      const slotIsAvailable = scopesToCheck.some((scope) => {
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
        const isAvailable = slots.some((slot) => slot.startsAt.toISOString() === slotKey);
        if (isAvailable) {
          selectedScopeId = scope.scopeId;
        }
        return isAvailable;
      });
      if (!slotIsAvailable || selectedScopeId == null) {
        return jsonWrap({ ok: false, error: "Horário indisponível.", selectionRules }, { status: 409 });
      }
      if (availabilityMode === "RESOURCE") {
        resourceId = selectedScopeId;
        courtId = assignmentConfig.isCourtService ? resourceCourtById.get(resourceId) ?? null : null;
      } else {
        professionalId = selectedScopeId;
      }

      const candidate: AgendaCandidate = {
        type: "BOOKING",
        sourceId: `booking:new:${service.id}:${startsAt.toISOString()}`,
        startsAt,
        endsAt: bookingEndsAt,
      };
      const existingByScope = new Map<number, AgendaCandidate[]>();
      localScopeIds.forEach((id) => existingByScope.set(id, []));
      blockingBookings.forEach((booking) => {
        const scopeId = localScopeType === "RESOURCE" ? booking.resourceId : booking.professionalId;
        if (!scopeId) return;
        const bucket = existingByScope.get(scopeId);
        if (!bucket) return;
        const end = new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000);
        bucket.push({
          type: "BOOKING",
          sourceId: String(booking.id),
          startsAt: booking.startsAt,
          endsAt: end,
        });
      });
      if (availabilityMode === "PROFESSIONAL") {
        classSessions.forEach((session) => {
          const scopeId = session.professionalId;
          if (!scopeId) return;
          const bucket = existingByScope.get(scopeId);
          if (!bucket) return;
          bucket.push({
            type: "BOOKING",
            sourceId: `class:${session.id}`,
            startsAt: session.startsAt,
            endsAt: session.endsAt,
          });
        });
      }
      for (const scopeId of localScopeIds) {
        const existing = existingByScope.get(scopeId) ?? [];
        const decision = evaluateCandidate({ candidate, existing });
        if (decision.allowed) {
          allowed = true;
          break;
        }
        lastDecision = decision;
      }
    }

    if (!allowed) {
      return jsonWrap(agendaConflictResponse(lastDecision), { status: 409 });
    }

    if (availabilityMode === "HYBRID" && (!professionalId || !resourceId)) {
      return jsonWrap(
        { ok: false, error: "SERVICE_CONFIG_INVALID", message: "Serviço híbrido sem par disponível.", selectionRules },
        { status: 409 },
      );
    }
    if (availabilityMode === "RESOURCE" && !resourceId) {
      return jsonWrap(
        { ok: false, error: "SERVICE_CONFIG_INVALID", message: "Serviço por recurso sem recurso disponível.", selectionRules },
        { status: 409 },
      );
    }
    if (availabilityMode === "PROFESSIONAL" && !professionalId) {
      return jsonWrap(
        { ok: false, error: "SERVICE_CONFIG_INVALID", message: "Serviço por profissional sem profissional disponível.", selectionRules },
        { status: 409 },
      );
    }

    if (availabilityMode === "RESOURCE" && resourceId && assignmentConfig.isCourtService) {
      if (!courtId) {
        const linkedResource = await prisma.reservationResource.findUnique({
          where: { id: resourceId },
          select: { courtId: true },
        });
        courtId = linkedResource?.courtId ?? null;
      }
      if (!courtId) {
        return jsonWrap(
          { ok: false, error: "SERVICE_CONFIG_INVALID", message: "Recurso sem ligação a campo.", selectionRules },
          { status: 409 },
        );
      }
    }

    if (availabilityMode === "HYBRID" && assignmentConfig.isCourtService && !courtId) {
      return jsonWrap(
        { ok: false, error: "SERVICE_CONFIG_INVALID", message: "Par híbrido sem ligação a campo.", selectionRules },
        { status: 409 },
      );
    }

    const pendingExpiresAt = new Date(now.getTime() + PENDING_HOLD_MINUTES * 60 * 1000);
    const resolvedAddressId =
      service.locationMode === "CHOOSE_AT_BOOKING"
        ? addressIdInput || null
        : service.addressId ?? service.organization?.addressId ?? null;
    if (service.locationMode === "CHOOSE_AT_BOOKING" && !resolvedAddressId) {
      return jsonWrap({ ok: false, error: "Morada obrigatória para esta marcação." }, { status: 400 });
    }
    if (resolvedAddressId) {
      const address = await prisma.address.findUnique({
        where: { id: resolvedAddressId },
        select: { sourceProvider: true },
      });
      if (!address) {
        return jsonWrap({ ok: false, error: "Morada inválida." }, { status: 400 });
      }
      if (address.sourceProvider !== AddressSourceProvider.APPLE_MAPS) {
        return jsonWrap({ ok: false, error: "Morada deve ser Apple Maps." }, { status: 400 });
      }
    }

    const { booking } = await prisma.$transaction(async (tx) => {
      const created = await createBooking({
        tx,
        organizationId: service.organizationId,
        actorUserId: user?.id ?? null,
        data: {
          serviceId: service.id,
          organizationId: service.organizationId,
          userId: user?.id ?? null,
          guestEmail: user ? null : guestEmailNormalized,
          guestName: user ? null : guestNameRaw || null,
          guestPhone: user ? null : guestPhone || null,
          startsAt,
          durationMinutes: effectiveDurationMinutes,
          price: effectivePriceCents,
          currency: service.currency,
          status: "PENDING_CONFIRMATION",
          assignmentMode: bookingAssignmentMode,
          professionalId,
          resourceId,
          courtId,
          partySize,
          pendingExpiresAt,
          snapshotTimezone: timezone,
          locationMode: service.locationMode,
          addressId: resolvedAddressId,
        },
        select: { id: true, status: true, pendingExpiresAt: true },
      });

      if (packageResolution.ok && packageResolution.package) {
        await tx.bookingPackage.create({
          data: {
            bookingId: created.booking.id,
            packageId: packageResolution.package.packageId,
            label: packageResolution.package.label,
            durationMinutes: packageResolution.package.durationMinutes,
            priceCents: packageResolution.package.priceCents,
          },
        });
      }

      if (addonResolution.ok && addonResolution.addons.length > 0) {
        await tx.bookingAddon.createMany({
          data: addonResolution.addons.map((addon) => ({
            bookingId: created.booking.id,
            addonId: addon.addonId,
            label: addon.label,
            deltaMinutes: addon.deltaMinutes,
            deltaPriceCents: addon.deltaPriceCents,
            quantity: addon.quantity,
            sortOrder: addon.sortOrder,
          })),
        });
      }

      return created;
    });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: service.organizationId,
      actorUserId: user?.id ?? null,
      action: "BOOKING_PENDING_CREATED",
      metadata: {
        bookingId: booking.id,
        serviceId: service.id,
        startsAt: startsAt.toISOString(),
        package: packageResolution.ok && packageResolution.package
          ? {
              packageId: packageResolution.package.packageId,
              label: packageResolution.package.label,
              durationMinutes: packageResolution.package.durationMinutes,
              priceCents: packageResolution.package.priceCents,
            }
          : null,
        addons: addonResolution.ok
          ? addonResolution.addons.map((addon) => ({
              addonId: addon.addonId,
              label: addon.label,
              quantity: addon.quantity,
              deltaMinutes: addon.deltaMinutes,
              deltaPriceCents: addon.deltaPriceCents,
            }))
          : [],
      },
      ip,
      userAgent,
    });

    return jsonWrap({ ok: true, booking, selectionRules });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/servicos/[id]/reservar error:", err);
    return jsonWrap({ ok: false, error: "Erro ao reservar." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
