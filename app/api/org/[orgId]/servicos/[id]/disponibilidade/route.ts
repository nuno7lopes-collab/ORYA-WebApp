import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { getDateParts, normalizeIntervals, resolveScheduleForDate } from "@/lib/reservas/availability";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { OrganizationMemberRole, Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const VALID_SCOPE_TYPES = ["ORGANIZATION", "PROFESSIONAL", "RESOURCE"] as const;
type ScopeType = (typeof VALID_SCOPE_TYPES)[number];

function parseScopeType(raw: unknown): ScopeType | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toUpperCase();
  return VALID_SCOPE_TYPES.includes(value as ScopeType) ? (value as ScopeType) : null;
}

function parseScopeId(raw: unknown) {
  const parsed = typeof raw === "string" || typeof raw === "number" ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseDateInput(raw: unknown) {
  const value = typeof raw === "string" ? raw.trim() : "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return { year, month, day, date, key: toDateKey(year, month, day) };
}

function parseServiceId(idParam: string) {
  const parsed = Number(idParam);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

function toInputJson(value: Prisma.JsonValue): Prisma.InputJsonValue {
  return value === null ? (Prisma.JsonNull as unknown as Prisma.InputJsonValue) : (value as Prisma.InputJsonValue);
}

async function resolveScope(params: {
  scopeTypeRaw: unknown;
  scopeIdRaw: unknown;
  organizationId: number;
  userId: string;
  role: OrganizationMemberRole;
}) {
  const scopeType = parseScopeType(params.scopeTypeRaw) ?? "ORGANIZATION";
  const scopeId = parseScopeId(params.scopeIdRaw);

  if (scopeType === "ORGANIZATION") {
    if (params.role === OrganizationMemberRole.STAFF) {
      return { ok: false as const, error: "Sem permissões." };
    }
    return { ok: true as const, scopeType, scopeId: 0 };
  }

  if (!scopeId) {
    return { ok: false as const, error: "Scope inválido." };
  }

  if (scopeType === "PROFESSIONAL") {
    const professional = await prisma.reservationProfessional.findFirst({
      where: { id: scopeId, organizationId: params.organizationId },
      select: { id: true, userId: true },
    });
    if (!professional) return { ok: false as const, error: "Profissional inválido." };
    if (params.role === OrganizationMemberRole.STAFF && professional.userId !== params.userId) {
      return { ok: false as const, error: "Sem permissões." };
    }
    return { ok: true as const, scopeType, scopeId: professional.id };
  }

  if (params.role === OrganizationMemberRole.STAFF) {
    return { ok: false as const, error: "Sem permissões." };
  }

  const resource = await prisma.reservationResource.findFirst({
    where: { id: scopeId, organizationId: params.organizationId },
    select: { id: true },
  });
  if (!resource) return { ok: false as const, error: "Recurso inválido." };

  return { ok: true as const, scopeType, scopeId: resource.id };
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
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  const resolved = await params;
  const serviceId = parseServiceId(resolved.id);
  if (!serviceId) {
    return fail(400, "Serviço inválido.");
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return fail(403, "Perfil não encontrado.");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(403, "Sem permissões.");
    }
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return fail(403, reservasAccess.error);
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, organizationId: organization.id },
      select: { id: true },
    });

    if (!service) {
      return fail(404, "Serviço não encontrado.");
    }

    const scopeResolution = await resolveScope({
      scopeTypeRaw: req.nextUrl.searchParams.get("scopeType"),
      scopeIdRaw: req.nextUrl.searchParams.get("scopeId"),
      organizationId: organization.id,
      userId: profile.id,
      role: membership.role,
    });

    if (!scopeResolution.ok) {
      return fail(403, scopeResolution.error);
    }

    const { scopeType, scopeId } = scopeResolution;
    const timezone = organization.timezone || "Europe/Lisbon";
    const scheduleIdParam = parseScopeId(req.nextUrl.searchParams.get("scheduleId"));

    const schedules = await prisma.availabilitySchedule.findMany({
      where: { organizationId: organization.id, scopeType, scopeId },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, startDate: true, endDate: true, createdAt: true, updatedAt: true },
    });
    const activeSchedule = resolveScheduleForDate(schedules, new Date(), timezone);
    const selectedSchedule = scheduleIdParam
      ? schedules.find((schedule) => schedule.id === scheduleIdParam) ?? null
      : activeSchedule;

    const [templates, overrides] = await Promise.all([
      selectedSchedule
        ? prisma.weeklyAvailabilityTemplate.findMany({
            where: { availabilityId: selectedSchedule.id },
            orderBy: { dayOfWeek: "asc" },
            select: { id: true, dayOfWeek: true, intervals: true, availabilityId: true },
          })
        : Promise.resolve([]),
      prisma.availabilityOverride.findMany({
        where: { organizationId: organization.id, scopeType, scopeId },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: { id: true, date: true, kind: true, intervals: true },
      }),
    ]);

    return respondOk(ctx, {
      scope: { scopeType, scopeId },
      timezone,
      schedules,
      activeScheduleId: activeSchedule?.id ?? null,
      selectedScheduleId: selectedSchedule?.id ?? null,
      templates,
      overrides,
      inheritsOrganization: scopeType !== "ORGANIZATION" && !activeSchedule,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("GET /api/org/[orgId]/servicos/[id]/disponibilidade error:", err);
    return fail(500, "Erro ao carregar disponibilidade.");
  }
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  const resolved = await params;
  const serviceId = parseServiceId(resolved.id);
  if (!serviceId) {
    return fail(400, "Serviço inválido.");
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return fail(403, "Perfil não encontrado.");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(403, "Sem permissões.");
    }
    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
    });
    if (!reservasAccess.ok) {
      return fail(403, reservasAccess.error);
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, organizationId: organization.id },
      select: { id: true },
    });

    if (!service) {
      return fail(404, "Serviço não encontrado.");
    }

    const payload = await req.json().catch(() => ({}));
    const scopeResolution = await resolveScope({
      scopeTypeRaw: payload?.scopeType,
      scopeIdRaw: payload?.scopeId,
      organizationId: organization.id,
      userId: profile.id,
      role: membership.role,
    });

    if (!scopeResolution.ok) {
      return fail(403, scopeResolution.error);
    }

    const { scopeType, scopeId } = scopeResolution;
    const mode = typeof payload?.mode === "string" ? payload.mode.trim().toUpperCase() : "";
    const { ip, userAgent } = getRequestMeta(req);
    const timezone = organization.timezone || "Europe/Lisbon";

    if (mode === "SCHEDULE") {
      const scheduleId = parseScopeId(payload?.scheduleId);
      const startInput = parseDateInput(payload?.startDate);
      if (!startInput) {
        return fail(400, "Data de início inválida.");
      }
      const endInput = payload?.endDate ? parseDateInput(payload.endDate) : null;
      if (payload?.endDate && !endInput) {
        return fail(400, "Data de fim inválida.");
      }

      const todayParts = getDateParts(new Date(), timezone);
      const todayKey = toDateKey(todayParts.year, todayParts.month, todayParts.day);
      if (startInput.key < todayKey) {
        return fail(400, "A disponibilidade tem de começar hoje ou no futuro.");
      }
      if (endInput && endInput.key < startInput.key) {
        return fail(400, "A data de fim tem de ser depois da data de início.");
      }

      if (scheduleId) {
        const existing = await prisma.availabilitySchedule.findFirst({
          where: { id: scheduleId, organizationId: organization.id, scopeType, scopeId },
          select: { id: true },
        });
        if (!existing) {
          return fail(404, "Disponibilidade não encontrada.");
        }
        const schedule = await prisma.availabilitySchedule.update({
          where: { id: scheduleId },
          data: { startDate: startInput.date, endDate: endInput ? endInput.date : null },
        });
        await recordOrganizationAudit(prisma, {
          organizationId: organization.id,
          actorUserId: profile.id,
          action: "AVAILABILITY_SCHEDULE_UPDATED",
          metadata: { scheduleId: schedule.id, startDate: startInput.key, endDate: endInput?.key ?? null, scopeType, scopeId },
          ip,
          userAgent,
        });
        return respondOk(ctx, { schedule });
      }

      const cloneId = parseScopeId(payload?.cloneFromScheduleId);
      let cloneTemplates: Array<{ dayOfWeek: number; intervals: Prisma.JsonValue }> = [];
      if (cloneId) {
        const cloneSchedule = await prisma.availabilitySchedule.findFirst({
          where: { id: cloneId, organizationId: organization.id, scopeType, scopeId },
          select: { id: true },
        });
        if (!cloneSchedule) {
          return fail(404, "Disponibilidade para copiar não encontrada.");
        }
        cloneTemplates = await prisma.weeklyAvailabilityTemplate.findMany({
          where: { availabilityId: cloneSchedule.id },
          select: { dayOfWeek: true, intervals: true },
        });
      }
      const schedule = await prisma.$transaction(async (tx) => {
        const created = await tx.availabilitySchedule.create({
          data: {
            organizationId: organization.id,
            scopeType,
            scopeId,
            startDate: startInput.date,
            endDate: endInput ? endInput.date : null,
          },
        });
        if (cloneTemplates.length) {
          await tx.weeklyAvailabilityTemplate.createMany({
            data: cloneTemplates.map((template) => ({
              availabilityId: created.id,
              dayOfWeek: template.dayOfWeek,
              intervals: toInputJson(template.intervals),
            })),
          });
        }
        return created;
      });

      await recordOrganizationAudit(prisma, {
        organizationId: organization.id,
        actorUserId: profile.id,
        action: "AVAILABILITY_SCHEDULE_CREATED",
        metadata: { scheduleId: schedule.id, startDate: startInput.key, endDate: endInput?.key ?? null, scopeType, scopeId },
        ip,
        userAgent,
      });

      return respondOk(ctx, { schedule }, { status: 201 });
    }

    if (mode === "SCHEDULE_DELETE") {
      const scheduleId = parseScopeId(payload?.scheduleId);
      if (!scheduleId) {
        return fail(400, "Disponibilidade inválida.");
      }
      const schedule = await prisma.availabilitySchedule.findFirst({
        where: { id: scheduleId, organizationId: organization.id, scopeType, scopeId },
        select: { id: true },
      });
      if (!schedule) {
        return fail(404, "Disponibilidade não encontrada.");
      }
      await prisma.availabilitySchedule.delete({ where: { id: scheduleId } });
      await recordOrganizationAudit(prisma, {
        organizationId: organization.id,
        actorUserId: profile.id,
        action: "AVAILABILITY_SCHEDULE_DELETED",
        metadata: { scheduleId, scopeType, scopeId },
        ip,
        userAgent,
      });
      return respondOk(ctx, { ok: true });
    }

    if (mode === "TEMPLATE") {
      const dayOfWeek = Number(payload?.dayOfWeek);
      if (!Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        return fail(400, "Dia inválido.");
      }
      const scheduleId = parseScopeId(payload?.scheduleId);
      if (!scheduleId) {
        return fail(400, "Disponibilidade inválida.");
      }
      const schedule = await prisma.availabilitySchedule.findFirst({
        where: { id: scheduleId, organizationId: organization.id, scopeType, scopeId },
        select: { id: true },
      });
      if (!schedule) {
        return fail(404, "Disponibilidade não encontrada.");
      }
      const intervals = normalizeIntervals(payload?.intervals);
      const template = await prisma.weeklyAvailabilityTemplate.upsert({
        where: {
          availabilityId_dayOfWeek: {
            availabilityId: schedule.id,
            dayOfWeek,
          },
        },
        update: { intervals },
        create: { availabilityId: schedule.id, dayOfWeek, intervals },
      });

      await recordOrganizationAudit(prisma, {
        organizationId: organization.id,
        actorUserId: profile.id,
        action: "AVAILABILITY_TEMPLATE_UPDATED",
        metadata: { dayOfWeek, intervals, scopeType, scopeId, scheduleId: schedule.id },
        ip,
        userAgent,
      });

      return respondOk(ctx, { template });
    }

    if (mode === "OVERRIDE") {
      const dateInput = parseDateInput(payload?.date);
      const kindRaw = typeof payload?.kind === "string" ? payload.kind.trim().toUpperCase() : "";
      if (!dateInput) {
        return fail(400, "Data inválida.");
      }
      if (!["CLOSED", "OPEN", "BLOCK"].includes(kindRaw)) {
        return fail(400, "Tipo de override inválido.");
      }
      const intervals = kindRaw === "CLOSED" ? [] : normalizeIntervals(payload?.intervals);

      const override = await prisma.availabilityOverride.create({
        data: {
          organizationId: organization.id,
          scopeType,
          scopeId,
          date: dateInput.date,
          kind: kindRaw as "CLOSED" | "OPEN" | "BLOCK",
          intervals,
        },
      });

      await recordOrganizationAudit(prisma, {
        organizationId: organization.id,
        actorUserId: profile.id,
        action: "AVAILABILITY_OVERRIDE_CREATED",
        metadata: { date: dateInput.key, kind: kindRaw, intervals, scopeType, scopeId },
        ip,
        userAgent,
      });

      return respondOk(ctx, { override }, { status: 201 });
    }

    return fail(400, "Pedido inválido.");
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("POST /api/org/[orgId]/servicos/[id]/disponibilidade error:", err);
    return fail(500, "Erro ao guardar disponibilidade.");
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
