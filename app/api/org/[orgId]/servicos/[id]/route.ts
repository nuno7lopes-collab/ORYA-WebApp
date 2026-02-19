import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ensureDefaultPolicies } from "@/lib/organizationPolicies";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { ensureOrganizationWriteAccess } from "@/lib/organizationWriteAccess";
import {
  normalizeReservationAssignmentMode,
  requiresPartySizeForAssignmentMode,
} from "@/lib/reservas/serviceAssignment";
import { resolveServicePartySizeRules } from "@/lib/reservas/servicePartySize";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { AddressSourceProvider, OrganizationMemberRole, ServiceKind } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

function parseServiceId(idParam: string) {
  const parsed = Number(idParam);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeIdList(value: unknown, label: string) {
  if (value === undefined) return { ids: null as number[] | null, error: null as string | null };
  if (value === null) return { ids: [] as number[], error: null as string | null };
  if (!Array.isArray(value)) {
    return { ids: null as number[] | null, error: `${label} inválidos.` };
  }
  const parsed: number[] = [];
  for (const item of value) {
    const id = Number(item);
    if (!Number.isFinite(id) || id <= 0) {
      return { ids: null as number[] | null, error: `${label} inválidos.` };
    }
    parsed.push(Math.trunc(id));
  }
  return { ids: Array.from(new Set(parsed)), error: null as string | null };
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
    await ensureDefaultPolicies(prisma, organization.id);
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return fail(403, reservasAccess.error);
    }

    const writeAccess = ensureOrganizationWriteAccess(organization, {
      requireStripeForServices: true,
    });
    if (!writeAccess.ok) {
      return fail(403, writeAccess.errorCode);
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, organizationId: organization.id },
      select: {
        id: true,
        policyId: true,
        kind: true,
        assignmentMode: true,
        partySizeRequired: true,
        partySizeMin: true,
        partySizeMax: true,
        partySizeStep: true,
        instructorId: true,
        title: true,
        description: true,
        durationMinutes: true,
        unitPriceCents: true,
        currency: true,
        isActive: true,
        categoryTag: true,
        coverImageUrl: true,
        locationMode: true,
        addressId: true,
        addressRef: { select: { formattedAddress: true, canonical: true } },
        policy: {
          select: {
            id: true,
            name: true,
            policyType: true,
            cancellationWindowMinutes: true,
          },
        },
        instructor: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
        professionalLinks: { select: { professionalId: true } },
        resourceLinks: { select: { resourceId: true } },
      },
    });

    if (!service) {
      return fail(404, "Serviço não encontrado.");
    }
    return respondOk(ctx, {service });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("GET /api/org/[orgId]/servicos/[id] error:", err);
    return fail(500, "Erro ao carregar serviço.");
  }
}

async function _PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    await ensureDefaultPolicies(prisma, organization.id);
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return fail(403, reservasAccess.error);
    }

    const existing = await prisma.service.findFirst({
      where: { id: serviceId, organizationId: organization.id },
      select: {
        id: true,
        unitPriceCents: true,
        isActive: true,
        instructorId: true,
        kind: true,
        assignmentMode: true,
        partySizeRequired: true,
        partySizeMin: true,
        partySizeMax: true,
        partySizeStep: true,
        professionalLinks: { select: { professionalId: true } },
      },
    });

    if (!existing) {
      return fail(404, "Serviço não encontrado.");
    }

    const payload = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    if (typeof payload?.title === "string") updates.title = payload.title.trim();
    if (typeof payload?.name === "string" && !updates.title) updates.title = payload.name.trim();
    if (typeof updates.title === "string" && !updates.title) {
      return fail(400, "Título inválido.");
    }
    if (typeof payload?.description === "string") updates.description = payload.description.trim() || null;
    if (Number.isFinite(Number(payload?.durationMinutes))) {
      const duration = Number(payload.durationMinutes);
      const allowedDurations = new Set([30, 60, 90, 120]);
      if (!allowedDurations.has(duration)) {
        return fail(400, "Duração inválida (30/60/90/120 min).");
      }
      updates.durationMinutes = duration;
    }
    if (Number.isFinite(Number(payload?.unitPriceCents ?? payload?.price))) {
      const price = Math.round(Number(payload.unitPriceCents ?? payload.price));
      if (price < 0) {
        return fail(400, "Preço inválido.");
      }
      updates.unitPriceCents = price;
    }
    if (typeof payload?.currency === "string") updates.currency = payload.currency.trim().toUpperCase();
    if (typeof payload?.assignmentMode === "string") {
      const assignmentModeRaw = payload.assignmentMode.trim().toUpperCase();
      if (!["PROFESSIONAL_ONLY", "RESOURCE_ONLY", "PROFESSIONAL_AND_RESOURCE"].includes(assignmentModeRaw)) {
        return fail(400, "assignmentMode inválido. Usa PROFESSIONAL_ONLY, RESOURCE_ONLY ou PROFESSIONAL_AND_RESOURCE.");
      }
      updates.assignmentMode = normalizeReservationAssignmentMode(assignmentModeRaw);
    }
    if (typeof payload?.kind === "string") {
      const kind = payload.kind.trim().toUpperCase();
      if (!["GENERAL", "COURT", "CLASS"].includes(kind)) {
        return fail(400, "Tipo de serviço inválido.");
      }
      updates.kind = kind as ServiceKind;
    }
    const resolvedKind = (updates.kind as ServiceKind | undefined) ?? existing.kind;
    const resolvedAssignmentMode = normalizeReservationAssignmentMode(
      (updates.assignmentMode as string | undefined) ?? existing.assignmentMode ?? null,
    );
    if (resolvedKind === ServiceKind.CLASS && resolvedAssignmentMode === "RESOURCE_ONLY") {
      return fail(400, "CLASS_REQUIRES_PROFESSIONAL_MODE");
    }
    const hasPartySizeRequired = Object.prototype.hasOwnProperty.call(payload, "partySizeRequired");
    const hasPartySizeMin = Object.prototype.hasOwnProperty.call(payload, "partySizeMin");
    const hasPartySizeMax = Object.prototype.hasOwnProperty.call(payload, "partySizeMax");
    const hasPartySizeStep = Object.prototype.hasOwnProperty.call(payload, "partySizeStep");
    const hasAssignmentMode = Object.prototype.hasOwnProperty.call(updates, "assignmentMode");
    const hasKind = Object.prototype.hasOwnProperty.call(updates, "kind");
    const partySizeRules = resolveServicePartySizeRules({
      assignmentMode: resolvedAssignmentMode,
      serviceKind: resolvedKind,
      partySizeRequired: hasPartySizeRequired ? payload?.partySizeRequired : existing.partySizeRequired,
      partySizeMin: hasPartySizeMin ? payload?.partySizeMin : existing.partySizeMin,
      partySizeMax: hasPartySizeMax ? payload?.partySizeMax : existing.partySizeMax,
      partySizeStep: hasPartySizeStep ? payload?.partySizeStep : existing.partySizeStep,
    });
    if (requiresPartySizeForAssignmentMode(resolvedAssignmentMode) && !partySizeRules.partySizeRequired) {
      return fail(400, "partySizeRequired é obrigatório para serviços com recurso.");
    }
    if (
      hasPartySizeRequired ||
      hasPartySizeMin ||
      hasPartySizeMax ||
      hasPartySizeStep ||
      hasAssignmentMode ||
      hasKind
    ) {
      updates.partySizeRequired = partySizeRules.partySizeRequired;
      updates.partySizeMin = partySizeRules.partySizeMin;
      updates.partySizeMax = partySizeRules.partySizeMax;
      updates.partySizeStep = partySizeRules.partySizeStep;
    }
    if (payload?.instructorId === null) {
      updates.instructorId = null;
    } else if (typeof payload?.instructorId === "string") {
      const instructorId = payload.instructorId.trim();
      if (!instructorId) {
        updates.instructorId = null;
      } else {
        const member = await resolveGroupMemberForOrg({
          organizationId: organization.id,
          userId: instructorId,
        });
        if (!member) {
          return fail(400, "Instrutor inválido.");
        }
        const trainerProfile = await prisma.trainerProfile.findUnique({
          where: {
            organizationId_userId: {
              organizationId: organization.id,
              userId: instructorId,
            },
          },
          select: { id: true },
        });
        if (!trainerProfile) {
          return fail(400, "INSTRUCTOR_NOT_TRAINER");
        }
        updates.instructorId = instructorId;
      }
    }
    if (typeof payload?.isActive === "boolean") updates.isActive = payload.isActive;
    if (typeof payload?.categoryTag === "string") {
      const tag = payload.categoryTag.trim();
      updates.categoryTag = tag ? tag.slice(0, 40) : null;
    }
    if (payload?.coverImageUrl === null) {
      updates.coverImageUrl = null;
    } else if (typeof payload?.coverImageUrl === "string") {
      const url = payload.coverImageUrl.trim();
      updates.coverImageUrl = url ? url.slice(0, 500) : null;
    }
    if (typeof payload?.locationMode === "string") {
      const locationMode = payload.locationMode.trim().toUpperCase();
      if (!["FIXED", "CHOOSE_AT_BOOKING"].includes(locationMode)) {
        return fail(400, "Localização inválida.");
      }
      updates.locationMode = locationMode;
    }
    if (payload?.addressId === null) {
      updates.addressId = null;
    } else if (typeof payload?.addressId === "string") {
      const addressId = payload.addressId.trim();
      if (addressId) {
        const address = await prisma.address.findUnique({
          where: { id: addressId },
          select: { sourceProvider: true },
        });
        if (!address) {
          return fail(400, "Morada inválida.");
        }
        if (address.sourceProvider !== AddressSourceProvider.APPLE_MAPS) {
          return fail(400, "Morada deve ser Apple Maps.");
        }
        updates.addressId = addressId;
      } else {
        updates.addressId = null;
      }
    }
    if (payload?.policyId === null) {
      updates.policyId = null;
    } else if (Number.isFinite(Number(payload?.policyId))) {
      const policyId = Number(payload.policyId);
      const policy = await prisma.organizationPolicy.findFirst({
        where: { id: policyId, organizationId: organization.id },
        select: { id: true },
      });
      if (!policy) {
        return fail(400, "Política inválida.");
      }
      updates.policyId = policy.id;
    }

    const { ids: professionalIds, error: professionalIdsError } = normalizeIdList(
      payload?.professionalIds,
      "Profissionais",
    );
    if (professionalIdsError) {
      return fail(400, professionalIdsError);
    }
    let nextProfessionalIds = professionalIds;
    const resolvedInstructorId =
      Object.prototype.hasOwnProperty.call(updates, "instructorId")
        ? ((updates.instructorId as string | null) ?? null)
        : (existing.instructorId ?? null);
    if (resolvedInstructorId) {
      const instructorProfessional = await prisma.reservationProfessional.findFirst({
        where: { organizationId: organization.id, userId: resolvedInstructorId },
        select: { id: true, isActive: true },
      });
      if (!instructorProfessional) {
        return fail(400, "INSTRUCTOR_NOT_PROFESSIONAL");
      }
      if (!instructorProfessional.isActive) {
        return fail(400, "INSTRUCTOR_PROFESSIONAL_INACTIVE");
      }
      if (nextProfessionalIds !== null) {
        nextProfessionalIds = Array.from(new Set([...nextProfessionalIds, instructorProfessional.id]));
      } else {
        const existingProfessionalIds = existing.professionalLinks.map((link) => link.professionalId);
        if (!existingProfessionalIds.includes(instructorProfessional.id)) {
          nextProfessionalIds = Array.from(new Set([...existingProfessionalIds, instructorProfessional.id]));
        }
      }
    }
    if (nextProfessionalIds !== null && nextProfessionalIds.length) {
      const existingProfessionals = await prisma.reservationProfessional.findMany({
        where: { id: { in: nextProfessionalIds }, organizationId: organization.id },
        select: { id: true },
      });
      if (existingProfessionals.length !== nextProfessionalIds.length) {
        return fail(400, "Profissionais inválidos.");
      }
    }

    const { ids: resourceIds, error: resourceIdsError } = normalizeIdList(payload?.resourceIds, "Recursos");
    if (resourceIdsError) {
      return fail(400, resourceIdsError);
    }
    if (resourceIds !== null) {
      if (resourceIds.length) {
        const existing = await prisma.reservationResource.findMany({
          where: { id: { in: resourceIds }, organizationId: organization.id },
          select: { id: true },
        });
        if (existing.length !== resourceIds.length) {
          return fail(400, "Recursos inválidos.");
        }
      }
    }

    if (Object.keys(updates).length === 0 && nextProfessionalIds === null && resourceIds === null) {
      return fail(400, "Sem alterações.");
    }

    const service = await prisma.$transaction(async (tx) => {
      if (Object.keys(updates).length > 0) {
        await tx.service.update({
          where: { id: serviceId },
          data: updates,
          select: { id: true },
        });
      }

      if (nextProfessionalIds !== null) {
        await tx.serviceProfessionalLink.deleteMany({ where: { serviceId } });
        if (nextProfessionalIds.length > 0) {
          await tx.serviceProfessionalLink.createMany({
            data: nextProfessionalIds.map((professionalId) => ({
              serviceId,
              professionalId,
            })),
          });
        }
      }

      if (resourceIds !== null) {
        await tx.serviceResourceLink.deleteMany({ where: { serviceId } });
        if (resourceIds.length > 0) {
          await tx.serviceResourceLink.createMany({
            data: resourceIds.map((resourceId) => ({
              serviceId,
              resourceId,
            })),
          });
        }
      }

      return tx.service.findUnique({
        where: { id: serviceId },
        select: {
          id: true,
          policyId: true,
          kind: true,
          assignmentMode: true,
          partySizeRequired: true,
          partySizeMin: true,
          partySizeMax: true,
          partySizeStep: true,
          instructorId: true,
          title: true,
          description: true,
          durationMinutes: true,
          unitPriceCents: true,
          currency: true,
          isActive: true,
          categoryTag: true,
          coverImageUrl: true,
          locationMode: true,
          addressId: true,
          addressRef: { select: { formattedAddress: true, canonical: true } },
          policy: {
            select: {
              id: true,
              name: true,
              policyType: true,
              cancellationWindowMinutes: true,
            },
          },
          instructor: {
            select: { id: true, fullName: true, username: true, avatarUrl: true },
          },
          professionalLinks: { select: { professionalId: true } },
          resourceLinks: { select: { resourceId: true } },
        },
      });
    });

    if (!service) {
      return fail(404, "Serviço não encontrado.");
    }

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "SERVICE_UPDATED",
      metadata: {
        serviceId: service.id,
        updates,
        professionalIds: nextProfessionalIds ?? undefined,
        resourceIds: resourceIds ?? undefined,
      },
      ip,
      userAgent,
    });

    return respondOk(ctx, {service });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("PATCH /api/org/[orgId]/servicos/[id] error:", err);
    return fail(500, "Erro ao atualizar serviço.");
  }
}

async function _DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const existing = await prisma.service.findFirst({
      where: { id: serviceId, organizationId: organization.id },
      select: { id: true },
    });

    if (!existing) {
      return fail(404, "Serviço não encontrado.");
    }

    await prisma.service.update({
      where: { id: serviceId },
      data: { isActive: false },
    });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "SERVICE_DISABLED",
      metadata: { serviceId },
      ip,
      userAgent,
    });

    return respondOk(ctx, {});
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("DELETE /api/org/[orgId]/servicos/[id] error:", err);
    return fail(500, "Erro ao remover serviço.");
  }
}
export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
