// app/api/org/[orgId]/events/update/route.ts
import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import {
  TicketTypeStatus,
  Prisma,
  EventTemplateType,
  EventStatus,
  EventPricingMode,
  AddressSourceProvider,
  PayoutMode,
  OrganizationMemberRole,
  OrganizationRolePack,
  CheckinMethod,
  EventAccessMode,
  InviteIdentityMatch,
  OrganizationModule,
} from "@prisma/client";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import {
  resolveAllowedPayoutModeForOrganization,
  requiresOrganizationStripe,
  validateRequestedPayoutMode,
} from "@/domain/finance/payoutModePolicy";
import { createEventAccessPolicyVersion } from "@/lib/checkin/accessPolicy";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { appendEventLog } from "@/domain/eventLog/append";
import { SourceType } from "@prisma/client";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { recordSearchIndexOutbox } from "@/domain/searchIndex/outbox";
import { validateZeroPriceGuard } from "@/domain/events/pricingGuard";
import { shouldEmitSearchIndexUpdate } from "@/domain/searchIndex/triggers";
import { normalizeInterestIds } from "@/lib/ranking/interests";
import { isEndsAtAfterStart } from "@/lib/events/schedule";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { resolveRequiredOrganizationIdFromRequest } from "@/lib/organizationId";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { refundKey } from "@/lib/stripe/idempotency";

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(obj[key]);
        return acc;
      }, {});
  }
  return value;
};

const hashPayload = (payload: Record<string, unknown>) =>
  crypto.createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");

type TicketTypeUpdate = {
  id: number;
  status?: TicketTypeStatus;
  publicAccess?: boolean;
};

type NewTicketType = {
  name: string;
  description?: string | null;
  price: number; // cents
  publicAccess?: boolean;
  participantAccess?: boolean;
  totalQuantity?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  padelEventCategoryLinkId?: number | null;
};

type UpdateEventBody = {
  eventId?: number;
  deleteDraft?: boolean;
  status?: string | null;
  title?: string | null;
  slug?: string | null;
  description?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  addressId?: string | null;
  templateType?: string | null;
  interestTags?: string[] | null;
  isGratis?: boolean;
  pricingMode?: string | null;
  coverImageUrl?: string | null;
  ticketTypeUpdates?: TicketTypeUpdate[];
  newTicketTypes?: NewTicketType[];
  payoutMode?: string | null;
  accessPolicy?: {
    mode: EventAccessMode;
    guestCheckoutAllowed: boolean;
    inviteTokenAllowed: boolean;
    inviteIdentityMatch: InviteIdentityMatch;
    inviteTokenTtlSeconds?: number | null;
    requiresEntitlementForEntry: boolean;
    checkinMethods?: CheckinMethod[] | null;
    scannerRequired?: boolean | null;
    allowReentry?: boolean | null;
    reentryWindowMinutes?: number | null;
    maxEntries?: number | null;
    undoWindowMinutes?: number | null;
  } | null;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function generateUniqueSlug(baseSlug: string, eventId?: number) {
  const existing = await prisma.event.findMany({
    where: {
      slug: { startsWith: baseSlug },
      ...(eventId ? { NOT: { id: eventId } } : {}),
    },
    select: { slug: true },
  });

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
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    let body: UpdateEventBody | null = null;
    try {
      body = (await req.json()) as UpdateEventBody;
    } catch {
      return fail(400, "Body inválido.");
    }

    const eventId = Number(body?.eventId);
    if (!eventId || Number.isNaN(eventId)) {
      return fail(400, "eventId é obrigatório.");
    }
    const orgResolution = resolveRequiredOrganizationIdFromRequest(req);
    if (!orgResolution.ok) {
      return fail(400, "ORG_ID_REQUIRED");
    }
    const requestOrganizationId = orgResolution.organizationId;

    // Autorização: perfil + membership no organization do evento
    let event: {
      id: number;
      slug: string;
      title: string;
      startsAt: Date;
      endsAt: Date | null;
      status: EventStatus;
      organizationId: number | null;
      pricingMode: EventPricingMode | null;
      templateType: EventTemplateType | null;
      interestTags: string[];
      payoutMode: PayoutMode | null;
      addressId?: string | null;
      ticketTypes: { id: number; soldQuantity: number; price: number; status: TicketTypeStatus; currency: string | null }[];
      organization: {
        id: number;
        username: string | null;
        stripeAccountId: string | null;
        stripeChargesEnabled: boolean;
        stripePayoutsEnabled: boolean;
        orgType?: string | null;
        officialEmail?: string | null;
        officialEmailVerifiedAt?: Date | null;
      } | null;
      _count: { tickets: number; reservations: number; saleLines?: number };
    } | null = null;

    const [profile, eventResult] = await Promise.all([
      prisma.profile.findUnique({
        where: { id: user.id },
        select: { roles: true, onboardingDone: true, fullName: true, username: true },
      }),
      (async () => {
        try {
          return await prisma.event.findUnique({
            where: { id: eventId },
            select: {
              id: true,
              slug: true,
              title: true,
              startsAt: true,
              endsAt: true,
              status: true,
              organizationId: true,
              pricingMode: true,
              templateType: true,
              interestTags: true,
              payoutMode: true,
              addressId: true,
              ticketTypes: {
                select: {
                  id: true,
                  soldQuantity: true,
                  price: true,
                  status: true,
                  currency: true,
                },
              },
              organization: {
                select: {
                  id: true,
                  username: true,
                  orgType: true,
                  stripeAccountId: true,
                  stripeChargesEnabled: true,
                  stripePayoutsEnabled: true,
                  officialEmail: true,
                  officialEmailVerifiedAt: true,
                },
              },
              _count: {
                select: {
                  tickets: true,
                  reservations: true,
                },
              },
            },
          });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2022") {
            const rows = await prisma.$queryRaw<
              {
                id: number;
                slug: string;
                title: string;
                starts_at: Date;
                ends_at: Date | null;
                status: EventStatus;
                organization_id: number | null;
                payout_mode: PayoutMode | null;
                pricing_mode: EventPricingMode | null;
                template_type: EventTemplateType | null;
                address_id: string | null;
                interest_tags: string[] | null;
              }[]
            >(
              Prisma.sql`SELECT id, slug, title, starts_at, ends_at, status, organization_id, payout_mode, pricing_mode, template_type, address_id, interest_tags FROM app_v3.events WHERE id = ${eventId} LIMIT 1`,
            );
            const row = rows[0];
            if (!row) return null;
            const [ticketTypes, organizationRows, counts] = await Promise.all([
              prisma.$queryRaw<
                { id: number; sold_quantity: number; price: number; status: TicketTypeStatus; currency: string | null }[]
              >(Prisma.sql`SELECT id, sold_quantity, price, status, currency FROM app_v3.ticket_types WHERE event_id = ${eventId}`),
              row.organization_id
                ? prisma.$queryRaw<
                    {
                      stripe_account_id: string | null;
                      stripe_charges_enabled: boolean;
                      stripe_payouts_enabled: boolean;
                      org_type: string | null;
                      official_email: string | null;
                      official_email_verified_at: Date | null;
                    }[]
                  >(Prisma.sql`
                    SELECT stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, org_type, official_email, official_email_verified_at
                    FROM app_v3.organizations
                    WHERE id = ${row.organization_id}
                    LIMIT 1
                  `)
                : Promise.resolve([]),
              prisma.$queryRaw<{ tickets: number; reservations: number }[]>(Prisma.sql`
                SELECT
                  (SELECT COUNT(*)::int FROM app_v3.tickets WHERE event_id = ${eventId}) AS tickets,
                  (SELECT COUNT(*)::int FROM app_v3.ticket_reservations WHERE event_id = ${eventId}) AS reservations
              `),
            ]);

            return {
              id: row.id,
              slug: row.slug,
              title: row.title,
              startsAt: row.starts_at,
              endsAt: row.ends_at,
              status: row.status,
              organizationId: row.organization_id,
              pricingMode: row.pricing_mode ?? null,
              templateType: row.template_type ?? null,
              interestTags: row.interest_tags ?? [],
              payoutMode: row.payout_mode,
              addressId: row.address_id,
              ticketTypes: ticketTypes.map((t) => ({
                id: t.id,
                soldQuantity: Number(t.sold_quantity ?? 0),
                price: Number(t.price ?? 0),
                status: t.status,
                currency: t.currency ?? null,
              })),
              organization: organizationRows[0]
                ? {
                    id: row.organization_id as number,
                    username: null,
                    orgType: organizationRows[0].org_type ?? null,
                    stripeAccountId: organizationRows[0].stripe_account_id,
                    stripeChargesEnabled: organizationRows[0].stripe_charges_enabled,
                    stripePayoutsEnabled: organizationRows[0].stripe_payouts_enabled,
                    officialEmail: organizationRows[0].official_email,
                    officialEmailVerifiedAt: organizationRows[0].official_email_verified_at,
                  }
                : null,
              _count: {
                tickets: counts[0]?.tickets ?? 0,
                reservations: counts[0]?.reservations ?? 0,
                saleLines: 0,
              },
            };
          }
          throw err;
        }
      })(),
    ]);

    if (!profile) {
      return fail(400, "Perfil não encontrado. Completa o onboarding de utilizador.");
    }
    const hasUserOnboarding =
      profile.onboardingDone ||
      (Boolean(profile.fullName?.trim()) && Boolean(profile.username?.trim()));
    if (!hasUserOnboarding) {
      return fail(400, "Completa o onboarding de utilizador (nome e username) antes de editares eventos.");
    }

    event = eventResult;

    if (!event) {
      return fail(404, "Evento não encontrado.");
    }
    if (event.organizationId !== requestOrganizationId) {
      return fail(404, "Evento não encontrado.");
    }
    const requestedStatusRawPrecheck =
      typeof body.status === "string" ? body.status.trim().toUpperCase() : null;
    const isLifecycleOnlyRequest =
      body.deleteDraft === true || requestedStatusRawPrecheck === "CANCELLED";
    if ((!event.endsAt || Number.isNaN(event.endsAt.getTime())) && !isLifecycleOnlyRequest) {
      return fail(409, "Evento inválido: data/hora de fim em falta. Corrige o schedule.");
    }

    const isAdmin = Array.isArray(profile.roles) ? profile.roles.includes("admin") : false;

    let membership: { role: OrganizationMemberRole; rolePack: OrganizationRolePack | null } | null = null;
    if (event.organizationId == null) {
      if (!isAdmin) {
        return fail(403, "FORBIDDEN");
      }
    } else {
      membership = await resolveGroupMemberForOrg({ organizationId: event.organizationId, userId: user.id });
      if (!membership) {
        return fail(403, "FORBIDDEN");
      }
      const access = await ensureMemberModuleAccess({
        organizationId: event.organizationId,
        userId: user.id,
        role: membership.role,
        rolePack: membership.rolePack,
        moduleKey: OrganizationModule.EVENTOS,
        required: "EDIT",
      });
      if (!access.ok) {
        return fail(403, "FORBIDDEN");
      }
    }

    if (event.organization) {
      const emailGate = ensureOrganizationEmailVerified(event.organization, {
        reasonCode: "EVENTS_UPDATE",
        organizationId: event.organizationId ?? null,
      });
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
    }

    const requestedStatus =
      typeof body.status === "string" ? body.status.trim().toUpperCase() : null;
    if ((body as Record<string, unknown> | null)?.archive === true) {
      return fail(400, "ARCHIVE_REMOVED_USE_STATUS_OR_DELETE");
    }

    const shouldDeleteDraft = body.deleteDraft === true;
    const hasTicketTypeUpdatesPayload =
      Array.isArray(body.ticketTypeUpdates) && body.ticketTypeUpdates.length > 0;
    const hasNewTicketTypesPayload =
      Array.isArray(body.newTicketTypes) && body.newTicketTypes.length > 0;

    if (String(event.status) === "CANCELLED") {
      return fail(409, "EVENT_CANCELLED_TERMINAL");
    }
    if (requestedStatus && requestedStatus !== "CANCELLED") {
      return fail(400, "UNSUPPORTED_EVENT_STATUS_TRANSITION");
    }
    const shouldCancelEvent =
      requestedStatus === "CANCELLED" &&
      String(event.status) !== "CANCELLED";
    const eventEndsAt = event.endsAt ? new Date(event.endsAt) : null;
    const endedByDate =
      eventEndsAt && Number.isFinite(eventEndsAt.getTime())
        ? eventEndsAt.getTime() < Date.now()
        : false;
    if (shouldCancelEvent && (String(event.status) === "FINISHED" || endedByDate)) {
      return fail(409, "EVENT_ALREADY_FINISHED");
    }

    const hasLifecycleAction = shouldDeleteDraft || shouldCancelEvent;
    if (hasLifecycleAction) {
      const hasOtherMutations =
        body.title !== undefined ||
        body.slug !== undefined ||
        body.description !== undefined ||
        body.startsAt !== undefined ||
        body.endsAt !== undefined ||
        body.addressId !== undefined ||
        body.templateType !== undefined ||
        body.interestTags !== undefined ||
        body.isGratis !== undefined ||
        body.pricingMode !== undefined ||
        body.coverImageUrl !== undefined ||
        body.payoutMode !== undefined ||
        body.accessPolicy !== undefined ||
        hasTicketTypeUpdatesPayload ||
        hasNewTicketTypesPayload ||
        (shouldDeleteDraft && requestedStatus !== null);
      if (hasOtherMutations) {
        return fail(
          400,
          shouldDeleteDraft
            ? "DRAFT_DELETE_REQUIRES_EXCLUSIVE_ACTION"
            : "CANCEL_STATUS_REQUIRES_EXCLUSIVE_ACTION",
        );
      }
    }

    if (shouldDeleteDraft) {
      if (String(event.status) !== "DRAFT") {
        return fail(409, "DRAFT_DELETE_ONLY");
      }
      const [paidSalesCount, ticketsCount, reservationsCount, entitlementsCount, registrationsCount] =
        await Promise.all([
          prisma.saleSummary.count({ where: { eventId, status: "PAID" } }),
          prisma.ticket.count({ where: { eventId } }),
          prisma.ticketReservation.count({ where: { eventId } }),
          prisma.entitlement.count({ where: { eventId } }),
          prisma.padelRegistration.count({ where: { eventId } }),
        ]);
      if (
        paidSalesCount > 0 ||
        ticketsCount > 0 ||
        reservationsCount > 0 ||
        entitlementsCount > 0 ||
        registrationsCount > 0
      ) {
        return fail(409, "DRAFT_DELETE_BLOCKED_HAS_OPERATIONS");
      }
      await prisma.event.delete({ where: { id: eventId } });
      return respondOk(ctx, { deleted: true }, { status: 200 });
    }

    if (body.accessPolicy) {
      try {
        await createEventAccessPolicyVersion(event.id, body.accessPolicy);
      } catch (err: any) {
        const message = typeof err?.message === "string" ? err.message : "";
        if (message.startsWith("ACCESS_POLICY_LOCKED")) {
          return fail(409, "ACCESS_POLICY_LOCKED");
        }
        if (message === "INVITE_TOKEN_TTL_REQUIRED") {
          return fail(400, "INVITE_TOKEN_TTL_REQUIRED");
        }
        throw err;
      }
    }

    const hasNonEurTickets = event.ticketTypes.some(
      (t) => t.currency && t.currency.toUpperCase() !== "EUR",
    );
    if (hasNonEurTickets && hasNewTicketTypesPayload) {
      return fail(400, "CURRENCY_NOT_SUPPORTED");
    }

    const organization = event.organization;
    const addressIdInput =
      body.addressId !== undefined
        ? typeof body.addressId === "string"
          ? body.addressId.trim() || null
          : null
        : undefined;
    const addressRecord = addressIdInput
      ? await prisma.address.findUnique({ where: { id: addressIdInput }, select: ADDRESS_SELECT })
      : null;
    if (addressIdInput && !addressRecord) {
      return fail(400, "Morada inválida.");
    }
    if (addressRecord && addressRecord.sourceProvider !== AddressSourceProvider.APPLE_MAPS) {
      return fail(400, "Morada deve ser Apple Maps.");
    }

    const effectiveAddressId =
      (addressRecord?.id ?? (addressIdInput !== undefined ? addressIdInput : event.addressId ?? null)) ?? null;
    if (!effectiveAddressId) {
      return fail(400, "Seleciona uma morada normalizada.");
    }

    const dataUpdate: Partial<Prisma.EventUncheckedUpdateInput> = {};
    if (shouldCancelEvent) {
      dataUpdate.status = "CANCELLED" as any;
    }
    if (body.title !== undefined) {
      const nextTitle = body.title?.trim() ?? "";
      if (!nextTitle) {
        return fail(400, "Título é obrigatório.");
      }
      dataUpdate.title = nextTitle;
    }
    const slugSource =
      body.slug !== undefined
        ? body.slug
        : body.title !== undefined
          ? body.title
          : undefined;
    if (slugSource !== undefined) {
      const baseSlug = slugify(typeof slugSource === "string" ? slugSource : "");
      if (!baseSlug) {
        return fail(400, "Slug inválido.");
      }
      const nextSlug = await generateUniqueSlug(baseSlug, eventId);
      if (nextSlug !== event.slug) {
        dataUpdate.slug = nextSlug;
      }
    }
    if (body.description !== undefined) dataUpdate.description = body.description ?? "";
    if (Array.isArray(body.interestTags)) {
      dataUpdate.interestTags = normalizeInterestIds(body.interestTags);
    }
    if (body.startsAt) {
      const d = new Date(body.startsAt);
      if (Number.isNaN(d.getTime())) {
        return fail(400, "startsAt inválido.");
      }
      dataUpdate.startsAt = d;
    }
    if (body.endsAt) {
      const d = new Date(body.endsAt);
      if (Number.isNaN(d.getTime())) {
        return fail(400, "endsAt inválido.");
      }
      dataUpdate.endsAt = d;
    }
    const scheduleTouched = dataUpdate.startsAt !== undefined || dataUpdate.endsAt !== undefined;
    if (scheduleTouched) {
      const nextStartsAt = (dataUpdate.startsAt ?? event.startsAt) as Date;
      const currentEndsAt = (dataUpdate.endsAt ?? event.endsAt) as Date | null;
      if (!currentEndsAt || Number.isNaN(currentEndsAt.getTime())) {
        return fail(400, "Data/hora de fim é obrigatória.");
      }
      if (!isEndsAtAfterStart(nextStartsAt, currentEndsAt)) {
        return fail(400, "A data/hora de fim tem de ser depois do início.");
      }
    }
    if (addressIdInput !== undefined) {
      dataUpdate.addressId = addressRecord?.id ?? null;
    }
    if (body.templateType) {
      const tpl = body.templateType.toUpperCase();
      if (tpl === "SPORT") {
        dataUpdate.templateType = "PADEL";
      } else if ((Object.values(EventTemplateType) as string[]).includes(tpl)) {
        dataUpdate.templateType = tpl as EventTemplateType;
      }
    }
    if (body.coverImageUrl !== undefined) dataUpdate.coverImageUrl = body.coverImageUrl ?? null;
    if (
      body.payoutMode &&
      (body.payoutMode.toUpperCase() === "PLATFORM" || body.payoutMode.toUpperCase() === "ORGANIZATION")
    ) {
      const requestedPayoutMode = body.payoutMode.toUpperCase() as PayoutMode;
      const payoutModeValidation = validateRequestedPayoutMode(
        organization?.orgType,
        requestedPayoutMode,
      );
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
      if (isAdmin) {
        dataUpdate.payoutMode = resolveAllowedPayoutModeForOrganization(
          organization?.orgType,
          requestedPayoutMode,
        );
      }
    }

    const pricingModeRaw = typeof body.pricingMode === "string" ? body.pricingMode.trim().toUpperCase() : null;
    if (pricingModeRaw === EventPricingMode.FREE_ONLY || pricingModeRaw === EventPricingMode.STANDARD) {
      dataUpdate.pricingMode = pricingModeRaw as EventPricingMode;
    } else if (body.isGratis !== undefined) {
      dataUpdate.pricingMode = body.isGratis ? EventPricingMode.FREE_ONLY : EventPricingMode.STANDARD;
    }

    const ticketTypeUpdates = Array.isArray(body.ticketTypeUpdates)
      ? body.ticketTypeUpdates
      : [];
    const newTicketTypes = Array.isArray(body.newTicketTypes) ? body.newTicketTypes : [];
    const isPadelEvent = event.templateType === "PADEL";
    if (isPadelEvent && (ticketTypeUpdates.length > 0 || newTicketTypes.length > 0)) {
      return fail(400, "PADEL_TICKETS_DISABLED");
    }
    const needsPadelLinkValidation = newTicketTypes.some(
      (nt) => typeof nt?.padelEventCategoryLinkId === "number",
    );
    const validPadelLinkIds = needsPadelLinkValidation
      ? new Set(
          (
            await prisma.padelEventCategoryLink.findMany({
              where: { eventId },
              select: { id: true },
            })
          ).map((link) => link.id),
        )
      : new Set<number>();

    const hasExistingPaid = !isPadelEvent && event.ticketTypes.some((t) => (t.price ?? 0) > 0);
    const hasNewPaid = !isPadelEvent && newTicketTypes.some((nt) => Number(nt.price ?? 0) > 0);
    const requiresStripeForPaidSales = requiresOrganizationStripe(organization?.orgType);
    if (event.organizationId && (hasExistingPaid || hasNewPaid) && !isAdmin) {
      const gate = getPaidSalesGate({
        officialEmail: organization?.officialEmail ?? null,
        officialEmailVerifiedAt: organization?.officialEmailVerifiedAt ?? null,
        stripeAccountId: organization?.stripeAccountId ?? null,
        stripeChargesEnabled: organization?.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: organization?.stripePayoutsEnabled ?? false,
        requireStripe: requiresStripeForPaidSales,
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

    const hasDataUpdate = Object.keys(dataUpdate).length > 0;
    const hasTicketUpdates = ticketTypeUpdates.length > 0;
    const hasNewTickets = newTicketTypes.length > 0;
    const agendaRelevantUpdate =
      dataUpdate.title !== undefined ||
      dataUpdate.startsAt !== undefined ||
      dataUpdate.endsAt !== undefined ||
      dataUpdate.status !== undefined ||
      dataUpdate.interestTags !== undefined;
    const searchIndexRelevantUpdate = shouldEmitSearchIndexUpdate({
      agendaRelevantUpdate,
      hasNewTickets,
      hasTicketStatusUpdates: hasTicketUpdates,
    });
    const eventLogId = searchIndexRelevantUpdate && event.organizationId ? crypto.randomUUID() : null;

    const ticketUpdateOps: Array<{ id: number; data: Prisma.TicketTypeUpdateInput }> = [];
    if (hasTicketUpdates) {
      const updatesById = new Map<number, { status?: TicketTypeStatus; publicAccess?: boolean }>();
      for (const upd of ticketTypeUpdates) {
        const tt = event.ticketTypes.find((t) => t.id === upd.id);
        if (!tt) continue;
        const current = updatesById.get(tt.id) ?? {};
        const status =
          upd.status && Object.values(TicketTypeStatus).includes(upd.status)
            ? upd.status
            : null;
        if (status) current.status = status;
        if (typeof upd.publicAccess === "boolean") current.publicAccess = upd.publicAccess;
        if (current.status !== undefined || current.publicAccess !== undefined) {
          updatesById.set(tt.id, current);
        }
      }
      updatesById.forEach((data, id) => {
        ticketUpdateOps.push({ id, data });
      });
    }

    let newTicketData: Prisma.TicketTypeCreateManyInput[] = [];
    if (hasNewTickets) {
      newTicketData = newTicketTypes.map((nt) => {
        const price = Number(nt.price ?? 0);
        const totalQuantity =
          typeof nt.totalQuantity === "number" && Number.isFinite(nt.totalQuantity) && nt.totalQuantity > 0
            ? Math.floor(nt.totalQuantity)
            : null;
        const startsAt = nt.startsAt ? new Date(nt.startsAt) : null;
        const endsAt = nt.endsAt ? new Date(nt.endsAt) : null;
        const padelLinkId =
          typeof nt.padelEventCategoryLinkId === "number" && Number.isFinite(nt.padelEventCategoryLinkId)
            ? nt.padelEventCategoryLinkId
            : null;
        if (padelLinkId && !validPadelLinkIds.has(padelLinkId)) {
          throw new Error("INVALID_PADEL_CATEGORY_LINK");
        }

        return {
          eventId,
          name: nt.name?.trim() || "Bilhete",
          description: nt.description ?? null,
          price,
          publicAccess: nt.publicAccess !== false,
          participantAccess: nt.participantAccess === true,
          totalQuantity,
          status: TicketTypeStatus.ON_SALE,
          startsAt: startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : null,
          endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
          padelEventCategoryLinkId: padelLinkId,
          currency: "EUR",
        };
      });
    }

    const ticketPrices = isPadelEvent
      ? []
      : [
          ...event.ticketTypes.map((t) => Number(t.price ?? 0)),
          ...newTicketTypes.map((t) => Number(t.price ?? 0)),
        ];
    const nextPricingMode = (dataUpdate.pricingMode ?? event.pricingMode ?? EventPricingMode.STANDARD) as EventPricingMode;
    const guard = validateZeroPriceGuard({ pricingMode: nextPricingMode, ticketPrices });
    if (!guard.ok) {
      return fail(400, guard.error);
    }

    if (!hasDataUpdate && !hasTicketUpdates && !hasNewTickets) {
      return fail(400, "Nada para atualizar.");
    }

    await prisma.$transaction(async (tx) => {
      const txOps: Prisma.PrismaPromise<unknown>[] = [];
      if (hasDataUpdate) {
        txOps.push(
          tx.event.update({
            where: { id: eventId },
            data: dataUpdate,
          }),
        );
      }
      if (shouldCancelEvent) {
        txOps.push(
          tx.ticketType.updateMany({
            where: { eventId },
            data: { status: TicketTypeStatus.CLOSED },
          }),
        );
      }
      if (hasTicketUpdates) {
        ticketUpdateOps.forEach((op) => {
          txOps.push(
            tx.ticketType.update({
              where: { id: op.id },
              data: op.data,
            }),
          );
        });
      }
      if (hasNewTickets && newTicketData.length > 0) {
        txOps.push(
          tx.ticketType.createMany({
            data: newTicketData,
          }),
        );
      }

      if (txOps.length > 0) {
        await Promise.all(txOps);
      }

      if (searchIndexRelevantUpdate && event.organizationId && eventLogId) {
        const nextTitle = (dataUpdate.title ?? event.title) as string;
        const nextStartsAt = (dataUpdate.startsAt ?? event.startsAt) as Date;
        const nextEndsAt = (dataUpdate.endsAt ?? event.endsAt) as Date | null;
        if (!nextEndsAt || Number.isNaN(nextEndsAt.getTime())) {
          throw new Error("EVENT_ENDS_AT_REQUIRED");
        }
        const nextStatus =
          typeof dataUpdate.status === "string" ? dataUpdate.status : (event.status as string);
        const nextInterestTags = Array.isArray(dataUpdate.interestTags)
          ? dataUpdate.interestTags
          : event.interestTags ?? [];

        const idempotencyKey = `event.updated:${eventId}:${hashPayload({
          eventId,
          title: nextTitle,
          startsAt: nextStartsAt,
          endsAt: nextEndsAt,
          status: nextStatus,
          organizationId: event.organizationId,
          interestTags: nextInterestTags,
        })}`;

        await appendEventLog(
          {
            eventId: eventLogId,
            organizationId: event.organizationId,
            eventType: "event.updated",
            idempotencyKey,
            actorUserId: user.id,
            sourceType: SourceType.EVENT,
            sourceId: String(eventId),
            correlationId: String(eventId),
            payload: {
              eventId,
              title: nextTitle,
              startsAt: nextStartsAt,
              endsAt: nextEndsAt,
              status: nextStatus,
              organizationId: event.organizationId,
            },
          },
          tx,
        );
        await recordOutboxEvent(
          {
            eventId: eventLogId,
            eventType: "event.updated",
            dedupeKey: idempotencyKey,
            payload: {
              eventId,
              title: nextTitle,
              startsAt: nextStartsAt,
              endsAt: nextEndsAt,
              status: nextStatus,
              organizationId: event.organizationId,
            },
            correlationId: String(eventId),
          },
          tx,
        );
        await recordSearchIndexOutbox(
          {
            eventLogId,
            organizationId: event.organizationId,
            sourceType: SourceType.EVENT,
            sourceId: String(eventId),
            correlationId: String(eventId),
          },
          tx,
        );
      }
    });

    if (shouldCancelEvent) {
      const summaries = await prisma.saleSummary.findMany({
        where: { eventId, status: "PAID" },
        select: { purchaseId: true, paymentIntentId: true },
      });
      await Promise.all(
        summaries.map((summary) =>
          enqueueOperation({
            operationType: "PROCESS_REFUND_UNIFIED",
            dedupeKey: refundKey(summary.purchaseId ?? summary.paymentIntentId ?? "unknown"),
            correlations: {
              eventId,
              purchaseId: summary.purchaseId ?? summary.paymentIntentId ?? null,
              paymentIntentId: summary.paymentIntentId ?? null,
            },
            payload: {
              eventId,
              purchaseId: summary.purchaseId ?? summary.paymentIntentId ?? null,
              paymentIntentId: summary.paymentIntentId ?? null,
              reason: "CANCELLED",
              policyCause: "EVENT_CANCELLED",
              sourceType: "TICKET_ORDER",
              refundedBy: user.id,
            },
          }),
        ),
      );
    }

    return respondOk(ctx, {}, { status: 200 });
  } catch (err) {
    console.error("POST /api/org/[orgId]/events/update error:", err);
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHENTICATED") {
      return fail(401, "Não autenticado.");
    }
    if (message === "INVITE_TOKEN_REQUIRES_EMAIL") {
      return fail(400, "INVITE_TOKEN_REQUIRES_EMAIL");
    }
    if (message === "INVALID_PADEL_CATEGORY_LINK") {
      return fail(400, "Categoria Padel inválida para este evento.");
    }
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const code = err.code;
      const column =
        typeof err.meta?.column === "string" ? err.meta.column : null;
      const error =
        code === "P2022" && column
          ? `Erro de base de dados ao atualizar evento (coluna em falta: ${column}).`
          : "Erro de base de dados ao atualizar evento.";
      return respondError(
        ctx,
        {
          errorCode: code ?? "DB_ERROR",
          message: error,
          retryable: false,
          details: column ? { column } : undefined,
        },
        { status: 400 },
      );
    }
    return fail(500, "Erro interno ao atualizar evento.");
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
