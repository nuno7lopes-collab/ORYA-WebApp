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
async function _GET(req: NextRequest) {
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
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

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

    const items = await prisma.service.findMany({
      where: {
        organizationId: organization.id,
      },
      orderBy: { createdAt: "desc" },
      include: {
        addressRef: {
          select: { formattedAddress: true, canonical: true, latitude: true, longitude: true, sourceProvider: true },
        },
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
        category: {
          select: {
            id: true,
            slug: true,
            label: true,
            domain: true,
          },
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
        _count: {
          select: { bookings: true },
        },
      },
    });

    const normalizedItems = items.map((item) => ({
      ...item,
      bookingVertical: resolveBookingVerticalFromServiceKind(item.kind),
      categoryTag: item.category?.label ?? item.categoryTag ?? null,
    }));

    return respondOk(ctx, { items: normalizedItems });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("GET /api/org/[orgId]/servicos error:", err);
    return fail(500, "Erro ao carregar serviços.");
  }
}

async function _POST(req: NextRequest) {
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
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

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
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return fail(403, reservasAccess.error);
    }

    await ensureDefaultPolicies(prisma, organization.id);

    const payload = await req.json().catch(() => ({}));
    const title = String(payload?.title ?? payload?.name ?? "").trim();
    const description = String(payload?.description ?? "").trim();
    const durationMinutes = Number(payload?.durationMinutes);
    const unitPriceCents = Number(payload?.unitPriceCents ?? payload?.price);
    const currency = String(payload?.currency ?? "EUR").trim().toUpperCase();
    const policyIdRaw = Number(payload?.policyId);
    const categoryTag = typeof payload?.categoryTag === "string" ? payload.categoryTag.trim() : "";
    const categoryIdRaw = Number(payload?.categoryId);
    const hasCategoryIdInput = Object.prototype.hasOwnProperty.call(payload ?? {}, "categoryId");
    const kindRaw = typeof payload?.kind === "string" ? payload.kind.trim().toUpperCase() : "GENERAL";
    const instructorIdRaw = typeof payload?.instructorId === "string" ? payload.instructorId.trim() : "";
    const locationModeRaw = typeof payload?.locationMode === "string" ? payload.locationMode.trim().toUpperCase() : "FIXED";
    const addressIdInput = typeof payload?.addressId === "string" ? payload.addressId.trim() : "";
    const coverImageUrl = typeof payload?.coverImageUrl === "string" ? payload.coverImageUrl.trim() : "";
    const assignmentModeRaw = typeof payload?.assignmentMode === "string" ? payload.assignmentMode.trim().toUpperCase() : "";
    if (
      assignmentModeRaw &&
      !["PROFESSIONAL_ONLY", "RESOURCE_ONLY", "PROFESSIONAL_AND_RESOURCE"].includes(assignmentModeRaw)
    ) {
      return fail(400, "assignmentMode inválido. Usa PROFESSIONAL_ONLY, RESOURCE_ONLY ou PROFESSIONAL_AND_RESOURCE.");
    }
    const assignmentMode = normalizeReservationAssignmentMode(
      assignmentModeRaw,
      normalizeReservationAssignmentMode((organization as { reservationAssignmentMode?: string | null }).reservationAssignmentMode ?? null),
    );
    const partySizeRules = resolveServicePartySizeRules({
      assignmentMode,
      serviceKind: kindRaw,
      partySizeRequired: payload?.partySizeRequired,
      partySizeMin: payload?.partySizeMin,
      partySizeMax: payload?.partySizeMax,
      partySizeStep: payload?.partySizeStep,
    });
    if (requiresPartySizeForAssignmentMode(assignmentMode) && !partySizeRules.partySizeRequired) {
      return fail(400, "partySizeRequired é obrigatório para serviços com recurso.");
    }
    const { ids: professionalIds, error: professionalIdsError } = normalizeIdList(
      payload?.professionalIds,
      "Profissionais",
    );
    if (professionalIdsError) {
      return fail(400, professionalIdsError);
    }
    const { ids: resourceIds, error: resourceIdsError } = normalizeIdList(payload?.resourceIds, "Recursos");
    if (resourceIdsError) {
      return fail(400, resourceIdsError);
    }
    let resolvedProfessionalIds = professionalIds ?? [];
    const resolvedResourceIds = resourceIds ?? [];

    const allowedDurations = new Set([30, 60, 90, 120]);
    if (!title || !Number.isFinite(durationMinutes) || !allowedDurations.has(durationMinutes)) {
      return fail(400, "Duração inválida (30/60/90/120 min).");
    }
    if (!Number.isFinite(unitPriceCents) || unitPriceCents < 0) {
      return fail(400, "Dados inválidos.");
    }
    const durationPricesInput = normalizeCourtDurationPricePayload(payload?.durationPrices);
    if (payload?.durationPrices !== undefined && !durationPricesInput) {
      return fail(400, "durationPrices inválido.");
    }

    let policyId: number | null = null;
    if (Number.isFinite(policyIdRaw)) {
      const policy = await prisma.organizationPolicy.findFirst({
        where: { id: policyIdRaw, organizationId: organization.id },
        select: { id: true },
      });
      if (!policy) {
        return fail(400, "Política inválida.");
      }
      policyId = policy.id;
    } else {
      const defaultPolicy = await prisma.organizationPolicy.findFirst({
        where: { organizationId: organization.id, policyType: "MODERATE" },
        select: { id: true },
      });
      policyId = defaultPolicy?.id ?? null;
    }

    if (!["FIXED", "CHOOSE_AT_BOOKING"].includes(locationModeRaw)) {
      return fail(400, "Localização inválida.");
    }
    if (!["GENERAL", "COURT", "CLASS"].includes(kindRaw)) {
      return fail(400, "Tipo de serviço inválido.");
    }
    if (kindRaw === "CLASS" && assignmentMode === "RESOURCE_ONLY") {
      return fail(400, "CLASS_REQUIRES_PROFESSIONAL_MODE");
    }
    const categoryDomain = resolveCategoryDomainFromServiceKind(kindRaw);
    let selectedCategory:
      | { id: number; slug: string; label: string; domain: ReservationCategoryDomain }
      | null = null;
    if (hasCategoryIdInput && payload?.categoryId !== null) {
      if (!Number.isFinite(categoryIdRaw) || categoryIdRaw <= 0) {
        return fail(400, "INVALID_CATEGORY");
      }
      const category = await prisma.reservationCategory.findFirst({
        where: {
          id: Math.trunc(categoryIdRaw),
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
      selectedCategory = category;
    }

    let courtDurationPrices = durationPricesInput;
    if (kindRaw === "COURT") {
      if (!courtDurationPrices || courtDurationPrices.length === 0) {
        courtDurationPrices = buildDefaultCourtDurationPrices({
          baseDurationMinutes: durationMinutes,
          basePriceCents: Math.round(unitPriceCents),
        });
      }
      const bookingPolicy = await getOrganizationBookingPolicy({
        organizationId: organization.id,
        tx: prisma,
      });
      const activeRows = new Set(
        courtDurationPrices.filter((row) => row.isActive !== false).map((row) => row.durationMinutes),
      );
      const missingActiveDuration = bookingPolicy.allowedDurations.find((duration) => !activeRows.has(duration));
      if (missingActiveDuration) {
        return fail(400, "MISSING_ACTIVE_DURATION_PRICE");
      }
    } else if (courtDurationPrices && courtDurationPrices.length > 0) {
      return fail(400, "durationPrices só é permitido para serviços COURT.");
    }

    const maxDurationPriceCents =
      courtDurationPrices && courtDurationPrices.length > 0
        ? Math.max(...courtDurationPrices.map((row) => Math.round(row.priceCents)))
        : 0;
    const paidWriteGate = evaluatePaidWriteGate({
      organizationId: organization.id,
      orgType: (organization as { orgType?: string | null }).orgType ?? null,
      officialEmail: organization.officialEmail ?? null,
      officialEmailVerifiedAt: organization.officialEmailVerifiedAt ?? null,
      stripeAccountId: (organization as { stripeAccountId?: string | null }).stripeAccountId ?? null,
      stripeChargesEnabled: (organization as { stripeChargesEnabled?: boolean | null }).stripeChargesEnabled ?? false,
      stripePayoutsEnabled: (organization as { stripePayoutsEnabled?: boolean | null }).stripePayoutsEnabled ?? false,
      amountCents: Math.max(Math.round(unitPriceCents), maxDurationPriceCents),
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

    const writeAccess = ensureOrganizationWriteAccess(organization, {
      requireStripeForServices: false,
      skipEmailGate: true,
    });
    if (!writeAccess.ok) {
      return fail(403, writeAccess.errorCode);
    }

    let instructorId: string | null = null;
    let instructorProfessionalId: number | null = null;
    if (instructorIdRaw) {
      const member = await resolveGroupMemberForOrg({
        organizationId: organization.id,
        userId: instructorIdRaw,
      });
      if (!member) {
        return fail(400, "Instrutor inválido.");
      }
      const trainerProfile = await prisma.trainerProfile.findUnique({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: instructorIdRaw,
          },
        },
        select: { id: true },
      });
      if (!trainerProfile) {
        return fail(400, "INSTRUCTOR_NOT_TRAINER");
      }
      instructorId = instructorIdRaw;
      const instructorProfessional = await prisma.reservationProfessional.findFirst({
        where: { organizationId: organization.id, userId: instructorIdRaw },
        select: { id: true, isActive: true },
      });
      if (!instructorProfessional) {
        return fail(400, "INSTRUCTOR_NOT_PROFESSIONAL");
      }
      if (!instructorProfessional.isActive) {
        return fail(400, "INSTRUCTOR_PROFESSIONAL_INACTIVE");
      }
      instructorProfessionalId = instructorProfessional.id;
    }
    if (instructorProfessionalId) {
      resolvedProfessionalIds = Array.from(new Set([...resolvedProfessionalIds, instructorProfessionalId]));
    }
    if (resolvedProfessionalIds.length) {
      const existingProfessionals = await prisma.reservationProfessional.findMany({
        where: { id: { in: resolvedProfessionalIds }, organizationId: organization.id },
        select: { id: true },
      });
      if (existingProfessionals.length !== resolvedProfessionalIds.length) {
        return fail(400, "Profissionais inválidos.");
      }
    }
    if (resolvedResourceIds.length) {
      const existingResources = await prisma.reservationResource.findMany({
        where: { id: { in: resolvedResourceIds }, organizationId: organization.id },
        select: { id: true },
      });
      if (existingResources.length !== resolvedResourceIds.length) {
        return fail(400, "Recursos inválidos.");
      }
    }

    const resolvedAddressId = addressIdInput || null;
    if (resolvedAddressId) {
      const address = await prisma.address.findUnique({
        where: { id: resolvedAddressId },
        select: { sourceProvider: true },
      });
      if (!address) {
        return fail(400, "Morada inválida.");
      }
      if (address.sourceProvider !== AddressSourceProvider.APPLE_MAPS) {
        return fail(400, "Morada deve ser Apple Maps.");
      }
    }

    const service = await prisma.$transaction(async (tx) => {
      let resolvedCategory = selectedCategory;
      if (!resolvedCategory) {
        const domainDefault = getDefaultCategoryByDomain(categoryDomain);
        const customSlug = categoryTag ? slugifyCategory(categoryTag) : "";
        const slug = customSlug || domainDefault.slug;
        const label = categoryTag || domainDefault.label;
        resolvedCategory = await tx.reservationCategory.upsert({
          where: {
            organizationId_domain_slug: {
              organizationId: organization.id,
              domain: categoryDomain,
              slug,
            },
          },
          update: {
            label,
            isActive: true,
          },
          create: {
            organizationId: organization.id,
            domain: categoryDomain,
            slug,
            label,
            sortOrder: domainDefault.sortOrder,
            isActive: true,
          },
          select: { id: true, slug: true, label: true, domain: true },
        });
      }

      const created = await tx.service.create({
        data: {
          organizationId: organization.id,
          policyId,
          categoryId: resolvedCategory.id,
          kind: kindRaw as ServiceKind,
          instructorId,
          title,
          description: description || null,
          durationMinutes,
          unitPriceCents: Math.round(unitPriceCents),
          currency: currency || "EUR",
          assignmentMode,
          partySizeRequired: partySizeRules.partySizeRequired,
          partySizeMin: partySizeRules.partySizeMin,
          partySizeMax: partySizeRules.partySizeMax,
          partySizeStep: partySizeRules.partySizeStep,
          categoryTag: categoryTag || null,
          coverImageUrl: coverImageUrl || null,
          locationMode: locationModeRaw as "FIXED" | "CHOOSE_AT_BOOKING",
          addressId: resolvedAddressId,
        },
      });
      if (resolvedProfessionalIds.length > 0) {
        await tx.serviceProfessionalLink.createMany({
          data: resolvedProfessionalIds.map((professionalId) => ({
            serviceId: created.id,
            professionalId,
          })),
        });
      }
      if (resolvedResourceIds.length > 0) {
        await tx.serviceResourceLink.createMany({
          data: resolvedResourceIds.map((resourceId) => ({
            serviceId: created.id,
            resourceId,
          })),
        });
      }
      if (kindRaw === "COURT" && courtDurationPrices && courtDurationPrices.length > 0) {
        await tx.serviceDurationPrice.createMany({
          data: courtDurationPrices.map((row) => ({
            serviceId: created.id,
            durationMinutes: row.durationMinutes,
            priceCents: row.priceCents,
            isActive: row.isActive,
          })),
          skipDuplicates: true,
        });
      }
      return { created, category: resolvedCategory };
    });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "SERVICE_CREATED",
      metadata: {
        serviceId: service.created.id,
        title,
        durationMinutes,
        unitPriceCents: Math.round(unitPriceCents),
        currency: currency || "EUR",
        assignmentMode,
        partySizeRules,
        categoryId: service.category.id,
        category: service.category,
        categoryTag: categoryTag || null,
        coverImageUrl: coverImageUrl || null,
        locationMode: locationModeRaw,
        professionalIds: resolvedProfessionalIds,
        resourceIds: resolvedResourceIds,
        durationPrices: kindRaw === "COURT" ? courtDurationPrices : null,
      },
      ip,
      userAgent,
    });

    return respondOk(
      ctx,
      {
        service: {
          ...service.created,
          bookingVertical: resolveBookingVerticalFromServiceKind(service.created.kind),
          category: service.category,
          categoryTag: (service.category?.label ?? categoryTag) || null,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("POST /api/org/[orgId]/servicos error:", err);
    return fail(500, "Erro ao criar serviço.");
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
