// app/api/org/[orgId]/events/create/route.ts
import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { appendEventLog } from "@/domain/eventLog/append";
import {
  resolveAllowedPayoutModeForOrganization,
  requiresOrganizationStripe,
  validateRequestedPayoutMode,
} from "@/domain/finance/payoutModePolicy";
import { SourceType, EventPricingMode } from "@prisma/client";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { recordSearchIndexOutbox } from "@/domain/searchIndex/outbox";
import { validateZeroPriceGuard } from "@/domain/events/pricingGuard";
import { createEventAccessPolicyVersion } from "@/lib/checkin/accessPolicy";
import { resolveEventAccessPolicyInput } from "@/lib/events/accessPolicy";
import { isEndsAtAfterStart } from "@/lib/events/schedule";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { normalizeInterestIds } from "@/lib/ranking/interests";
import {
  EventTemplateType,
  EventStatus,
  PayoutMode,
  Prisma,
  AddressSourceProvider,
  OrganizationModule,
} from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  normalizeEventResourceInput,
  persistEventResourceSelection,
  validateEventResourceSelection,
} from "@/lib/events/resources";
import { EventResourceClaimsError, syncEventResourceClaims } from "@/lib/events/resourceClaims";
import { emitEventConsumesResourcesMetric, extractConflictsCount } from "@/lib/events/metrics";

// Tipos esperados no body do pedido
type TicketTypeInput = {
  name?: string;
  price?: number;
  totalQuantity?: number | null;
  publicAccess?: boolean;
  participantAccess?: boolean;
};

type CreateOrganizationEventBody = {
  title?: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  status?: string;
  timezone?: string;
  templateType?: string;
  interestTags?: string[];
  ticketTypes?: TicketTypeInput[];
  addressId?: string | null;
  pricingMode?: string | null;
  coverImageUrl?: string | null;
  payoutMode?: string; // ORGANIZATION | PLATFORM
  feeMode?: string;
  platformFeeBps?: number;
  platformFeeFixedCents?: number;
  accessPolicy?: Record<string, unknown> | null;
  padel?: Record<string, unknown> | null;
  consumesResources?: boolean | string;
  resourceIds?: unknown[];
  professionalIds?: unknown[];
};

class EventResourceInputError extends Error {
  code: string;
  details?: Record<string, unknown>;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ADDRESS_SELECT = {
  id: true,
  formattedAddress: true,
  canonical: true,
  latitude: true,
  longitude: true,
  sourceProvider: true,
  sourceProviderPlaceId: true,
  confidenceScore: true,
  validationStatus: true,
} satisfies Prisma.AddressSelect;

async function generateUniqueSlug(baseSlug: string) {
  const existingRaw = await prisma.event.findMany({
    where: { slug: { startsWith: baseSlug } },
    select: { slug: true },
  });
  const existing = Array.isArray(existingRaw) ? existingRaw : [];

  if (existing.length === 0) return baseSlug;

  const slugs = new Set(existing.map((row) => row.slug));
  if (!slugs.has(baseSlug)) return baseSlug;

  const pattern = new RegExp(`^${escapeRegExp(baseSlug)}-(\\d+)$`);
  let maxSuffix = 1;
  slugs.forEach((slug) => {
    const match = slug.match(pattern);
    if (!match) return;
    const value = Number(match[1]);
    if (Number.isFinite(value)) {
      maxSuffix = Math.max(maxSuffix, value);
    }
  });

  return `${baseSlug}-${maxSuffix + 1}`;
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  let metricOrganizationId: number | null = null;
  let metricEventId: number | null = null;
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
    details?: Record<string, unknown>,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(
      ctx,
      { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
      { status },
    );
  };
  try {
    let body: CreateOrganizationEventBody | null = null;

    try {
      body = (await req.json()) as CreateOrganizationEventBody;
    } catch {
      return fail(400, "Body inválido.");
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    // Confirmar perfil e onboarding do utilizador (caso o user tenha contornado o onboarding)
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return fail(
        400,
        "Perfil não encontrado. Completa o onboarding de utilizador antes de criares eventos de organização.",
      );
    }
    const hasUserOnboarding =
      profile.onboardingDone ||
      (Boolean(profile.fullName?.trim()) && Boolean(profile.username?.trim()));
    if (!hasUserOnboarding) {
      return fail(
        400,
        "Completa o onboarding de utilizador (nome e username) antes de criares eventos de organização.",
      );
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    if (!organizationId) {
      return fail(400, "ORG_ID_REQUIRED");
    }
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId,
      roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
    });
    metricOrganizationId = organization?.id ?? null;
    if (!organization || !membership) {
      return fail(403, "FORBIDDEN");
    }
    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.EVENTOS,
      required: "EDIT",
    });
    if (!access.ok) {
      return fail(403, "FORBIDDEN");
    }
    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "EVENTS_CREATE" });
    if (!emailGate.ok) {
      return respondError(
        ctx,
        {
          errorCode: emailGate.errorCode ?? "FORBIDDEN",
          message: emailGate.message ?? emailGate.errorCode ?? "Sem permissões.",
          retryable: false,
          details: emailGate,
        },
        { status: 403 },
      );
    }
    const isAdmin = Array.isArray(profile.roles) ? profile.roles.includes("admin") : false;
    const organizationInfo = await prisma.organization.findUnique({
      where: { id: organization.id },
      select: {
        id: true,
        orgType: true,
        officialEmail: true,
        officialEmailVerifiedAt: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
      },
    });
    if (!organizationInfo) {
      return fail(403, "FORBIDDEN");
    }
    const title = body.title?.trim();
    const description = body.description?.trim() ?? "";
    const startsAtRaw = body.startsAt;
    const endsAtRaw = body.endsAt;
    const addressIdInput = typeof body.addressId === "string" ? body.addressId.trim() || null : null;
    const templateTypeRaw = body.templateType?.toUpperCase();
    const payoutModeRequested =
      typeof body.payoutMode === "string"
        ? body.payoutMode.toUpperCase() === "PLATFORM"
          ? PayoutMode.PLATFORM
          : PayoutMode.ORGANIZATION
        : null;
    if (payoutModeRequested) {
      const payoutModeValidation = validateRequestedPayoutMode(organizationInfo.orgType, payoutModeRequested);
      if (!payoutModeValidation.ok) {
        return fail(
          400,
          "Payout mode inválido para o tipo da organização.",
          "INVALID_PAYOUT_MODE",
          false,
          {
            orgType: payoutModeValidation.orgType,
            requestedPayoutMode: payoutModeValidation.requestedPayoutMode,
            allowedPayoutMode: payoutModeValidation.allowedPayoutMode,
          },
        );
      }
    }
    const payoutMode: PayoutMode = resolveAllowedPayoutModeForOrganization(
      organizationInfo.orgType,
      payoutModeRequested,
    );
    const statusRaw = typeof body.status === "string" ? body.status.trim().toUpperCase() : null;
    if (statusRaw && statusRaw !== "PUBLISHED") {
      return fail(400, "UNSUPPORTED_EVENT_STATUS_ON_CREATE");
    }
    const eventStatus: EventStatus = EventStatus.PUBLISHED;
    const timezone =
      typeof body.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : null;

    if (!title) {
      return fail(400, "Título é obrigatório.");
    }

    if (!addressIdInput) {
      return fail(400, "Seleciona uma morada normalizada.");
    }
    const addressRecord = await prisma.address.findUnique({ where: { id: addressIdInput }, select: ADDRESS_SELECT });
    if (!addressRecord) {
      return fail(400, "Morada inválida.");
    }
    if (addressRecord.sourceProvider !== AddressSourceProvider.APPLE_MAPS) {
      return fail(400, "Morada deve ser Apple Maps.");
    }

    if (!startsAtRaw) {
      return fail(400, "Data/hora de início é obrigatória.");
    }

    const parseDate = (raw?: string | null) => {
      if (!raw) return null;
      const normalized = raw.replace(" ", "T");
      const date = new Date(normalized);
      if (!Number.isNaN(date.getTime())) return date;
      const alt = new Date(`${normalized}:00`);
      if (!Number.isNaN(alt.getTime())) return alt;
      return null;
    };

    const startsAt = parseDate(startsAtRaw);
    if (!startsAt) {
      return fail(400, "Data/hora de início inválida.");
    }

    const endsAtParsed = parseDate(endsAtRaw);
    if (!endsAtParsed) {
      return fail(400, "Data/hora de fim é obrigatória.");
    }
    if (!isEndsAtAfterStart(startsAt, endsAtParsed)) {
      return fail(400, "A data/hora de fim tem de ser depois do início.");
    }
    const endsAt = endsAtParsed;

    const padelRequested = Boolean(body.padel) || templateTypeRaw === "PADEL";
    if (padelRequested) {
      return fail(410, "PADEL_CREATE_MOVED", "PADEL_CREATE_MOVED", false, {
        target: `/org/${organization.id}/padel/tournaments/create`,
      });
    }

    const normalizedResources = normalizeEventResourceInput({
      consumesResources: body.consumesResources,
      resourceIds: body.resourceIds,
      professionalIds: body.professionalIds,
    });
    const hasResourceSelectionPayload =
      normalizedResources.resourceIds.length > 0 || normalizedResources.professionalIds.length > 0;
    const consumesResources =
      normalizedResources.consumesResources === true ||
      (normalizedResources.consumesResources === null && hasResourceSelectionPayload);
    if (normalizedResources.consumesResources === false && hasResourceSelectionPayload) {
      return fail(
        400,
        "EVENT_RESOURCES_REQUIRES_CONSUMES_FLAG",
        "EVENT_RESOURCES_REQUIRES_CONSUMES_FLAG",
        false,
      );
    }

    const templateType: EventTemplateType =
      templateTypeRaw === "VOLUNTEERING" ? EventTemplateType.VOLUNTEERING : EventTemplateType.OTHER;

    const ticketTypesInput = body.ticketTypes ?? [];
    const coverImageUrl = body.coverImageUrl?.trim?.() || null;
    // Validar tipos de bilhete
    let ticketPriceError: string | null = null;
    const ticketTypesData = ticketTypesInput
      .map((t) => {
        const name = t.name?.trim();
        if (!name) return null;

        const priceRaw =
          typeof t.price === "number" && !Number.isNaN(t.price) ? t.price : 0;

        if (priceRaw < 0 && !ticketPriceError) {
          ticketPriceError = "Preço de bilhete não pode ser negativo.";
          return null;
        }

        // preço mínimo 1 € (ou 0 para grátis)
        if (priceRaw > 0 && priceRaw < 1 && !ticketPriceError) {
          ticketPriceError = "O preço mínimo de bilhete é 1,00 € (ou grátis).";
          return null;
        }

        const totalQuantity =
          typeof t.totalQuantity === "number" && Number.isFinite(t.totalQuantity) && t.totalQuantity > 0
            ? Math.floor(t.totalQuantity)
            : null;

        return {
          name,
          price: priceRaw,
          totalQuantity,
          publicAccess: t.publicAccess !== false,
          participantAccess: t.participantAccess === true,
        };
      })
      .filter((t): t is { name: string; price: number; totalQuantity: number | null; publicAccess: boolean; participantAccess: boolean } =>
        Boolean(t)
      );

    if (ticketPriceError) {
      return fail(400, ticketPriceError);
    }

    const pricingModeRaw = typeof body.pricingMode === "string" ? body.pricingMode.trim().toUpperCase() : null;
    const interestTags = normalizeInterestIds(body.interestTags ?? []);
    const ticketPrices = ticketTypesData.map((t) => t.price);
    const hasZeroTicket = ticketPrices.some((price) => price === 0);
    const hasPaidTicket = ticketPrices.some((price) => price > 0);
    const pricingMode =
      pricingModeRaw === EventPricingMode.FREE_ONLY
        ? EventPricingMode.FREE_ONLY
        : pricingModeRaw === EventPricingMode.STANDARD
          ? EventPricingMode.STANDARD
          : hasZeroTicket && !hasPaidTicket
            ? EventPricingMode.FREE_ONLY
            : EventPricingMode.STANDARD;
    const guard = validateZeroPriceGuard({
      pricingMode,
      ticketPrices,
    });
    if (!guard.ok) {
      return fail(400, guard.error);
    }

    const accessPolicyResolution = resolveEventAccessPolicyInput({
      accessPolicy:
        (body as { accessPolicy?: Record<string, unknown> | null })?.accessPolicy ?? null,
      templateType,
    });
    const accessPolicyInput = accessPolicyResolution.policyInput;

    const hasPaidTickets = ticketTypesData.some((t) => t.price > 0);
    if (hasPaidTickets && !isAdmin) {
      const gate = getPaidSalesGate({
        officialEmail: organizationInfo.officialEmail ?? null,
        officialEmailVerifiedAt: organizationInfo.officialEmailVerifiedAt ?? null,
        stripeAccountId: organizationInfo.stripeAccountId ?? null,
        stripeChargesEnabled: organizationInfo.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: organizationInfo.stripePayoutsEnabled ?? false,
        requireStripe: requiresOrganizationStripe(organizationInfo.orgType),
      });
      if (!gate.ok) {
        return respondError(
          ctx,
          {
            errorCode: "PAYMENTS_NOT_READY",
            message: formatPaidSalesGateMessage(gate, "Para vender bilhetes pagos,"),
            retryable: false,
            details: {
              missingEmail: gate.missingEmail,
              missingStripe: gate.missingStripe,
            },
          },
          { status: 403 },
        );
      }
    }

    const baseSlug = slugify(title) || "evento";
    const slug = await generateUniqueSlug(baseSlug);

    // Criar o evento + EventLog/Outbox na mesma tx
    let claimsApplied = false;
    let claimsCreated = 0;
    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          slug,
          title,
          description,
          type: "ORGANIZATION_EVENT",
          templateType,
          interestTags,
          ownerUserId: profile.id,
          organizationId: organization?.id ?? null,
          startsAt,
          endsAt,
          addressId: addressRecord.id,
          pricingMode,
          status: eventStatus,
          consumesResources,
          ...(timezone ? { timezone } : {}),
          coverImageUrl,
          payoutMode,
        },
      });

      await createEventAccessPolicyVersion(created.id, accessPolicyInput, tx);
      if (consumesResources) {
        const resourceValidation = await validateEventResourceSelection({
          tx,
          organizationId: organization.id,
          selection: {
            resourceIds: normalizedResources.resourceIds,
            professionalIds: normalizedResources.professionalIds,
          },
          requireNonEmpty: true,
        });
        if (!resourceValidation.ok) {
          throw new EventResourceInputError(
            resourceValidation.code,
            resourceValidation.message,
            resourceValidation.details,
          );
        }
        await persistEventResourceSelection({
          tx,
          eventId: created.id,
          selection: resourceValidation.selection,
        });
        const claimSync = await syncEventResourceClaims({
          tx,
          organizationId: organization.id,
          eventId: created.id,
          startsAt: created.startsAt,
          endsAt: created.endsAt,
          status: created.status,
          consumesResources,
        });
        claimsApplied = claimSync.applied === true;
        claimsCreated = claimSync.applied === true ? claimSync.claimsCreated : 0;
      }

      if (created.organizationId) {
        const eventIdLog = crypto.randomUUID();
        await appendEventLog(
          {
            eventId: eventIdLog,
            organizationId: created.organizationId,
            eventType: "event.created",
            idempotencyKey: `event.created:${created.id}`,
            actorUserId: profile.id,
            sourceType: SourceType.EVENT,
            sourceId: String(created.id),
            correlationId: String(created.id),
            payload: {
              eventId: created.id,
              title: created.title,
              startsAt: created.startsAt,
              endsAt: created.endsAt,
              status: created.status,
              organizationId: created.organizationId,
            },
          },
          tx,
        );
        await recordOutboxEvent(
          {
            eventId: eventIdLog,
            eventType: "event.created",
            dedupeKey: `event.created:${created.id}`,
            payload: {
              eventId: created.id,
              title: created.title,
              startsAt: created.startsAt,
              endsAt: created.endsAt,
              status: created.status,
              organizationId: created.organizationId,
            },
            correlationId: String(created.id),
          },
          tx,
        );
        await recordSearchIndexOutbox(
          {
            eventLogId: eventIdLog,
            organizationId: created.organizationId,
            sourceType: SourceType.EVENT,
            sourceId: String(created.id),
            correlationId: String(created.id),
          },
          tx,
        );
      }

      return created;
    });

    const autoTicketTypes =
      ticketTypesData.length === 0
        ? [
            {
              name: "Entrada gratuita",
              price: 0,
              totalQuantity: null,
              publicAccess: true,
              participantAccess: false,
            },
          ]
        : ticketTypesData;

    for (const ticket of autoTicketTypes) {
      await prisma.ticketType.create({
        data: {
          eventId: event.id,
          name: ticket.name,
          price: Math.round(ticket.price * 100),
          publicAccess: ticket.publicAccess,
          participantAccess: ticket.participantAccess,
          totalQuantity: ticket.totalQuantity ?? null,
          currency: "EUR",
          padelEventCategoryLinkId: null,
        },
        select: { id: true },
      });
    }
    metricEventId = event.id;
    emitEventConsumesResourcesMetric("event_consumes_resources.create", {
      operation: "create",
      organizationId: event.organizationId ?? metricOrganizationId,
      eventId: event.id,
      status: "success",
      reason: consumesResources ? "consumes_resources_enabled" : "consumes_resources_disabled",
      applied: claimsApplied,
      claimsCreated,
    });

    return respondOk(
      ctx,
      {
        event: {
          id: event.id,
          slug: event.slug,
          title: event.title,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    const message = err instanceof Error ? err.message : "";
    if (err instanceof EventResourceInputError) {
      emitEventConsumesResourcesMetric("event_consumes_resources.create", {
        operation: "create",
        organizationId: metricOrganizationId,
        eventId: metricEventId,
        status: "failure",
        reason: err.code || "EVENT_RESOURCES_INVALID",
      });
      return fail(
        400,
        err.message || "Recursos do evento inválidos.",
        err.code || "EVENT_RESOURCES_INVALID",
        false,
        err.details,
      );
    }
    if (err instanceof EventResourceClaimsError) {
      const conflictsCount = extractConflictsCount(err.details);
      if (conflictsCount > 0) {
        emitEventConsumesResourcesMetric("event_consumes_resources.conflict", {
          operation: "create",
          organizationId: metricOrganizationId,
          eventId: metricEventId,
          conflictsCount,
        });
      }
      emitEventConsumesResourcesMetric("event_consumes_resources.create", {
        operation: "create",
        organizationId: metricOrganizationId,
        eventId: metricEventId,
        status: "failure",
        reason: err.code || "EVENT_RESOURCES_CONFLICT",
        conflictsCount,
      });
      return fail(
        err.status,
        err.message || "Conflito de recursos do evento.",
        err.code || "EVENT_RESOURCES_CONFLICT",
        false,
        err.details,
      );
    }
    if (message === "INVITE_TOKEN_REQUIRES_EMAIL") {
      return fail(400, "INVITE_TOKEN_REQUIRES_EMAIL");
    }
    console.error("POST /api/org/[orgId]/events/create error:", err);
    return fail(500, "Erro interno ao criar evento.");
  }
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
export const POST = withApiEnvelope(_POST);
