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
import { evaluatePaidWriteGate } from "@/lib/organizationPayments";
import { getOrganizationBookingPolicy } from "@/lib/reservas/gridPolicy";
import {
  normalizeReservationAssignmentMode,
  requiresPartySizeForAssignmentMode,
} from "@/lib/reservas/serviceAssignment";
import { resolveServicePartySizeRules } from "@/lib/reservas/servicePartySize";
import { resolveBookingVerticalFromServiceKind, resolveCategoryDomainFromServiceKind } from "@/lib/reservas/bookingVertical";
import {
  buildDefaultCourtDurationPrices,
  normalizeCourtDurationPricePayload,
  replaceCourtDurationPrices,
} from "@/lib/reservas/serviceDurationPrices";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { AddressSourceProvider, OrganizationMemberRole, ReservationCategoryDomain, ServiceKind } from "@prisma/client";
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

function slugifyCategory(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function getDefaultCategoryByDomain(domain: ReservationCategoryDomain) {
  if (domain === "COURT") return { slug: "campo-padel", label: "Reserva de Campo", sortOrder: 10 };
  if (domain === "CLASS") return { slug: "aulas", label: "Aulas", sortOrder: 20 };
  return { slug: "servicos", label: "Serviços", sortOrder: 30 };
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
      includeOrganizationFields: "settings",
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
      requireStripeForServices: false,
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
        categoryId: true,
        categoryTag: true,
        category: {
          select: {
            id: true,
            slug: true,
            label: true,
            domain: true,
          },
        },
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
        durationPrices: {
          orderBy: [{ durationMinutes: "asc" }],
          select: {
            id: true,
            durationMinutes: true,
            priceCents: true,
            isActive: true,
          },
        },
        professionalLinks: { select: { professionalId: true } },
        resourceLinks: { select: { resourceId: true } },
      },
    });

    if (!service) {
      return fail(404, "Serviço não encontrado.");
    }
    return respondOk(ctx, {
      service: {
        ...service,
        bookingVertical: resolveBookingVerticalFromServiceKind(service.kind),
        categoryTag: service.category?.label ?? service.categoryTag ?? null,
      },
    });
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
      includeOrganizationFields: "settings",
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
      requireStripeForServices: false,
      skipEmailGate: true,
    });
    if (!writeAccess.ok) {
      return fail(403, writeAccess.errorCode);
    }

    const existing = await prisma.service.findFirst({
      where: { id: serviceId, organizationId: organization.id },
      select: {
        id: true,
        durationMinutes: true,
        unitPriceCents: true,
        isActive: true,
        categoryId: true,
        instructorId: true,
        kind: true,
        assignmentMode: true,
        partySizeRequired: true,
        partySizeMin: true,
        partySizeMax: true,
        partySizeStep: true,
        professionalLinks: { select: { professionalId: true } },
        category: { select: { id: true, domain: true, slug: true, label: true } },
        durationPrices: {
          select: {
            id: true,
            durationMinutes: true,
            priceCents: true,
            isActive: true,
          },
        },
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
    const durationPricesInput = normalizeCourtDurationPricePayload(payload?.durationPrices);
    if (payload?.durationPrices !== undefined && !durationPricesInput) {
      return fail(400, "durationPrices inválido.");
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
    const categoryDomain = resolveCategoryDomainFromServiceKind(resolvedKind);
    let resolvedCategory:
      | { id: number; slug: string; label: string; domain: ReservationCategoryDomain }
      | null = existing.category
      ? {
          id: existing.category.id,
          slug: existing.category.slug,
          label: existing.category.label,
          domain: existing.category.domain,
        }
      : null;

    if (Object.prototype.hasOwnProperty.call(payload ?? {}, "categoryId")) {
      if (payload?.categoryId === null) {
        resolvedCategory = null;
      } else {
        const categoryId = Number(payload?.categoryId);
        if (!Number.isFinite(categoryId) || categoryId <= 0) {
          return fail(400, "INVALID_CATEGORY");
        }
        const category = await prisma.reservationCategory.findFirst({
          where: {
            id: Math.trunc(categoryId),
            organizationId: organization.id,
          },
          select: { id: true, slug: true, label: true, domain: true },
        });
        if (!category) {
          return fail(404, "CATEGORY_NOT_FOUND");
        }
        if (category.domain !== categoryDomain) {
          return fail(409, "CATEGORY_DOMAIN_MISMATCH");
        }
        resolvedCategory = category;
      }
    }

    if (typeof payload?.categoryTag === "string") {
      const tag = payload.categoryTag.trim();
      updates.categoryTag = tag ? tag.slice(0, 40) : null;
      if (tag) {
        const defaultCategory = getDefaultCategoryByDomain(categoryDomain);
        const slug = slugifyCategory(tag) || defaultCategory.slug;
        resolvedCategory = await prisma.reservationCategory.upsert({
          where: {
            organizationId_domain_slug: {
              organizationId: organization.id,
              domain: categoryDomain,
              slug,
            },
          },
          update: {
            label: tag.slice(0, 80),
            isActive: true,
          },
          create: {
            organizationId: organization.id,
            domain: categoryDomain,
            slug,
            label: tag.slice(0, 80),
            sortOrder: defaultCategory.sortOrder,
            isActive: true,
          },
          select: { id: true, slug: true, label: true, domain: true },
        });
      }
    }

    if (!resolvedCategory || resolvedCategory.domain !== categoryDomain) {
      const defaultCategory = getDefaultCategoryByDomain(categoryDomain);
      resolvedCategory = await prisma.reservationCategory.upsert({
        where: {
          organizationId_domain_slug: {
            organizationId: organization.id,
            domain: categoryDomain,
            slug: defaultCategory.slug,
          },
        },
        update: {
          label: defaultCategory.label,
          isActive: true,
        },
        create: {
          organizationId: organization.id,
          domain: categoryDomain,
          slug: defaultCategory.slug,
          label: defaultCategory.label,
          sortOrder: defaultCategory.sortOrder,
          isActive: true,
        },
        select: { id: true, slug: true, label: true, domain: true },
      });
    }
    updates.categoryId = resolvedCategory.id;

    const resolvedDurationMinutes = Number.isFinite(Number(updates.durationMinutes))
      ? Number(updates.durationMinutes)
      : existing.durationMinutes;
    const resolvedUnitPriceCents = Number.isFinite(Number(updates.unitPriceCents))
      ? Number(updates.unitPriceCents)
      : existing.unitPriceCents;
    let nextCourtDurationPrices = durationPricesInput;
    if (resolvedKind === ServiceKind.COURT) {
      if (!nextCourtDurationPrices || nextCourtDurationPrices.length === 0) {
        if (!existing.durationPrices.length) {
          nextCourtDurationPrices = buildDefaultCourtDurationPrices({
            baseDurationMinutes: resolvedDurationMinutes,
            basePriceCents: resolvedUnitPriceCents,
          });
        }
      }
      if (nextCourtDurationPrices && nextCourtDurationPrices.length > 0) {
        const bookingPolicy = await getOrganizationBookingPolicy({
          organizationId: organization.id,
          tx: prisma,
        });
        const activeRows = new Set(
          nextCourtDurationPrices.filter((row) => row.isActive !== false).map((row) => row.durationMinutes),
        );
        const missingActiveDuration = bookingPolicy.allowedDurations.find((duration) => !activeRows.has(duration));
        if (missingActiveDuration) {
          return fail(400, "MISSING_ACTIVE_DURATION_PRICE");
        }
      }
    } else if (nextCourtDurationPrices && nextCourtDurationPrices.length > 0) {
      return fail(400, "durationPrices só é permitido para serviços COURT.");
    }
    const hasUnitPriceChange = Object.prototype.hasOwnProperty.call(updates, "unitPriceCents");
    const hasDurationPricesChange = payload?.durationPrices !== undefined;
    const becameCourtService = resolvedKind === ServiceKind.COURT && existing.kind !== ServiceKind.COURT;
    if (hasUnitPriceChange || hasDurationPricesChange || becameCourtService) {
      const maxDurationPriceCents =
        nextCourtDurationPrices && nextCourtDurationPrices.length > 0
          ? Math.max(...nextCourtDurationPrices.map((row) => Math.round(row.priceCents)))
          : 0;
      const paidWriteGate = evaluatePaidWriteGate({
        organizationId: organization.id,
        orgType: (organization as { orgType?: string | null }).orgType ?? null,
        officialEmail: organization.officialEmail ?? null,
        officialEmailVerifiedAt: organization.officialEmailVerifiedAt ?? null,
        stripeAccountId: (organization as { stripeAccountId?: string | null }).stripeAccountId ?? null,
        stripeChargesEnabled: (organization as { stripeChargesEnabled?: boolean | null }).stripeChargesEnabled ?? false,
        stripePayoutsEnabled: (organization as { stripePayoutsEnabled?: boolean | null }).stripePayoutsEnabled ?? false,
        amountCents: Math.max(resolvedUnitPriceCents, maxDurationPriceCents),
      });
      if (!paidWriteGate.ok) {
        return respondError(
          ctx,
          {
            errorCode: paidWriteGate.errorCode,
            message: paidWriteGate.message,
            retryable: false,
            details: paidWriteGate.details,
          },
          { status: 403 },
        );
      }
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

    if (
      Object.keys(updates).length === 0 &&
      nextProfessionalIds === null &&
      resourceIds === null &&
      nextCourtDurationPrices == null &&
      !(resolvedKind !== ServiceKind.COURT && existing.durationPrices.length > 0)
    ) {
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

      if (resolvedKind === ServiceKind.COURT && nextCourtDurationPrices && nextCourtDurationPrices.length > 0) {
        await replaceCourtDurationPrices({
          tx,
          serviceId,
          rows: nextCourtDurationPrices,
        });
      }
      if (resolvedKind !== ServiceKind.COURT) {
        await tx.serviceDurationPrice.deleteMany({ where: { serviceId } });
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
          categoryId: true,
          categoryTag: true,
          category: {
            select: {
              id: true,
              slug: true,
              label: true,
              domain: true,
            },
          },
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
          durationPrices: {
            orderBy: [{ durationMinutes: "asc" }],
            select: {
              id: true,
              durationMinutes: true,
              priceCents: true,
              isActive: true,
            },
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
        durationPrices: nextCourtDurationPrices ?? undefined,
      },
      ip,
      userAgent,
    });

    return respondOk(ctx, {
      service: {
        ...service,
        bookingVertical: resolveBookingVerticalFromServiceKind(service.kind),
        categoryTag: service.category?.label ?? service.categoryTag ?? null,
      },
    });
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
      includeOrganizationFields: "settings",
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
