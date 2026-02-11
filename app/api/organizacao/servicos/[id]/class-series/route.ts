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
  const value = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  const day = Number.isFinite(value) ? Math.floor(value) : NaN;
  return day >= 0 && day <= 6 ? day : null;
}

function normalizeStartMinute(raw: unknown) {
  const value = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  const minute = Number.isFinite(value) ? Math.round(value) : NaN;
  if (!Number.isFinite(minute)) return null;
  if (minute < 0 || minute >= MINUTES_PER_DAY) return null;
  if (minute % SLOT_STEP_MINUTES !== 0) return null;
  return minute;
}

function normalizeDuration(raw: unknown) {
  const value = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  const minutes = Number.isFinite(value) ? Math.round(value) : NaN;
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return minutes;
}

function normalizeCapacity(raw: unknown) {
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

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => respondError(ctx, { errorCode, message, retryable }, { status });

  const resolved = await params;
  const serviceId = parseServiceId(resolved.id);
  if (!serviceId) return fail(400, "Serviço inválido.");

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

    const service = await prisma.service.findFirst({
      where: { id: serviceId, organizationId: organization.id },
      select: { id: true, kind: true },
    });
    if (!service) return fail(404, "Serviço não encontrado.");
    if (service.kind !== "CLASS") return fail(409, "Serviço não suporta aulas recorrentes.");

    const items = await prisma.classSeries.findMany({
      where: { serviceId, organizationId: organization.id },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: {
        professional: { select: { id: true, name: true } },
        court: { select: { id: true, name: true, isActive: true } },
        _count: { select: { sessions: true } },
      },
    });

    return respondOk(ctx, { items });
  } catch (err) {
    if (isUnauthenticatedError(err)) return fail(401, "Não autenticado.");
    console.error("GET /api/organizacao/servicos/[id]/class-series error:", err);
    return fail(500, "Erro ao carregar séries.");
  }
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => respondError(ctx, { errorCode, message, retryable }, { status });

  const resolved = await params;
  const serviceId = parseServiceId(resolved.id);
  if (!serviceId) return fail(400, "Serviço inválido.");

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

    const service = await prisma.service.findFirst({
      where: { id: serviceId, organizationId: organization.id },
      select: { id: true, kind: true, organization: { select: { timezone: true } } },
    });
    if (!service) return fail(404, "Serviço não encontrado.");
    if (service.kind !== "CLASS") return fail(409, "Serviço não suporta aulas recorrentes.");

    const payload = await req.json().catch(() => ({}));
    const dayOfWeek = normalizeDayOfWeek(payload?.dayOfWeek);
    const startMinute = normalizeStartMinute(payload?.startMinute);
    const durationMinutes = normalizeDuration(payload?.durationMinutes ?? payload?.duration);
    const capacity = normalizeCapacity(payload?.capacity ?? 1);
    const validFromParts = parseDateParts(payload?.validFrom);
    const validUntilParts = payload?.validUntil ? parseDateParts(payload.validUntil) : null;
    const isActive = typeof payload?.isActive === "boolean" ? payload.isActive : true;

    if (dayOfWeek == null || startMinute == null || !durationMinutes || !capacity || !validFromParts) {
      return fail(400, "Dados inválidos.");
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
      return fail(400, "Validade final anterior à inicial.");
    }

    const professionalId = typeof payload?.professionalId === "number" ? payload.professionalId : null;
    const courtId = typeof payload?.courtId === "number" ? payload.courtId : null;

    if (professionalId) {
      const professional = await prisma.reservationProfessional.findFirst({
        where: { id: professionalId, organizationId: organization.id, isActive: true },
        select: { id: true },
      });
      if (!professional) return fail(404, "Profissional inválido.");
    }

    if (courtId) {
      const court = await prisma.padelClubCourt.findFirst({
        where: { id: courtId, club: { organizationId: organization.id }, deletedAt: null },
        select: { id: true },
      });
      if (!court) return fail(404, "Campo inválido.");
    }

    const series = await prisma.classSeries.create({
      data: {
        organizationId: organization.id,
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

    if (isActive) {
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

      if (sessions.length > 0) {
        await prisma.classSession.createMany({
          data: sessions.map((session) => ({
            seriesId: series.id,
            organizationId: organization.id,
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
    }

    return respondOk(ctx, { series });
  } catch (err) {
    if (isUnauthenticatedError(err)) return fail(401, "Não autenticado.");
    console.error("POST /api/organizacao/servicos/[id]/class-series error:", err);
    return fail(500, "Erro ao criar série.");
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
