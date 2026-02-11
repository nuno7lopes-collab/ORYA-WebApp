import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { ensureOrganizationWriteAccess } from "@/lib/organizationWriteAccess";
import { OrganizationMemberRole } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { buildClassSessionsForSeries } from "@/lib/reservas/classSeries";
import { makeUtcDateFromLocal } from "@/lib/reservas/availability";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const MINUTES_PER_DAY = 24 * 60;
const SLOT_STEP_MINUTES = 15;

function parseServiceId(idParam: string) {
  const parsed = Number(idParam);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSeriesId(idParam: string) {
  const parsed = Number(idParam);
  return Number.isFinite(parsed) ? parsed : null;
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
  if (minute % SLOT_STEP_MINUTES !== 0) return null;
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

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}

async function _PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; seriesId: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => respondError(ctx, { errorCode, message, retryable }, { status });

  const resolved = await params;
  const serviceId = parseServiceId(resolved.id);
  const seriesId = parseSeriesId(resolved.seriesId);
  if (!serviceId || !seriesId) return fail(400, "Série inválida.");

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!profile) return fail(403, "Perfil não encontrado.");

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });
    if (!organization || !membership) return fail(403, "Sem permissões.");

    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) return fail(403, reservasAccess.error ?? "Reservas indisponíveis.");

    const writeAccess = ensureOrganizationWriteAccess(organization, { requireStripeForServices: true });
    if (!writeAccess.ok) return fail(403, writeAccess.errorCode ?? "Operação indisponível.");

    const series = await prisma.classSeries.findFirst({
      where: { id: seriesId, serviceId, organizationId: organization.id },
      include: { service: { select: { kind: true, organization: { select: { timezone: true } } } } },
    });
    if (!series) return fail(404, "Série não encontrada.");
    if (series.service.kind !== "CLASS") return fail(409, "Serviço não suporta aulas recorrentes.");

    const payload = await req.json().catch(() => ({}));
    const dayOfWeek = normalizeDayOfWeek(payload?.dayOfWeek) ?? series.dayOfWeek;
    const startMinute = normalizeStartMinute(payload?.startMinute) ?? series.startMinute;
    const durationMinutes = normalizeDuration(payload?.durationMinutes ?? payload?.duration) ?? series.durationMinutes;
    const capacity = normalizeCapacity(payload?.capacity) ?? series.capacity;

    const validFromParts = payload?.validFrom ? parseDateParts(payload.validFrom) : null;
    const validUntilInput = payload?.validUntil;
    const validUntilParts = validUntilInput ? parseDateParts(validUntilInput) : null;

    const timezone = series.service.organization?.timezone || "Europe/Lisbon";
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
      return fail(400, "Validade final anterior à inicial.");
    }

    const professionalId =
      typeof payload?.professionalId === "number" ? payload.professionalId : series.professionalId ?? null;
    const courtId = typeof payload?.courtId === "number" ? payload.courtId : series.courtId ?? null;

    if (payload?.professionalId !== undefined && professionalId) {
      const professional = await prisma.reservationProfessional.findFirst({
        where: { id: professionalId, organizationId: organization.id, isActive: true },
        select: { id: true },
      });
      if (!professional) return fail(404, "Profissional inválido.");
    }

    if (payload?.courtId !== undefined && courtId) {
      const court = await prisma.padelClubCourt.findFirst({
        where: { id: courtId, club: { organizationId: organization.id }, deletedAt: null },
        select: { id: true },
      });
      if (!court) return fail(404, "Campo inválido.");
    }

    const isActive = typeof payload?.isActive === "boolean" ? payload.isActive : series.isActive;
    const now = new Date();

    const updatedSeries = await prisma.classSeries.update({
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
      await prisma.classSession.updateMany({
        where: { seriesId: series.id, startsAt: { gte: now }, status: "SCHEDULED" },
        data: { status: "CANCELLED" },
      });
      return respondOk(ctx, { series: updatedSeries });
    }

    const sessions = buildClassSessionsForSeries({
      timezone,
      dayOfWeek,
      startMinute,
      durationMinutes,
      validFrom,
      validUntil,
      limitYears: 2,
      startFromToday: true,
    });

    const desiredMap = new Map<number, { startsAt: Date; endsAt: Date }>();
    sessions.forEach((session) => {
      desiredMap.set(session.startsAt.getTime(), session);
    });

    const existing = await prisma.classSession.findMany({
      where: { seriesId: series.id, startsAt: { gte: now } },
      select: { id: true, startsAt: true },
    });

    const existingTimes = new Set(existing.map((item) => item.startsAt.getTime()));

    await Promise.all(
      existing.map((session) => {
        const desired = desiredMap.get(session.startsAt.getTime());
        if (!desired) {
          return prisma.classSession.update({ where: { id: session.id }, data: { status: "CANCELLED" } });
        }
        return prisma.classSession.update({
          where: { id: session.id },
          data: {
            endsAt: desired.endsAt,
            capacity,
            courtId,
            professionalId,
            status: "SCHEDULED",
          },
        });
      }),
    );

    const newSessions = sessions.filter((session) => !existingTimes.has(session.startsAt.getTime()));
    if (newSessions.length > 0) {
      await prisma.classSession.createMany({
        data: newSessions.map((session) => ({
          seriesId: series.id,
          organizationId: organization.id,
          serviceId: serviceId,
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

    return respondOk(ctx, { series: updatedSeries });
  } catch (err) {
    if (isUnauthenticatedError(err)) return fail(401, "Não autenticado.");
    console.error("PATCH /api/organizacao/servicos/[id]/class-series/[seriesId] error:", err);
    return fail(500, "Erro ao atualizar série.");
  }
}

async function _DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; seriesId: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => respondError(ctx, { errorCode, message, retryable }, { status });

  const resolved = await params;
  const serviceId = parseServiceId(resolved.id);
  const seriesId = parseSeriesId(resolved.seriesId);
  if (!serviceId || !seriesId) return fail(400, "Série inválida.");

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!profile) return fail(403, "Perfil não encontrado.");

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });
    if (!organization || !membership) return fail(403, "Sem permissões.");

    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) return fail(403, reservasAccess.error ?? "Reservas indisponíveis.");

    const writeAccess = ensureOrganizationWriteAccess(organization, { requireStripeForServices: true });
    if (!writeAccess.ok) return fail(403, writeAccess.errorCode ?? "Operação indisponível.");

    const series = await prisma.classSeries.findFirst({
      where: { id: seriesId, serviceId, organizationId: organization.id },
      select: { id: true, serviceId: true },
    });
    if (!series) return fail(404, "Série não encontrada.");

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.classSeries.update({ where: { id: series.id }, data: { isActive: false } });
      await tx.classSession.updateMany({
        where: { seriesId: series.id, startsAt: { gte: now }, status: "SCHEDULED" },
        data: { status: "CANCELLED" },
      });
    });

    return respondOk(ctx, { ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) return fail(401, "Não autenticado.");
    console.error("DELETE /api/organizacao/servicos/[id]/class-series/[seriesId] error:", err);
    return fail(500, "Erro ao remover série.");
  }
}

export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
