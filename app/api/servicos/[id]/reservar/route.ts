export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { AddressSourceProvider } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isUnauthenticatedError } from "@/lib/security";
import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { getAvailableSlotsForScope } from "@/lib/reservas/availabilitySelect";
import { groupByScope, type AvailabilityScopeType, type ScopedOverride, type ScopedTemplate } from "@/lib/reservas/scopedAvailability";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { getResourceModeBlockedPayload, resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";
import { evaluateCandidate, type AgendaCandidate } from "@/domain/agenda/conflictEngine";
import { buildAgendaConflictPayload } from "@/domain/agenda/conflictResponse";
import { createBooking } from "@/domain/bookings/commands";
import { applyAddonTotals, normalizeAddonSelection, resolveServiceAddonSelection } from "@/lib/reservas/serviceAddons";
import { applyPackageBase, parsePackageId, resolveServicePackageSelection } from "@/lib/reservas/servicePackages";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { normalizeEmail } from "@/lib/utils/email";
import { isValidPhone, normalizePhone } from "@/lib/phone";

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const PENDING_HOLD_MINUTES = 10;
const MAX_PENDING_PER_USER = 3;
const SLOT_STEP_MINUTES = 15;

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

function getMinutesOfDay(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const map = new Map(parts.map((p) => [p.type, p.value]));
  const hour = Number(map.get("hour"));
  const minute = Number(map.get("minute"));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function parsePositiveInt(value: unknown) {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user ?? null;
    const payload = await req.json().catch(() => ({}));
    const guestInput = payload?.guest ?? null;
    const guestEmailRaw = typeof guestInput?.email === "string" ? guestInput.email.trim() : "";
    const guestNameRaw = typeof guestInput?.name === "string" ? guestInput.name.trim() : "";
    const guestPhoneRaw = typeof guestInput?.phone === "string" ? guestInput.phone.trim() : "";
    const guestEmailNormalized = normalizeEmail(guestEmailRaw);
    const guestEmail = guestEmailRaw && EMAIL_REGEX.test(guestEmailRaw) ? guestEmailRaw : "";
    const guestPhone = guestPhoneRaw ? normalizePhone(guestPhoneRaw) : "";
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

    const assignmentConfig = resolveServiceAssignmentMode({
      organizationMode: service.organization?.reservationAssignmentMode ?? null,
      serviceKind: service.kind,
    });

    const timezone = service.organization?.timezone || "Europe/Lisbon";
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
    if (packageId) {
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
    const effectiveDurationMinutes = totals.durationMinutes;
    const effectivePriceCents = totals.priceCents;

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
    const minutesOfDay = getMinutesOfDay(startsAt, timezone);
    if (minutesOfDay == null || minutesOfDay % SLOT_STEP_MINUTES !== 0) {
      return jsonWrap({ ok: false, error: "Horário fora da grelha de 15 minutos." }, { status: 400 });
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

    const assignmentMode = assignmentConfig.mode;
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
    let professionalId: number | null = null;
    let partySize: number | null = null;
    const scopeType: AvailabilityScopeType = assignmentMode === "RESOURCE" ? "RESOURCE" : "PROFESSIONAL";
    let scopeIds: number[] = [];

    if (!assignmentConfig.isCourtService && partySizeRaw) {
      return jsonWrap(getResourceModeBlockedPayload(), { status: 409 });
    }

    if (assignmentMode === "RESOURCE") {
      if (!partySizeRaw) {
        return jsonWrap({ ok: false, error: "Capacidade obrigatória." }, { status: 400 });
      }
      if (allowedResourceIds && allowedResourceIds.length === 0) {
        return jsonWrap({ ok: false, error: "Sem recursos disponíveis para este serviço." }, { status: 409 });
      }
      partySize = partySizeRaw;
      const resources = await prisma.reservationResource.findMany({
        where: {
          organizationId: service.organizationId,
          isActive: true,
          capacity: { gte: partySize },
          ...(allowedResourceIds ? { id: { in: allowedResourceIds } } : {}),
        },
        orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      scopeIds = resources.map((resource) => resource.id);
      if (scopeIds.length === 0) {
        return jsonWrap({ ok: false, error: "Sem recursos disponíveis para esta capacidade." }, { status: 409 });
      }
    } else {
      if (professionalIdRaw) {
        if (allowedProfessionalIds && !allowedProfessionalIds.includes(professionalIdRaw)) {
          return jsonWrap({ ok: false, error: "Profissional indisponível." }, { status: 404 });
        }
        const professional = await prisma.reservationProfessional.findFirst({
          where: { id: professionalIdRaw, organizationId: service.organizationId, isActive: true },
          select: { id: true },
        });
        if (!professional) {
          return jsonWrap({ ok: false, error: "Profissional inválido." }, { status: 404 });
        }
        professionalId = professional.id;
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
          select: { id: true },
        });
        scopeIds = professionals.map((professional) => professional.id);
      }
    }

    if (scopeIds.length === 0) {
      return jsonWrap({ ok: false, error: "Sem disponibilidade para este serviço." }, { status: 409 });
    }

    const dateParts = getDateParts(startsAt, timezone);
    const dayStart = makeUtcDateFromLocal({ ...dateParts, hour: 0, minute: 0 }, timezone);
    const dayEnd = makeUtcDateFromLocal({ ...dateParts, hour: 23, minute: 59 }, timezone);

    const shouldUseOrgOnly = false;
    const bookingEndsAt = new Date(startsAt.getTime() + effectiveDurationMinutes * 60 * 1000);
    const [templates, overrides, blockingBookings, softBlocks, classSessions] = await Promise.all([
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
      prisma.softBlock.findMany({
        where: {
          organizationId: service.organizationId,
          startsAt: { lt: bookingEndsAt },
          endsAt: { gt: startsAt },
          OR: [
            { scopeType: "ORGANIZATION" },
            ...(scopeIds.length > 0 ? [{ scopeType, scopeId: { in: scopeIds } }] : []),
          ],
        },
        select: { id: true, scopeType: true, scopeId: true, startsAt: true, endsAt: true },
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
    const scopesToCheck = shouldUseOrgOnly ? [{ scopeType: "ORGANIZATION" as const, scopeId: 0 }] : scopeIds.map((id) => ({ scopeType, scopeId: id }));
    const slotIsAvailable = scopesToCheck.some((scope) => {
      const slots = getAvailableSlotsForScope({
        rangeStart: dayStart,
        rangeEnd: dayEnd,
        timezone,
        durationMinutes: effectiveDurationMinutes,
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
      return slots.some((slot) => slot.startsAt.toISOString() === slotKey);
    });

    if (!slotIsAvailable) {
      return jsonWrap({ ok: false, error: "Horário indisponível." }, { status: 409 });
    }

    if (scopeIds.length === 0) {
      return jsonWrap(agendaConflictResponse(), { status: 503 });
    }

    const candidate: AgendaCandidate = {
      type: "BOOKING",
      sourceId: `booking:new:${service.id}:${startsAt.toISOString()}`,
      startsAt,
      endsAt: bookingEndsAt,
    };
    const existingByScope = new Map<number, AgendaCandidate[]>();
    scopeIds.forEach((id) => existingByScope.set(id, []));
    blockingBookings.forEach((booking) => {
      const scopeId = scopeType === "RESOURCE" ? booking.resourceId : booking.professionalId;
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
    softBlocks.forEach((block) => {
      if (block.scopeType === "ORGANIZATION") {
        scopeIds.forEach((scopeId) => {
          const bucket = existingByScope.get(scopeId);
          if (!bucket) return;
          bucket.push({
            type: "SOFT_BLOCK",
            sourceId: String(block.id),
            startsAt: block.startsAt,
            endsAt: block.endsAt,
          });
        });
        return;
      }
      const scopeId = block.scopeId ?? null;
      if (!scopeId) return;
      const bucket = existingByScope.get(scopeId);
      if (!bucket) return;
      bucket.push({
        type: "SOFT_BLOCK",
        sourceId: String(block.id),
        startsAt: block.startsAt,
        endsAt: block.endsAt,
      });
    });
    classSessions.forEach((session) => {
      const scopeId = scopeType === "RESOURCE" ? null : session.professionalId;
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

    let allowed = false;
    let lastDecision: Parameters<typeof buildAgendaConflictPayload>[0]["decision"] | null = null;
    for (const scopeId of scopeIds) {
      const existing = existingByScope.get(scopeId) ?? [];
      const decision = evaluateCandidate({ candidate, existing });
      if (decision.allowed) {
        allowed = true;
        break;
      }
      lastDecision = decision;
    }

    if (!allowed) {
      return jsonWrap(agendaConflictResponse(lastDecision), { status: 409 });
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
          assignmentMode,
          professionalId,
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

    return jsonWrap({ ok: true, booking });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/servicos/[id]/reservar error:", err);
    return jsonWrap({ ok: false, error: "Erro ao reservar." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
