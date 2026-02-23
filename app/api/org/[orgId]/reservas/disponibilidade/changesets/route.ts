import { NextRequest } from "next/server";
import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  applyAvailabilityChangeset,
  createAvailabilityChangeset,
  mapChangesetError,
  type AvailabilityDraftInput,
} from "@/lib/reservas/availabilityChangesets";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const VALID_SCOPE_TYPES = ["ORGANIZATION", "PROFESSIONAL", "RESOURCE"] as const;
type ScopeType = (typeof VALID_SCOPE_TYPES)[number];

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

function parseScopeType(raw: unknown): ScopeType | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toUpperCase();
  return VALID_SCOPE_TYPES.includes(value as ScopeType) ? (value as ScopeType) : null;
}

function parseScopeId(raw: unknown) {
  const parsed = typeof raw === "string" || typeof raw === "number" ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
      return { ok: false as const, status: 403, errorCode: "FORBIDDEN", message: "Sem permissões." };
    }
    return { ok: true as const, scopeType, scopeId: 0 };
  }

  if (!scopeId) {
    return { ok: false as const, status: 400, errorCode: "SCOPE_INVALID", message: "Scope inválido." };
  }

  if (scopeType === "PROFESSIONAL") {
    const professional = await prisma.reservationProfessional.findFirst({
      where: { id: scopeId, organizationId: params.organizationId },
      select: { id: true, userId: true },
    });
    if (!professional) {
      return { ok: false as const, status: 404, errorCode: "PROFESSIONAL_INVALID", message: "Profissional inválido." };
    }
    if (params.role === OrganizationMemberRole.STAFF && professional.userId !== params.userId) {
      return { ok: false as const, status: 403, errorCode: "FORBIDDEN", message: "Sem permissões." };
    }
    return { ok: true as const, scopeType, scopeId: professional.id };
  }

  if (params.role === OrganizationMemberRole.STAFF) {
    return { ok: false as const, status: 403, errorCode: "FORBIDDEN", message: "Sem permissões." };
  }

  const resource = await prisma.reservationResource.findFirst({
    where: { id: scopeId, organizationId: params.organizationId },
    select: { id: true },
  });
  if (!resource) {
    return { ok: false as const, status: 404, errorCode: "RESOURCE_INVALID", message: "Recurso inválido." };
  }
  return { ok: true as const, scopeType, scopeId: resource.id };
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

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

    const payload = await req.json().catch(() => ({}));

    const scope = await resolveScope({
      scopeTypeRaw: payload?.scopeType,
      scopeIdRaw: payload?.scopeId,
      organizationId: organization.id,
      userId: profile.id,
      role: membership.role,
    });

    if (!scope.ok) {
      return fail(ctx, scope.status, scope.errorCode, scope.message);
    }

    const draftInput: AvailabilityDraftInput = {
      scheduleId: payload?.scheduleId,
      startDate: payload?.startDate,
      endDate: payload?.endDate ?? null,
      templates: payload?.templates ?? {},
      overrides: Array.isArray(payload?.overrides) ? payload.overrides : [],
    };

    const autoApply = payload?.autoApply !== false;

    const result = await prisma.$transaction(async (tx) => {
      const created = await createAvailabilityChangeset({
        tx,
        scope: {
          organizationId: organization.id,
          scopeType: scope.scopeType,
          scopeId: scope.scopeId,
          timezone: organization.timezone || "Europe/Lisbon",
        },
        draftInput,
        requestedByUserId: profile.id,
      });

      if (created.conflictsOpen === 0 && autoApply) {
        const applied = await applyAvailabilityChangeset({
          tx,
          organizationId: organization.id,
          changeSetId: created.changeSetId,
        });
        return {
          ...created,
          status: "APPLIED",
          applied: true,
          scheduleId: applied.scheduleId ?? null,
        };
      }

      return {
        ...created,
        applied: false,
        scheduleId: null,
      };
    });

    if (result.conflictsOpen > 0) {
      return fail(
        ctx,
        409,
        "AVAILABILITY_CONFLICTS_FOUND",
        "Foram encontrados conflitos de disponibilidade. Resolve-os antes de aplicar.",
        {
          changeSetId: result.changeSetId,
          status: result.status,
          conflictsOpen: result.conflictsOpen,
        },
      );
    }

    return respondOk(ctx, {
      changeSetId: result.changeSetId,
      status: result.status,
      conflictsOpen: result.conflictsOpen,
      applied: result.applied,
      scheduleId: result.scheduleId,
    });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }

    const mapped = mapChangesetError(error);
    return fail(ctx, mapped.status, mapped.errorCode, mapped.message);
  }
}

export const POST = withApiEnvelope(_POST);
