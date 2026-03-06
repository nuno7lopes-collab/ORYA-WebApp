import { NextRequest } from "next/server";
import { ServiceKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { academyFail, resolveAcademyOrgAccess } from "@/lib/academy/apiAccess";
import { ensureOrganizationWriteAccess } from "@/lib/organizationWriteAccess";
import { respondOk } from "@/lib/http/envelope";
import { buildClassSessionsForSeries } from "@/lib/reservas/classSeries";
import { makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { getOrganizationBookingPolicy, validateStartMinuteAgainstPolicy } from "@/lib/reservas/gridPolicy";
import { validateClassSessionsAgainstAvailability } from "@/lib/reservas/classSeriesAvailability";
import { assertTrainerIdsBelongToEligibleTeamMembers } from "@/lib/academy/trainerTeamGuards";
import { loadActiveEventClaimBlocks } from "@/lib/reservas/eventClaims";
import { cancelClassSessionEnrollmentsAndBookings } from "@/lib/academy/classEnrollmentService";

const MINUTES_PER_DAY = 24 * 60;

function parseClassId(raw: string) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function parseSeriesId(raw: string) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function parseDateParts(raw: unknown) {
  if (typeof raw !== "string") return null;
  const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return { year, month, day };
}

function normalizeDayOfWeek(raw: unknown) {
  if (raw == null) return null;
  const value = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  const day = Number.isFinite(value) ? Math.floor(value) : NaN;
  return day >= 0 && day <= 6 ? day : null;
}

function normalizeStartMinute(raw: unknown) {
  if (raw == null) return null;
  const value = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  const minute = Number.isFinite(value) ? Math.round(value) : NaN;
  if (!Number.isFinite(minute)) return null;
  if (minute < 0 || minute >= MINUTES_PER_DAY) return null;
  return minute;
}

function normalizeDuration(raw: unknown) {
  if (raw == null) return null;
  const value = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  const minutes = Number.isFinite(value) ? Math.round(value) : NaN;
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return minutes;
}

function normalizeCapacity(raw: unknown) {
  if (raw == null) return null;
  const value = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  const capacity = Number.isFinite(value) ? Math.floor(value) : NaN;
  if (!Number.isFinite(capacity) || capacity <= 0) return null;
  return capacity;
}

function parseDateParam(raw: string | null) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function rangesOverlap(params: {
  startsAt: Date;
  endsAt: Date;
  otherStartsAt: Date;
  otherEndsAt: Date;
}) {
  return params.startsAt < params.otherEndsAt && params.endsAt > params.otherStartsAt;
}

async function validateClassSessionsAgainstRealConflicts(params: {
  organizationId: number;
  sessions: Array<{ startsAt: Date; endsAt: Date }>;
  professionalId: number | null;
  courtId: number | null;
  excludeSeriesId?: number | null;
}) {
  if (!params.sessions.length) return { ok: true as const };
  if (!params.professionalId && !params.courtId) return { ok: true as const };

  const now = new Date();
  const rangeStart = new Date(
    Math.min(...params.sessions.map((session) => session.startsAt.getTime())),
  );
  const rangeEnd = new Date(
    Math.max(...params.sessions.map((session) => session.endsAt.getTime())),
  );
  const bookingQueryStart = new Date(rangeStart.getTime() - 6 * 60 * 60 * 1000);

  const [overlappingBookings, overlappingClassSessions, eventClaims] = await Promise.all([
    prisma.booking.findMany({
      where: {
        organizationId: params.organizationId,
        startsAt: { lt: rangeEnd, gte: bookingQueryStart },
        AND: [
          {
            OR: [
              { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] as any } },
              { status: { in: ["PENDING_CONFIRMATION", "PENDING"] as any }, pendingExpiresAt: { gt: now }, startsAt: { gt: now } },
            ],
          },
          {
            OR: [
              ...(params.professionalId ? [{ professionalId: params.professionalId }] : []),
              ...(params.courtId ? [{ courtId: params.courtId }] : []),
            ],
          },
        ],
      },
      select: {
        id: true,
        startsAt: true,
        durationMinutes: true,
        professionalId: true,
        courtId: true,
      },
    }),
    prisma.classSession.findMany({
      where: {
        organizationId: params.organizationId,
        status: "SCHEDULED",
        startsAt: { lt: rangeEnd },
        endsAt: { gt: rangeStart },
        OR: [
          ...(params.professionalId ? [{ professionalId: params.professionalId }] : []),
          ...(params.courtId ? [{ courtId: params.courtId }] : []),
        ],
        ...(params.excludeSeriesId ? { seriesId: { not: params.excludeSeriesId } } : {}),
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        professionalId: true,
        courtId: true,
      },
    }),
    loadActiveEventClaimBlocks({
      tx: prisma as any,
      organizationId: params.organizationId,
      rangeStart,
      rangeEnd,
      professionalIds: params.professionalId ? [params.professionalId] : [],
      courtIds: params.courtId ? [params.courtId] : [],
      resourceIds: [],
    }),
  ]);

  for (const session of params.sessions) {
    const bookingConflict = overlappingBookings.find((booking) => {
      const bookingEndsAt = new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000);
      if (!rangesOverlap({ startsAt: session.startsAt, endsAt: session.endsAt, otherStartsAt: booking.startsAt, otherEndsAt: bookingEndsAt })) {
        return false;
      }
      if (params.professionalId && booking.professionalId === params.professionalId) return true;
      if (params.courtId && booking.courtId === params.courtId) return true;
      return false;
    });
    if (bookingConflict) {
      return {
        ok: false as const,
        conflict: {
          reason: "booking_conflict",
          bookingId: bookingConflict.id,
          startsAt: bookingConflict.startsAt,
        },
      };
    }

    const classConflict = overlappingClassSessions.find((existingSession) => {
      if (!rangesOverlap({
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        otherStartsAt: existingSession.startsAt,
        otherEndsAt: existingSession.endsAt,
      })) {
        return false;
      }
      if (params.professionalId && existingSession.professionalId === params.professionalId) return true;
      if (params.courtId && existingSession.courtId === params.courtId) return true;
      return false;
    });
    if (classConflict) {
      return {
        ok: false as const,
        conflict: {
          reason: "class_session_conflict",
          classSessionId: classConflict.id,
          startsAt: classConflict.startsAt,
        },
      };
    }

    const eventConflict = eventClaims.find((claim) => {
      if (!rangesOverlap({
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        otherStartsAt: claim.startsAt,
        otherEndsAt: claim.endsAt,
      })) {
        return false;
      }
      if (params.professionalId && claim.professionalId === params.professionalId) return true;
      if (params.courtId && claim.courtId === params.courtId) return true;
      return false;
    });
    if (eventConflict) {
      return {
        ok: false as const,
        conflict: {
          reason: "event_claim_conflict",
          claimSourceId: eventConflict.sourceId,
          startsAt: eventConflict.startsAt,
        },
      };
    }
  }

  return { ok: true as const };
}

async function ensureClassService(params: { organizationId: number; classId: number }) {
  const service = await prisma.service.findFirst({
    where: {
      id: params.classId,
      organizationId: params.organizationId,
      kind: ServiceKind.CLASS,
    },
    select: {
      id: true,
      kind: true,
      organization: { select: { timezone: true } },
    },
  });
  return service;
}

async function ensureWriteAccess(req: NextRequest) {
  const access = await resolveAcademyOrgAccess(req);
  if (!access.ok) return access;

  const writeAccess = ensureOrganizationWriteAccess(access.organization, {
    requireStripeForServices: false,
    skipEmailGate: true,
  });
  if (!writeAccess.ok) {
    return {
      ok: false as const,
      response: academyFail(
        access.ctx,
        403,
        String(writeAccess.errorCode ?? "FORBIDDEN"),
        String(writeAccess.errorCode ?? "Sem permissões."),
      ),
      ctx: access.ctx,
    };
  }

  return access;
}

export async function handleAcademyClassSeriesGet(req: NextRequest, classIdRaw: string) {
  const access = await resolveAcademyOrgAccess(req);
  if (!access.ok) return access.response;

  const classId = parseClassId(classIdRaw);
  if (!classId) return academyFail(access.ctx, 400, "BAD_REQUEST", "Aula inválida.");

  const service = await ensureClassService({
    organizationId: access.organization.id,
    classId,
  });
  if (!service) return academyFail(access.ctx, 404, "NOT_FOUND", "Aula não encontrada.");

  const items = await prisma.classSeries.findMany({
    where: { serviceId: classId, organizationId: access.organization.id },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: {
      professional: { select: { id: true, name: true } },
      court: { select: { id: true, name: true, isActive: true } },
      _count: { select: { sessions: true } },
    },
  });

  return respondOk(access.ctx, { items });
}

export async function handleAcademyClassSeriesPost(req: NextRequest, classIdRaw: string) {
  const access = await ensureWriteAccess(req);
  if (!access.ok) return access.response;

  const classId = parseClassId(classIdRaw);
  if (!classId) return academyFail(access.ctx, 400, "BAD_REQUEST", "Aula inválida.");

  const service = await ensureClassService({
    organizationId: access.organization.id,
    classId,
  });
  if (!service) return academyFail(access.ctx, 404, "NOT_FOUND", "Aula não encontrada.");

  const payload = await req.json().catch(() => ({}));
  const dayOfWeek = normalizeDayOfWeek(payload?.dayOfWeek);
  const startMinute = normalizeStartMinute(payload?.startMinute);
  const durationMinutes = normalizeDuration(payload?.durationMinutes ?? payload?.duration);
  const capacity = normalizeCapacity(payload?.capacity ?? 1);
  const validFromParts = parseDateParts(payload?.validFrom);
  const validUntilParts = payload?.validUntil ? parseDateParts(payload.validUntil) : null;
  const isActive = typeof payload?.isActive === "boolean" ? payload.isActive : true;

  if (dayOfWeek == null || startMinute == null || !durationMinutes || !capacity || !validFromParts) {
    return academyFail(access.ctx, 400, "BAD_REQUEST", "Dados inválidos.");
  }

  const bookingPolicy = await getOrganizationBookingPolicy({
    organizationId: access.organization.id,
    tx: prisma,
  });
  const startMinuteValidation = validateStartMinuteAgainstPolicy({ startMinute, policy: bookingPolicy });
  if (!startMinuteValidation.ok) {
    return academyFail(
      access.ctx,
      400,
      startMinuteValidation.errorCode ?? "BAD_REQUEST",
      startMinuteValidation.message,
    );
  }

  const timezone = service.organization?.timezone || "Europe/Lisbon";
  const validFrom = makeUtcDateFromLocal(
    { year: validFromParts.year, month: validFromParts.month, day: validFromParts.day, hour: 0, minute: 0 },
    timezone,
  );
  const validUntil = validUntilParts
    ? makeUtcDateFromLocal(
        { year: validUntilParts.year, month: validUntilParts.month, day: validUntilParts.day, hour: 0, minute: 0 },
        timezone,
      )
    : null;

  if (validUntil && validUntil.getTime() < validFrom.getTime()) {
    return academyFail(access.ctx, 400, "BAD_REQUEST", "Validade final anterior à inicial.");
  }

  const hasProfessionalIdInput = Object.prototype.hasOwnProperty.call(payload ?? {}, "professionalId");
  const hasCourtIdInput = Object.prototype.hasOwnProperty.call(payload ?? {}, "courtId");
  let professionalId: number | null = null;
  let courtId: number | null = null;
  let resourceScopeId: number | null = null;

  if (hasProfessionalIdInput) {
    if (payload?.professionalId == null || payload?.professionalId === "") {
      professionalId = null;
    } else if (typeof payload?.professionalId === "number" && Number.isFinite(payload.professionalId) && payload.professionalId > 0) {
      professionalId = Math.trunc(payload.professionalId);
    } else {
      return academyFail(access.ctx, 400, "BAD_REQUEST", "Treinador inválido.");
    }
  }

  if (hasCourtIdInput) {
    if (payload?.courtId == null || payload?.courtId === "") {
      courtId = null;
    } else if (typeof payload?.courtId === "number" && Number.isFinite(payload.courtId) && payload.courtId > 0) {
      courtId = Math.trunc(payload.courtId);
    } else {
      return academyFail(access.ctx, 400, "BAD_REQUEST", "Campo inválido.");
    }
  }

  if (professionalId) {
    const trainerValidation = await assertTrainerIdsBelongToEligibleTeamMembers({
      organizationId: access.organization.id,
      professionalIds: [professionalId],
    });
    if (!trainerValidation.ok) {
      return academyFail(
        access.ctx,
        409,
        "TRAINER_NOT_TEAM_MEMBER",
        "Treinador inválido: só membros ativos da Equipa podem ser associados a séries.",
        { invalidProfessionalIds: trainerValidation.invalidProfessionalIds },
      );
    }
  }

  if (courtId) {
    const court = await prisma.padelClubCourt.findFirst({
      where: { id: courtId, club: { organizationId: access.organization.id }, deletedAt: null },
      select: { id: true, reservationResource: { select: { id: true } } },
    });
    if (!court) return academyFail(access.ctx, 404, "NOT_FOUND", "Campo inválido.");
    resourceScopeId = court.reservationResource?.id ?? null;
  }

  const sessions = isActive
    ? buildClassSessionsForSeries({
        timezone,
        dayOfWeek,
        startMinute,
        durationMinutes,
        validFrom,
        validUntil,
        limitYears: 2,
        startFromToday: true,
      })
    : [];

  if (isActive && sessions.length > 0) {
    const availabilityValidation = await validateClassSessionsAgainstAvailability({
      tx: prisma,
      organizationId: access.organization.id,
      timezone,
      sessions: sessions.map((session) => ({ startsAt: session.startsAt, endsAt: session.endsAt })),
      professionalId,
      resourceScopeId,
      stepMinutes: bookingPolicy.gridMinutes,
    });
    if (!availabilityValidation.ok) {
      return academyFail(
        access.ctx,
        409,
        "CLASS_SLOT_UNAVAILABLE",
        "Sessão fora da disponibilidade.",
        availabilityValidation.conflict,
      );
    }

    const conflictValidation = await validateClassSessionsAgainstRealConflicts({
      organizationId: access.organization.id,
      sessions: sessions.map((session) => ({ startsAt: session.startsAt, endsAt: session.endsAt })),
      professionalId,
      courtId,
    });
    if (!conflictValidation.ok) {
      return academyFail(
        access.ctx,
        409,
        "CLASS_SLOT_CONFLICT",
        "Conflito com agenda existente de treinador/campo.",
        conflictValidation.conflict,
      );
    }
  }

  const series = await prisma.$transaction(async (tx) => {
    const createdSeries = await tx.classSeries.create({
      data: {
        organizationId: access.organization.id,
        serviceId: service.id,
        courtId: courtId ?? null,
        professionalId: professionalId ?? null,
        dayOfWeek,
        startMinute,
        durationMinutes,
        capacity,
        validFrom,
        validUntil,
        isActive,
      },
    });

    if (isActive && sessions.length > 0) {
      await tx.classSession.createMany({
        data: sessions.map((session) => ({
          seriesId: createdSeries.id,
          organizationId: access.organization.id,
          serviceId: service.id,
          courtId: courtId ?? null,
          professionalId: professionalId ?? null,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          capacity,
          status: "SCHEDULED",
        })),
        skipDuplicates: true,
      });
    }
    return createdSeries;
  });

  return respondOk(access.ctx, { series });
}

export async function handleAcademyClassSeriesPatch(
  req: NextRequest,
  classIdRaw: string,
  seriesIdRaw: string,
) {
  const access = await ensureWriteAccess(req);
  if (!access.ok) return access.response;

  const classId = parseClassId(classIdRaw);
  const seriesId = parseSeriesId(seriesIdRaw);
  if (!classId || !seriesId) return academyFail(access.ctx, 400, "BAD_REQUEST", "Série inválida.");

  const series = await prisma.classSeries.findFirst({
    where: { id: seriesId, serviceId: classId, organizationId: access.organization.id },
    include: { service: { select: { kind: true, organization: { select: { timezone: true } } } } },
  });
  if (!series) return academyFail(access.ctx, 404, "NOT_FOUND", "Série não encontrada.");
  if (series.service.kind !== ServiceKind.CLASS) {
    return academyFail(access.ctx, 409, "CONFLICT", "Serviço não suporta aulas recorrentes.");
  }

  const payload = await req.json().catch(() => ({}));
  const dayOfWeek = normalizeDayOfWeek(payload?.dayOfWeek) ?? series.dayOfWeek;
  const startMinute = normalizeStartMinute(payload?.startMinute) ?? series.startMinute;
  const durationMinutes = normalizeDuration(payload?.durationMinutes ?? payload?.duration) ?? series.durationMinutes;
  const capacity = normalizeCapacity(payload?.capacity) ?? series.capacity;

  const validFromParts = payload?.validFrom ? parseDateParts(payload.validFrom) : null;
  const validUntilInput = payload?.validUntil;
  const validUntilParts = validUntilInput ? parseDateParts(validUntilInput) : null;

  const timezone = series.service.organization?.timezone || "Europe/Lisbon";
  const bookingPolicy = await getOrganizationBookingPolicy({
    organizationId: access.organization.id,
    tx: prisma,
  });
  const startMinuteValidation = validateStartMinuteAgainstPolicy({ startMinute, policy: bookingPolicy });
  if (!startMinuteValidation.ok) {
    return academyFail(
      access.ctx,
      400,
      startMinuteValidation.errorCode ?? "BAD_REQUEST",
      startMinuteValidation.message,
    );
  }

  const validFrom = validFromParts
    ? makeUtcDateFromLocal(
        { year: validFromParts.year, month: validFromParts.month, day: validFromParts.day, hour: 0, minute: 0 },
        timezone,
      )
    : series.validFrom;
  const shouldClearValidUntil = validUntilInput === null || validUntilInput === "";
  const validUntil = shouldClearValidUntil
    ? null
    : validUntilParts
      ? makeUtcDateFromLocal(
          { year: validUntilParts.year, month: validUntilParts.month, day: validUntilParts.day, hour: 0, minute: 0 },
          timezone,
        )
      : series.validUntil;
  if (validUntil && validUntil.getTime() < validFrom.getTime()) {
    return academyFail(access.ctx, 400, "BAD_REQUEST", "Validade final anterior à inicial.");
  }

  const hasProfessionalIdInput = Object.prototype.hasOwnProperty.call(payload ?? {}, "professionalId");
  const hasCourtIdInput = Object.prototype.hasOwnProperty.call(payload ?? {}, "courtId");
  let professionalId: number | null = series.professionalId ?? null;
  let courtId: number | null = series.courtId ?? null;
  let resourceScopeId: number | null = null;

  if (hasProfessionalIdInput) {
    if (payload?.professionalId == null || payload?.professionalId === "") {
      professionalId = null;
    } else if (typeof payload?.professionalId === "number" && Number.isFinite(payload.professionalId) && payload.professionalId > 0) {
      professionalId = Math.trunc(payload.professionalId);
    } else {
      return academyFail(access.ctx, 400, "BAD_REQUEST", "Treinador inválido.");
    }
  }

  if (hasCourtIdInput) {
    if (payload?.courtId == null || payload?.courtId === "") {
      courtId = null;
    } else if (typeof payload?.courtId === "number" && Number.isFinite(payload.courtId) && payload.courtId > 0) {
      courtId = Math.trunc(payload.courtId);
    } else {
      return academyFail(access.ctx, 400, "BAD_REQUEST", "Campo inválido.");
    }
  }

  if (professionalId != null) {
    const trainerValidation = await assertTrainerIdsBelongToEligibleTeamMembers({
      organizationId: access.organization.id,
      professionalIds: [professionalId],
    });
    if (!trainerValidation.ok) {
      return academyFail(
        access.ctx,
        409,
        "TRAINER_NOT_TEAM_MEMBER",
        "Treinador inválido: só membros ativos da Equipa podem ser associados a séries.",
        { invalidProfessionalIds: trainerValidation.invalidProfessionalIds },
      );
    }
  }

  if (courtId != null) {
    const court = await prisma.padelClubCourt.findFirst({
      where: { id: courtId, club: { organizationId: access.organization.id }, deletedAt: null },
      select: { id: true, reservationResource: { select: { id: true } } },
    });
    if (!court) return academyFail(access.ctx, 404, "NOT_FOUND", "Campo inválido.");
    resourceScopeId = court.reservationResource?.id ?? null;
  }

  const isActive = typeof payload?.isActive === "boolean" ? payload.isActive : series.isActive;
  const generatedSessions = isActive
    ? buildClassSessionsForSeries({
        timezone,
        dayOfWeek,
        startMinute,
        durationMinutes,
        validFrom,
        validUntil,
        limitYears: 2,
        startFromToday: true,
      })
    : [];
  if (isActive && generatedSessions.length > 0) {
    const availabilityValidation = await validateClassSessionsAgainstAvailability({
      tx: prisma,
      organizationId: access.organization.id,
      timezone,
      sessions: generatedSessions.map((session) => ({ startsAt: session.startsAt, endsAt: session.endsAt })),
      professionalId,
      resourceScopeId,
      stepMinutes: bookingPolicy.gridMinutes,
    });
    if (!availabilityValidation.ok) {
      return academyFail(
        access.ctx,
        409,
        "CLASS_SLOT_UNAVAILABLE",
        "Sessão fora da disponibilidade.",
        availabilityValidation.conflict,
      );
    }

    const conflictValidation = await validateClassSessionsAgainstRealConflicts({
      organizationId: access.organization.id,
      sessions: generatedSessions.map((session) => ({ startsAt: session.startsAt, endsAt: session.endsAt })),
      professionalId,
      courtId,
      excludeSeriesId: series.id,
    });
    if (!conflictValidation.ok) {
      return academyFail(
        access.ctx,
        409,
        "CLASS_SLOT_CONFLICT",
        "Conflito com agenda existente de treinador/campo.",
        conflictValidation.conflict,
      );
    }
  }
  const now = new Date();

  const updatedSeries = await prisma.$transaction(async (tx) => {
    const savedSeries = await tx.classSeries.update({
      where: { id: series.id },
      data: {
        dayOfWeek,
        startMinute,
        durationMinutes,
        capacity,
        validFrom,
        validUntil,
        professionalId,
        courtId,
        isActive,
      },
    });

    if (!isActive) {
      const sessionsToCancel = await tx.classSession.findMany({
        where: { seriesId: series.id, startsAt: { gte: now }, status: "SCHEDULED" },
        select: { id: true },
      });
      await tx.classSession.updateMany({
        where: { seriesId: series.id, startsAt: { gte: now }, status: "SCHEDULED" },
        data: { status: "CANCELLED" },
      });
      if (sessionsToCancel.length > 0) {
        await cancelClassSessionEnrollmentsAndBookings({
          tx,
          organizationId: access.organization.id,
          sessionIds: sessionsToCancel.map((session) => session.id),
          actorUserId: access.profile.id,
        });
      }
      return savedSeries;
    }

    const desiredMap = new Map<number, { startsAt: Date; endsAt: Date }>();
    generatedSessions.forEach((session) => desiredMap.set(session.startsAt.getTime(), session));

    const existingSessions = await tx.classSession.findMany({
      where: { seriesId: series.id, startsAt: { gte: now } },
      select: { id: true, startsAt: true },
    });
    const existingTimes = new Set(existingSessions.map((session) => session.startsAt.getTime()));

    const sessionsToCancel = existingSessions
      .filter((session) => !desiredMap.has(session.startsAt.getTime()))
      .map((session) => session.id);

    if (sessionsToCancel.length > 0) {
      await tx.classSession.updateMany({
        where: { id: { in: sessionsToCancel } },
        data: { status: "CANCELLED" },
      });
      await cancelClassSessionEnrollmentsAndBookings({
        tx,
        organizationId: access.organization.id,
        sessionIds: sessionsToCancel,
        actorUserId: access.profile.id,
      });
    }

    const sessionsToUpdate = existingSessions.filter((session) =>
      desiredMap.has(session.startsAt.getTime()),
    );
    await Promise.all(
      sessionsToUpdate.map((session) => {
        const desired = desiredMap.get(session.startsAt.getTime());
        return tx.classSession.update({
          where: { id: session.id },
          data: {
            endsAt: desired?.endsAt ?? session.startsAt,
            capacity,
            courtId,
            professionalId,
            status: "SCHEDULED",
          },
        });
      }),
    );

    const newSessions = generatedSessions.filter((session) => !existingTimes.has(session.startsAt.getTime()));
    if (newSessions.length > 0) {
      await tx.classSession.createMany({
        data: newSessions.map((session) => ({
          seriesId: series.id,
          organizationId: access.organization.id,
          serviceId: classId,
          courtId,
          professionalId,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          capacity,
          status: "SCHEDULED",
        })),
        skipDuplicates: true,
      });
    }

    return savedSeries;
  });

  return respondOk(access.ctx, { series: updatedSeries });
}

export async function handleAcademyClassSeriesDelete(
  req: NextRequest,
  classIdRaw: string,
  seriesIdRaw: string,
) {
  const access = await ensureWriteAccess(req);
  if (!access.ok) return access.response;

  const classId = parseClassId(classIdRaw);
  const seriesId = parseSeriesId(seriesIdRaw);
  if (!classId || !seriesId) return academyFail(access.ctx, 400, "BAD_REQUEST", "Série inválida.");

  const series = await prisma.classSeries.findFirst({
    where: { id: seriesId, serviceId: classId, organizationId: access.organization.id },
    select: { id: true },
  });
  if (!series) return academyFail(access.ctx, 404, "NOT_FOUND", "Série não encontrada.");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.classSeries.update({ where: { id: series.id }, data: { isActive: false } });
    const sessionsToCancel = await tx.classSession.findMany({
      where: { seriesId: series.id, startsAt: { gte: now }, status: "SCHEDULED" },
      select: { id: true },
    });
    await tx.classSession.updateMany({
      where: { seriesId: series.id, startsAt: { gte: now }, status: "SCHEDULED" },
      data: { status: "CANCELLED" },
    });
    if (sessionsToCancel.length > 0) {
      await cancelClassSessionEnrollmentsAndBookings({
        tx,
        organizationId: access.organization.id,
        sessionIds: sessionsToCancel.map((session) => session.id),
        actorUserId: access.profile.id,
      });
    }
  });

  return respondOk(access.ctx, { ok: true });
}

export async function handleAcademyClassSessionsGet(req: NextRequest, classIdRaw: string) {
  const access = await resolveAcademyOrgAccess(req);
  if (!access.ok) return access.response;

  const classId = parseClassId(classIdRaw);
  if (!classId) return academyFail(access.ctx, 400, "BAD_REQUEST", "Aula inválida.");

  const service = await ensureClassService({
    organizationId: access.organization.id,
    classId,
  });
  if (!service) return academyFail(access.ctx, 404, "NOT_FOUND", "Aula não encontrada.");

  const fromParam = parseDateParam(req.nextUrl.searchParams.get("from"));
  const toParam = parseDateParam(req.nextUrl.searchParams.get("to"));
  const now = new Date();
  const from = fromParam ?? now;
  const to = toParam ?? new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const items = await prisma.classSession.findMany({
    where: {
      serviceId: classId,
      organizationId: access.organization.id,
      startsAt: { gte: from, lte: to },
    },
    orderBy: [{ startsAt: "asc" }],
    include: {
      series: { select: { id: true, dayOfWeek: true, startMinute: true } },
      professional: { select: { id: true, name: true } },
      court: { select: { id: true, name: true, isActive: true } },
    },
  });

  const sessionIds = items.map((item) => item.id);
  const enrollmentCounts = sessionIds.length
    ? await prisma.academyEnrollment.groupBy({
        by: ["classSessionId"],
        where: {
          organizationId: access.organization.id,
          classSessionId: { in: sessionIds },
          status: { in: ["PENDING", "CONFIRMED"] },
        },
        _count: { _all: true },
      })
    : [];

  const enrolledCountBySession = new Map<number, number>();
  enrollmentCounts.forEach((row) => {
    enrolledCountBySession.set(row.classSessionId, row._count._all);
  });

  const enrichedItems = items.map((item) => {
    const enrolledCount = enrolledCountBySession.get(item.id) ?? 0;
    const isFull = item.status !== "SCHEDULED" || enrolledCount >= item.capacity;
    const isOverbooked = enrolledCount > item.capacity;
    return {
      ...item,
      enrolledCount,
      isFull,
      isOverbooked,
    };
  });

  return respondOk(access.ctx, { items: enrichedItems });
}
