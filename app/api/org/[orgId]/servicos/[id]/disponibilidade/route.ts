import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { normalizeIntervals } from "@/lib/reservas/availability";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { OrganizationMemberRole } from "@prisma/client";
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

function parseServiceId(idParam: string) {
  const parsed = Number(idParam);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
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
    const [templates, overrides] = await Promise.all([
      prisma.weeklyAvailabilityTemplate.findMany({
        where: { organizationId: organization.id, scopeType, scopeId },
        orderBy: { dayOfWeek: "asc" },
        select: { id: true, dayOfWeek: true, intervals: true },
      }),
      prisma.availabilityOverride.findMany({
        where: { organizationId: organization.id, scopeType, scopeId },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: { id: true, date: true, kind: true, intervals: true },
      }),
    ]);

    const hasCustomTemplates = templates.some((template) => normalizeIntervals(template.intervals ?? []).length > 0);

    return respondOk(ctx, {scope: { scopeType, scopeId },
      templates,
      overrides,
      inheritsOrganization: scopeType !== "ORGANIZATION" && !hasCustomTemplates,
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

    if (mode === "TEMPLATE") {
      const dayOfWeek = Number(payload?.dayOfWeek);
      if (!Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        return fail(400, "Dia inválido.");
      }
      const intervals = normalizeIntervals(payload?.intervals);
      const template = await prisma.weeklyAvailabilityTemplate.upsert({
        where: {
          organizationId_scopeType_scopeId_dayOfWeek: {
            organizationId: organization.id,
            scopeType,
            scopeId,
            dayOfWeek,
          },
        },
        update: { intervals },
        create: { organizationId: organization.id, scopeType, scopeId, dayOfWeek, intervals },
      });

      await recordOrganizationAudit(prisma, {
        organizationId: organization.id,
        actorUserId: profile.id,
        action: "AVAILABILITY_TEMPLATE_UPDATED",
        metadata: { dayOfWeek, intervals, scopeType, scopeId },
        ip,
        userAgent,
      });

      return respondOk(ctx, {template });
    }

    if (mode === "OVERRIDE") {
      const dateRaw = typeof payload?.date === "string" ? payload.date.trim() : "";
      const kindRaw = typeof payload?.kind === "string" ? payload.kind.trim().toUpperCase() : "";
      const match = dateRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) {
        return fail(400, "Data inválida.");
      }
      if (!["CLOSED", "OPEN", "BLOCK"].includes(kindRaw)) {
        return fail(400, "Tipo de override inválido.");
      }
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      const intervals = kindRaw === "CLOSED" ? [] : normalizeIntervals(payload?.intervals);

      const override = await prisma.availabilityOverride.create({
        data: {
          organizationId: organization.id,
          scopeType,
          scopeId,
          date,
          kind: kindRaw as "CLOSED" | "OPEN" | "BLOCK",
          intervals,
        },
      });

      await recordOrganizationAudit(prisma, {
        organizationId: organization.id,
        actorUserId: profile.id,
        action: "AVAILABILITY_OVERRIDE_CREATED",
        metadata: { date: dateRaw, kind: kindRaw, intervals, scopeType, scopeId },
        ip,
        userAgent,
      });

      return respondOk(ctx, {override }, { status: 201 });
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