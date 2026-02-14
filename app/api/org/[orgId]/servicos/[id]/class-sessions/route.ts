import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
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

function parseServiceId(idParam: string) {
  const parsed = Number(idParam);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateParam(raw: string | null) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
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

    const fromParam = parseDateParam(req.nextUrl.searchParams.get("from"));
    const toParam = parseDateParam(req.nextUrl.searchParams.get("to"));
    const now = new Date();
    const from = fromParam ?? now;
    const to = toParam ?? new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const items = await prisma.classSession.findMany({
      where: {
        serviceId: service.id,
        organizationId: organization.id,
        startsAt: { gte: from, lte: to },
      },
      orderBy: [{ startsAt: "asc" }],
      include: {
        series: { select: { id: true, dayOfWeek: true, startMinute: true } },
        professional: { select: { id: true, name: true } },
        court: { select: { id: true, name: true, isActive: true } },
      },
    });

    return respondOk(ctx, { items });
  } catch (err) {
    if (isUnauthenticatedError(err)) return fail(401, "Não autenticado.");
    console.error("GET /api/org/[orgId]/servicos/[id]/class-sessions error:", err);
    return fail(500, "Erro ao carregar sessões.");
  }
}

export const GET = withApiEnvelope(_GET);
