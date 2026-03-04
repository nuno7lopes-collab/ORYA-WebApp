import { NextRequest } from "next/server";
import { type Prisma, AddressSourceProvider, ReservationCategoryDomain, ServiceKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { academyFail, resolveAcademyOrgAccess } from "@/lib/academy/apiAccess";
import { ensureOrganizationWriteAccess } from "@/lib/organizationWriteAccess";
import { evaluatePaidWriteGate } from "@/lib/organizationPayments";
import { resolveBookingVerticalFromServiceKind } from "@/lib/reservas/bookingVertical";
import { getDefaultCategoryByDomain, normalizeIdList, slugifyCategory, ALLOWED_SERVICE_DURATIONS } from "@/lib/reservas/serviceMutationHelpers";
import { normalizeReservationAssignmentMode, requiresPartySizeForAssignmentMode } from "@/lib/reservas/serviceAssignment";
import { resolveServicePartySizeRules } from "@/lib/reservas/servicePartySize";
import { assertTrainerIdsBelongToEligibleTeamMembers, parseProfessionalIdsInput } from "@/lib/academy/trainerTeamGuards";
import { respondOk } from "@/lib/http/envelope";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseClassId(raw: string) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function parsePriceCents(payload: Record<string, unknown>) {
  const value = Number(payload.unitPriceCents ?? payload.price);
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0) return null;
  return rounded;
}

function mapClassService<T extends { kind: ServiceKind | string; categoryTag?: string | null; category?: { label: string } | null }>(
  service: T,
) {
  return {
    ...service,
    bookingVertical: resolveBookingVerticalFromServiceKind(service.kind),
    categoryTag: service.category?.label ?? service.categoryTag ?? null,
  };
}

async function ensureClassCategory(params: {
  tx: Prisma.TransactionClient;
  organizationId: number;
  categoryTag?: string | null;
}) {
  const domain = ReservationCategoryDomain.CLASS;
  const fallback = getDefaultCategoryByDomain(domain);
  const trimmed = params.categoryTag?.trim() ?? "";
  const slug = trimmed ? slugifyCategory(trimmed) || fallback.slug : fallback.slug;
  const label = trimmed || fallback.label;

  return params.tx.reservationCategory.upsert({
    where: {
      organizationId_domain_slug: {
        organizationId: params.organizationId,
        domain,
        slug,
      },
    },
    update: {
      label,
      isActive: true,
    },
    create: {
      organizationId: params.organizationId,
      domain,
      slug,
      label,
      sortOrder: fallback.sortOrder,
      isActive: true,
    },
    select: { id: true, slug: true, label: true, domain: true },
  });
}

async function ensureResourceIdsExist(params: { organizationId: number; resourceIds: number[] }) {
  if (params.resourceIds.length === 0) return true;
  const resources = await prisma.reservationResource.findMany({
    where: {
      organizationId: params.organizationId,
      id: { in: params.resourceIds },
    },
    select: { id: true },
  });
  return resources.length === params.resourceIds.length;
}

async function ensureAddressIdIsAppleMaps(addressId: string) {
  const address = await prisma.address.findUnique({
    where: { id: addressId },
    select: { sourceProvider: true },
  });
  if (!address) return { ok: false as const, message: "Morada inválida." };
  if (address.sourceProvider !== AddressSourceProvider.APPLE_MAPS) {
    return { ok: false as const, message: "Morada deve ser Apple Maps." };
  }
  return { ok: true as const };
}

async function findDefaultModeratePolicyId(organizationId: number) {
  const policy = await prisma.organizationPolicy.findFirst({
    where: { organizationId, policyType: "MODERATE" },
    select: { id: true },
  });
  return policy?.id ?? null;
}

const CLASS_DETAIL_SELECT = {
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
    orderBy: [{ durationMinutes: "asc" as const }],
    select: {
      id: true,
      durationMinutes: true,
      priceCents: true,
      isActive: true,
    },
  },
  professionalLinks: { select: { professionalId: true } },
  resourceLinks: { select: { resourceId: true } },
} satisfies Prisma.ServiceSelect;

export async function handleAcademyClassesGet(req: NextRequest) {
  const access = await resolveAcademyOrgAccess(req);
  if (!access.ok) return access.response;

  const items = await prisma.service.findMany({
    where: {
      organizationId: access.organization.id,
      kind: ServiceKind.CLASS,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      kind: true,
      durationMinutes: true,
      unitPriceCents: true,
      currency: true,
      isActive: true,
      categoryTag: true,
      category: { select: { label: true } },
      coverImageUrl: true,
      professionalLinks: { select: { professionalId: true } },
      resourceLinks: { select: { resourceId: true } },
    },
  });

  return respondOk(access.ctx, {
    items: items.map((item) => mapClassService(item)),
  });
}

export async function handleAcademyClassesPost(req: NextRequest) {
  const access = await resolveAcademyOrgAccess(req);
  if (!access.ok) return access.response;

  const writeAccess = ensureOrganizationWriteAccess(access.organization, {
    requireStripeForServices: false,
    skipEmailGate: true,
  });
  if (!writeAccess.ok) {
    return academyFail(
      access.ctx,
      403,
      String(writeAccess.errorCode ?? "FORBIDDEN"),
      String(writeAccess.errorCode ?? "Sem permissões."),
    );
  }

  const payload = await req.json().catch(() => null);
  if (!isRecord(payload)) {
    return academyFail(access.ctx, 400, "BAD_REQUEST", "Payload inválido.");
  }

  const title = String(payload.title ?? payload.name ?? "").trim();
  const description = String(payload.description ?? "").trim();
  const durationMinutes = Number(payload.durationMinutes);
  const parsedUnitPriceCents = parsePriceCents(payload);
  const currency = String(payload.currency ?? "EUR").trim().toUpperCase() || "EUR";
  const categoryTag = typeof payload.categoryTag === "string" ? payload.categoryTag.trim() : "";
  const coverImageUrl = typeof payload.coverImageUrl === "string" ? payload.coverImageUrl.trim() : "";
  const locationModeRaw = typeof payload.locationMode === "string" ? payload.locationMode.trim().toUpperCase() : "FIXED";
  const addressIdRaw = typeof payload.addressId === "string" ? payload.addressId.trim() : "";
  const policyIdRaw = Number(payload.policyId);

  if (!title) {
    return academyFail(access.ctx, 400, "BAD_REQUEST", "Título obrigatório.");
  }
  if (!Number.isFinite(durationMinutes) || !ALLOWED_SERVICE_DURATIONS.has(durationMinutes)) {
    return academyFail(access.ctx, 400, "BAD_REQUEST", "Duração inválida (30/60/90/120 min).");
  }
  if (parsedUnitPriceCents === null) {
    return academyFail(access.ctx, 400, "BAD_REQUEST", "Preço inválido.");
  }
  const unitPriceCents = parsedUnitPriceCents;
  if (!["FIXED", "CHOOSE_AT_BOOKING"].includes(locationModeRaw)) {
    return academyFail(access.ctx, 400, "BAD_REQUEST", "Localização inválida.");
  }

  const { ids: resourceIdsRaw, error: resourceError } = normalizeIdList(payload.resourceIds, "Recursos");
  if (resourceError) {
    return academyFail(access.ctx, 400, "BAD_REQUEST", resourceError);
  }
  const resourceIds = resourceIdsRaw ?? [];

  const professionalIdsInput = parseProfessionalIdsInput(payload);
  if (!professionalIdsInput.ok) {
    return academyFail(
      access.ctx,
      professionalIdsInput.status,
      professionalIdsInput.errorCode,
      professionalIdsInput.message,
    );
  }
  const professionalIds = professionalIdsInput.ids;

  const defaultAssignmentMode = resourceIds.length > 0 ? "PROFESSIONAL_AND_RESOURCE" : "PROFESSIONAL_ONLY";
  const assignmentModeRaw =
    typeof payload.assignmentMode === "string" ? payload.assignmentMode.trim().toUpperCase() : defaultAssignmentMode;
  if (
    assignmentModeRaw &&
    !["PROFESSIONAL_ONLY", "RESOURCE_ONLY", "PROFESSIONAL_AND_RESOURCE", "PROFESSIONAL", "RESOURCE"].includes(
      assignmentModeRaw,
    )
  ) {
    return academyFail(
      access.ctx,
      400,
      "BAD_REQUEST",
      "assignmentMode inválido. Usa PROFESSIONAL_ONLY, RESOURCE_ONLY ou PROFESSIONAL_AND_RESOURCE.",
    );
  }
  const assignmentMode = normalizeReservationAssignmentMode(assignmentModeRaw, defaultAssignmentMode);
  if (assignmentMode === "RESOURCE_ONLY") {
    return academyFail(access.ctx, 400, "CLASS_REQUIRES_PROFESSIONAL_MODE", "CLASS_REQUIRES_PROFESSIONAL_MODE");
  }

  const partySizeRules = resolveServicePartySizeRules({
    assignmentMode,
    serviceKind: ServiceKind.CLASS,
    partySizeRequired: payload.partySizeRequired,
    partySizeMin: payload.partySizeMin,
    partySizeMax: payload.partySizeMax,
    partySizeStep: payload.partySizeStep,
  });
  if (requiresPartySizeForAssignmentMode(assignmentMode) && !partySizeRules.partySizeRequired) {
    return academyFail(access.ctx, 400, "BAD_REQUEST", "partySizeRequired é obrigatório para aulas com recurso.");
  }

  if (professionalIds.length > 0) {
    const trainerValidation = await assertTrainerIdsBelongToEligibleTeamMembers({
      organizationId: access.organization.id,
      professionalIds,
    });
    if (!trainerValidation.ok) {
      return academyFail(
        access.ctx,
        409,
        "TRAINER_NOT_TEAM_MEMBER",
        "Treinadores inválidos: só membros ativos da Equipa podem ser associados a aulas.",
        { invalidProfessionalIds: trainerValidation.invalidProfessionalIds },
      );
    }
  }

  if (resourceIds.length > 0) {
    const resourcesOk = await ensureResourceIdsExist({
      organizationId: access.organization.id,
      resourceIds,
    });
    if (!resourcesOk) {
      return academyFail(access.ctx, 400, "BAD_REQUEST", "Recursos inválidos.");
    }
  }

  let resolvedAddressId: string | null = null;
  if (addressIdRaw) {
    const addressValidation = await ensureAddressIdIsAppleMaps(addressIdRaw);
    if (!addressValidation.ok) {
      return academyFail(access.ctx, 400, "BAD_REQUEST", addressValidation.message);
    }
    resolvedAddressId = addressIdRaw;
  }

  let policyId: number | null = null;
  if (Number.isFinite(policyIdRaw)) {
    const policy = await prisma.organizationPolicy.findFirst({
      where: { id: policyIdRaw, organizationId: access.organization.id },
      select: { id: true },
    });
    if (!policy) {
      return academyFail(access.ctx, 400, "BAD_REQUEST", "Política inválida.");
    }
    policyId = policy.id;
  } else {
    policyId = await findDefaultModeratePolicyId(access.organization.id);
  }

  const paidWriteGate = evaluatePaidWriteGate({
    organizationId: access.organization.id,
    orgType: access.organization.orgType ?? null,
    officialEmail: access.organization.officialEmail ?? null,
    officialEmailVerifiedAt: access.organization.officialEmailVerifiedAt ?? null,
    stripeAccountId: access.organization.stripeAccountId ?? null,
    stripeChargesEnabled: access.organization.stripeChargesEnabled ?? false,
    stripePayoutsEnabled: access.organization.stripePayoutsEnabled ?? false,
    amountCents: unitPriceCents,
  });
  if (!paidWriteGate.ok) {
    return academyFail(
      access.ctx,
      403,
      paidWriteGate.errorCode,
      paidWriteGate.message,
      paidWriteGate.details,
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    const category = await ensureClassCategory({
      tx,
      organizationId: access.organization.id,
      categoryTag: categoryTag || null,
    });

    const service = await tx.service.create({
      data: {
        organizationId: access.organization.id,
        policyId,
        categoryId: category.id,
        kind: ServiceKind.CLASS,
        title,
        description: description || null,
        durationMinutes,
        unitPriceCents,
        currency,
        assignmentMode,
        partySizeRequired: partySizeRules.partySizeRequired,
        partySizeMin: partySizeRules.partySizeMin,
        partySizeMax: partySizeRules.partySizeMax,
        partySizeStep: partySizeRules.partySizeStep,
        categoryTag: category.label,
        coverImageUrl: coverImageUrl || null,
        locationMode: locationModeRaw as "FIXED" | "CHOOSE_AT_BOOKING",
        addressId: resolvedAddressId,
      },
      select: { id: true },
    });

    if (professionalIds.length > 0) {
      await tx.serviceProfessionalLink.createMany({
        data: professionalIds.map((professionalId) => ({ serviceId: service.id, professionalId })),
      });
    }
    if (resourceIds.length > 0) {
      await tx.serviceResourceLink.createMany({
        data: resourceIds.map((resourceId) => ({ serviceId: service.id, resourceId })),
      });
    }

    const full = await tx.service.findUnique({
      where: { id: service.id },
      select: CLASS_DETAIL_SELECT,
    });
    return full;
  });

  if (!created) {
    return academyFail(access.ctx, 500, "INTERNAL_ERROR", "Erro ao criar aula.");
  }

  const mapped = mapClassService(created);
  return respondOk(
    access.ctx,
    {
      service: mapped,
      class: mapped,
    },
    { status: 201 },
  );
}

export async function handleAcademyClassGet(req: NextRequest, classIdRaw: string) {
  const access = await resolveAcademyOrgAccess(req);
  if (!access.ok) return access.response;

  const classId = parseClassId(classIdRaw);
  if (!classId) {
    return academyFail(access.ctx, 400, "BAD_REQUEST", "Aula inválida.");
  }

  const service = await prisma.service.findFirst({
    where: {
      id: classId,
      organizationId: access.organization.id,
      kind: ServiceKind.CLASS,
    },
    select: CLASS_DETAIL_SELECT,
  });

  if (!service) {
    return academyFail(access.ctx, 404, "NOT_FOUND", "Aula não encontrada.");
  }

  const mapped = mapClassService(service);
  return respondOk(access.ctx, {
    service: mapped,
    class: mapped,
  });
}

export async function handleAcademyClassPatch(req: NextRequest, classIdRaw: string) {
  const access = await resolveAcademyOrgAccess(req);
  if (!access.ok) return access.response;

  const writeAccess = ensureOrganizationWriteAccess(access.organization, {
    requireStripeForServices: false,
    skipEmailGate: true,
  });
  if (!writeAccess.ok) {
    return academyFail(
      access.ctx,
      403,
      String(writeAccess.errorCode ?? "FORBIDDEN"),
      String(writeAccess.errorCode ?? "Sem permissões."),
    );
  }

  const classId = parseClassId(classIdRaw);
  if (!classId) {
    return academyFail(access.ctx, 400, "BAD_REQUEST", "Aula inválida.");
  }

  const payload = await req.json().catch(() => null);
  if (!isRecord(payload)) {
    return academyFail(access.ctx, 400, "BAD_REQUEST", "Payload inválido.");
  }

  const existing = await prisma.service.findFirst({
    where: {
      id: classId,
      organizationId: access.organization.id,
      kind: ServiceKind.CLASS,
    },
    select: {
      id: true,
      durationMinutes: true,
      unitPriceCents: true,
      assignmentMode: true,
      partySizeRequired: true,
      partySizeMin: true,
      partySizeMax: true,
      partySizeStep: true,
      professionalLinks: { select: { professionalId: true } },
      category: { select: { id: true, label: true } },
      resourceLinks: { select: { resourceId: true } },
    },
  });
  if (!existing) {
    return academyFail(access.ctx, 404, "NOT_FOUND", "Aula não encontrada.");
  }

  const updates: Prisma.ServiceUncheckedUpdateInput = {};
  if (typeof payload.title === "string") {
    const title = payload.title.trim();
    if (!title) {
      return academyFail(access.ctx, 400, "BAD_REQUEST", "Título inválido.");
    }
    updates.title = title;
  }
  if (typeof payload.name === "string" && updates.title === undefined) {
    const title = payload.name.trim();
    if (!title) {
      return academyFail(access.ctx, 400, "BAD_REQUEST", "Título inválido.");
    }
    updates.title = title;
  }
  if (typeof payload.description === "string") {
    updates.description = payload.description.trim() || null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "durationMinutes")) {
    const duration = Number(payload.durationMinutes);
    if (!Number.isFinite(duration) || !ALLOWED_SERVICE_DURATIONS.has(duration)) {
      return academyFail(access.ctx, 400, "BAD_REQUEST", "Duração inválida (30/60/90/120 min).");
    }
    updates.durationMinutes = duration;
  }
  if (
    Object.prototype.hasOwnProperty.call(payload, "unitPriceCents") ||
    Object.prototype.hasOwnProperty.call(payload, "price")
  ) {
    const parsedUnitPriceCents = parsePriceCents(payload);
    if (parsedUnitPriceCents === null) {
      return academyFail(access.ctx, 400, "BAD_REQUEST", "Preço inválido.");
    }
    updates.unitPriceCents = parsedUnitPriceCents;
  }
  if (typeof payload.currency === "string") {
    updates.currency = payload.currency.trim().toUpperCase() || "EUR";
  }
  if (typeof payload.isActive === "boolean") {
    updates.isActive = payload.isActive;
  }
  if (payload.coverImageUrl === null) {
    updates.coverImageUrl = null;
  } else if (typeof payload.coverImageUrl === "string") {
    const url = payload.coverImageUrl.trim();
    updates.coverImageUrl = url ? url.slice(0, 500) : null;
  }
  if (typeof payload.locationMode === "string") {
    const locationMode = payload.locationMode.trim().toUpperCase();
    if (!["FIXED", "CHOOSE_AT_BOOKING"].includes(locationMode)) {
      return academyFail(access.ctx, 400, "BAD_REQUEST", "Localização inválida.");
    }
    updates.locationMode = locationMode as "FIXED" | "CHOOSE_AT_BOOKING";
  }
  if (Object.prototype.hasOwnProperty.call(payload, "addressId")) {
    if (payload.addressId === null || payload.addressId === "") {
      updates.addressId = null;
    } else if (typeof payload.addressId === "string") {
      const addressId = payload.addressId.trim();
      const addressValidation = await ensureAddressIdIsAppleMaps(addressId);
      if (!addressValidation.ok) {
        return academyFail(access.ctx, 400, "BAD_REQUEST", addressValidation.message);
      }
      updates.addressId = addressId;
    } else {
      return academyFail(access.ctx, 400, "BAD_REQUEST", "Morada inválida.");
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, "policyId")) {
    if (payload.policyId === null) {
      updates.policyId = null;
    } else {
      const policyId = Number(payload.policyId);
      if (!Number.isFinite(policyId)) {
        return academyFail(access.ctx, 400, "BAD_REQUEST", "Política inválida.");
      }
      const policy = await prisma.organizationPolicy.findFirst({
        where: { id: policyId, organizationId: access.organization.id },
        select: { id: true },
      });
      if (!policy) {
        return academyFail(access.ctx, 400, "BAD_REQUEST", "Política inválida.");
      }
      updates.policyId = policy.id;
    }
  }

  const { ids: resourceIds, error: resourceError } = normalizeIdList(payload.resourceIds, "Recursos");
  if (resourceError) {
    return academyFail(access.ctx, 400, "BAD_REQUEST", resourceError);
  }
  if (resourceIds != null && resourceIds.length > 0) {
    const resourcesOk = await ensureResourceIdsExist({
      organizationId: access.organization.id,
      resourceIds,
    });
    if (!resourcesOk) {
      return academyFail(access.ctx, 400, "BAD_REQUEST", "Recursos inválidos.");
    }
  }

  const professionalIdsInput = parseProfessionalIdsInput(payload);
  if (!professionalIdsInput.ok) {
    return academyFail(
      access.ctx,
      professionalIdsInput.status,
      professionalIdsInput.errorCode,
      professionalIdsInput.message,
    );
  }
  const professionalIds = professionalIdsInput.provided ? professionalIdsInput.ids : null;
  if (professionalIds != null && professionalIds.length > 0) {
    const trainerValidation = await assertTrainerIdsBelongToEligibleTeamMembers({
      organizationId: access.organization.id,
      professionalIds,
    });
    if (!trainerValidation.ok) {
      return academyFail(
        access.ctx,
        409,
        "TRAINER_NOT_TEAM_MEMBER",
        "Treinadores inválidos: só membros ativos da Equipa podem ser associados a aulas.",
        { invalidProfessionalIds: trainerValidation.invalidProfessionalIds },
      );
    }
  }

  const assignmentModeRaw =
    typeof payload.assignmentMode === "string" ? payload.assignmentMode.trim().toUpperCase() : null;
  if (
    assignmentModeRaw &&
    !["PROFESSIONAL_ONLY", "RESOURCE_ONLY", "PROFESSIONAL_AND_RESOURCE", "PROFESSIONAL", "RESOURCE"].includes(
      assignmentModeRaw,
    )
  ) {
    return academyFail(
      access.ctx,
      400,
      "BAD_REQUEST",
      "assignmentMode inválido. Usa PROFESSIONAL_ONLY, RESOURCE_ONLY ou PROFESSIONAL_AND_RESOURCE.",
    );
  }
  if (assignmentModeRaw) {
    updates.assignmentMode = normalizeReservationAssignmentMode(assignmentModeRaw);
  }
  const resolvedAssignmentMode = normalizeReservationAssignmentMode(
    typeof updates.assignmentMode === "string" ? updates.assignmentMode : existing.assignmentMode ?? "PROFESSIONAL_ONLY",
  );
  if (resolvedAssignmentMode === "RESOURCE_ONLY") {
    return academyFail(access.ctx, 400, "CLASS_REQUIRES_PROFESSIONAL_MODE", "CLASS_REQUIRES_PROFESSIONAL_MODE");
  }

  const partySizeRules = resolveServicePartySizeRules({
    assignmentMode: resolvedAssignmentMode,
    serviceKind: ServiceKind.CLASS,
    partySizeRequired:
      Object.prototype.hasOwnProperty.call(payload, "partySizeRequired") ? payload.partySizeRequired : existing.partySizeRequired,
    partySizeMin:
      Object.prototype.hasOwnProperty.call(payload, "partySizeMin") ? payload.partySizeMin : existing.partySizeMin,
    partySizeMax:
      Object.prototype.hasOwnProperty.call(payload, "partySizeMax") ? payload.partySizeMax : existing.partySizeMax,
    partySizeStep:
      Object.prototype.hasOwnProperty.call(payload, "partySizeStep") ? payload.partySizeStep : existing.partySizeStep,
  });
  if (requiresPartySizeForAssignmentMode(resolvedAssignmentMode) && !partySizeRules.partySizeRequired) {
    return academyFail(access.ctx, 400, "BAD_REQUEST", "partySizeRequired é obrigatório para aulas com recurso.");
  }
  updates.partySizeRequired = partySizeRules.partySizeRequired;
  updates.partySizeMin = partySizeRules.partySizeMin;
  updates.partySizeMax = partySizeRules.partySizeMax;
  updates.partySizeStep = partySizeRules.partySizeStep;

  let shouldUpdateCategory = false;
  let nextCategoryTag: string | null = null;
  if (typeof payload.categoryTag === "string") {
    shouldUpdateCategory = true;
    nextCategoryTag = payload.categoryTag.trim() || null;
  } else if (payload.categoryTag === null) {
    shouldUpdateCategory = true;
    nextCategoryTag = null;
  }

  if (
    Object.keys(updates).length === 0 &&
    professionalIds === null &&
    resourceIds === null &&
    !shouldUpdateCategory
  ) {
    return academyFail(access.ctx, 400, "BAD_REQUEST", "Sem alterações.");
  }

  const nextUnitPrice =
    typeof updates.unitPriceCents === "number" ? updates.unitPriceCents : existing.unitPriceCents;
  const paidWriteGate = evaluatePaidWriteGate({
    organizationId: access.organization.id,
    orgType: access.organization.orgType ?? null,
    officialEmail: access.organization.officialEmail ?? null,
    officialEmailVerifiedAt: access.organization.officialEmailVerifiedAt ?? null,
    stripeAccountId: access.organization.stripeAccountId ?? null,
    stripeChargesEnabled: access.organization.stripeChargesEnabled ?? false,
    stripePayoutsEnabled: access.organization.stripePayoutsEnabled ?? false,
    amountCents: nextUnitPrice,
  });
  if (!paidWriteGate.ok) {
    return academyFail(
      access.ctx,
      403,
      paidWriteGate.errorCode,
      paidWriteGate.message,
      paidWriteGate.details,
    );
  }

  const service = await prisma.$transaction(async (tx) => {
    if (shouldUpdateCategory) {
      const category = await ensureClassCategory({
        tx,
        organizationId: access.organization.id,
        categoryTag: nextCategoryTag,
      });
      updates.categoryId = category.id;
      updates.categoryTag = category.label;
    }

    if (Object.keys(updates).length > 0) {
      await tx.service.update({
        where: { id: classId },
        data: updates,
        select: { id: true },
      });
    }

    if (professionalIds != null) {
      await tx.serviceProfessionalLink.deleteMany({ where: { serviceId: classId } });
      if (professionalIds.length > 0) {
        await tx.serviceProfessionalLink.createMany({
          data: professionalIds.map((professionalId) => ({ serviceId: classId, professionalId })),
        });
      }
    }

    if (resourceIds != null) {
      await tx.serviceResourceLink.deleteMany({ where: { serviceId: classId } });
      if (resourceIds.length > 0) {
        await tx.serviceResourceLink.createMany({
          data: resourceIds.map((resourceId) => ({ serviceId: classId, resourceId })),
        });
      }
    }

    return tx.service.findUnique({
      where: { id: classId },
      select: CLASS_DETAIL_SELECT,
    });
  });

  if (!service) {
    return academyFail(access.ctx, 404, "NOT_FOUND", "Aula não encontrada.");
  }

  const mapped = mapClassService(service);
  return respondOk(access.ctx, {
    service: mapped,
    class: mapped,
  });
}

export async function handleAcademyClassDelete(req: NextRequest, classIdRaw: string) {
  const access = await resolveAcademyOrgAccess(req);
  if (!access.ok) return access.response;

  const classId = parseClassId(classIdRaw);
  if (!classId) {
    return academyFail(access.ctx, 400, "BAD_REQUEST", "Aula inválida.");
  }

  const writeAccess = ensureOrganizationWriteAccess(access.organization, {
    requireStripeForServices: false,
    skipEmailGate: true,
  });
  if (!writeAccess.ok) {
    return academyFail(
      access.ctx,
      403,
      String(writeAccess.errorCode ?? "FORBIDDEN"),
      String(writeAccess.errorCode ?? "Sem permissões."),
    );
  }

  const existing = await prisma.service.findFirst({
    where: {
      id: classId,
      organizationId: access.organization.id,
      kind: ServiceKind.CLASS,
    },
    select: { id: true },
  });
  if (!existing) {
    return academyFail(access.ctx, 404, "NOT_FOUND", "Aula não encontrada.");
  }

  await prisma.service.update({
    where: { id: classId },
    data: { isActive: false },
  });

  return respondOk(access.ctx, { deleted: true });
}
