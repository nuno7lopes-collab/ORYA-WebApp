import crypto from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { FIXED_SPLIT_DEADLINE_HOURS } from "@/domain/padelDeadlines";
import { DEFAULT_PADEL_SCORE_RULES } from "@/domain/padel/score";
import { ensurePadelRuleSetVersion } from "@/domain/padel/ruleSetSnapshot";
import { parsePadelFormat } from "@/domain/padel/formatCatalog";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { appendEventLog } from "@/domain/eventLog/append";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { recordSearchIndexOutbox } from "@/domain/searchIndex/outbox";
import { validateZeroPriceGuard } from "@/domain/events/pricingGuard";
import { createTournamentForEventInTx } from "@/domain/tournaments/commands";
import { createEventAccessPolicyVersion } from "@/lib/checkin/accessPolicy";
import { resolveEventAccessPolicyInput } from "@/lib/events/accessPolicy";
import { isEndsAtAfterStart } from "@/lib/events/schedule";
import {
  resolveAllowedPayoutModeForOrganization,
  requiresOrganizationStripe,
} from "@/domain/finance/payoutModePolicy";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { syncTournamentOperationalRolesFromClubStaff } from "@/lib/padel/tournamentStaffRoleSync";
import { deriveEnvelopeFromDailyWindows, normalizePadelDailyWindows } from "@/lib/padel/scheduleWindows";
import { isPartnershipTournamentRequestsTableMissingError } from "@/app/api/padel/partnerships/_shared";
import {
  AddressSourceProvider,
  EventPricingMode,
  EventStatus,
  EventTemplateType,
  OrganizationModule,
  PadelEligibilityType,
  PadelTournamentRole,
  Prisma,
  SourceType,
  TournamentFormat,
  padel_format,
} from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

type CreateTournamentCategoryConfigInput = {
  padelCategoryId?: number | null;
  capacityTeams?: number | string | null;
  format?: string | null;
  pricePerPlayer?: number | string | null;
  currency?: string | null;
};

type CreateTournamentPadelInput = {
  clubId?: number | null;
  padelClubId?: number | null;
  partnershipTournamentRequestId?: number | string | null;
  courtIds?: number[];
  staffIds?: number[];
  format?: string;
  eligibilityType?: string | null;
  ruleSetId?: number | null;
  isInterclub?: boolean | null;
  teamSize?: number | string | null;
  categoryIds?: number[];
  defaultCategoryId?: number | null;
  categoryConfigs?: CreateTournamentCategoryConfigInput[];
  advancedSettings?: unknown;
  partnerClubIds?: number[];
};

type CreateTournamentBody = {
  title?: string;
  description?: string;
  coverImageUrl?: string | null;
  startsAt?: string;
  endsAt?: string;
  timezone?: string;
  addressId?: string | null;
  accessPolicy?: Record<string, unknown> | null;
  padel?: CreateTournamentPadelInput | null;
};

type CategoryConfigResolved = {
  capacityTeams: number | null;
  format: padel_format | null;
  pricePerPlayerCents: number;
  currency: string;
};

class ApiError extends Error {
  status: number;
  code: string;
  retryable: boolean;
  details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    options?: { message?: string; retryable?: boolean; details?: Record<string, unknown> },
  ) {
    super(options?.message ?? code);
    this.status = status;
    this.code = code;
    this.retryable = options?.retryable ?? status >= 500;
    this.details = options?.details;
  }
}

type PartnershipTournamentRequestDelegate = {
  findFirst: (args: Record<string, unknown>) => Promise<{ id: number } | null>;
  updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
};

const partnershipTournamentRequestDelegate =
  (prisma as unknown as { padelPartnershipTournamentRequest?: PartnershipTournamentRequestDelegate })
    .padelPartnershipTournamentRequest ?? null;

const ADDRESS_SELECT = {
  id: true,
  sourceProvider: true,
} satisfies Prisma.AddressSelect;

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

function parseDateTime(raw?: string | null) {
  if (!raw) return null;
  const normalized = raw.replace(" ", "T");
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) return date;
  const alt = new Date(`${normalized}:00`);
  if (!Number.isNaN(alt.getTime())) return alt;
  return null;
}

function parsePositiveInt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.floor(parsed);
  }
  return null;
}

function parseMoneyToCents(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value * 100));
  }
  if (typeof value === "string" && value.trim()) {
    const normalized = value.replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed * 100));
    }
  }
  return 0;
}

function normalizeCurrency(value: unknown) {
  if (typeof value !== "string") return "EUR";
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) return "EUR";
  return normalized;
}

function normalizeListOfIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => parsePositiveInt(item))
        .filter((id): id is number => typeof id === "number" && Number.isFinite(id) && id > 0),
    ),
  );
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
    let body: CreateTournamentBody;
    try {
      body = (await req.json()) as CreateTournamentBody;
    } catch {
      return fail(400, "Body inválido.");
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!profile) {
      return fail(
        400,
        "Perfil não encontrado. Completa o onboarding de utilizador antes de criares torneios.",
      );
    }
    const hasUserOnboarding =
      profile.onboardingDone ||
      (Boolean(profile.fullName?.trim()) && Boolean(profile.username?.trim()));
    if (!hasUserOnboarding) {
      return fail(
        400,
        "Completa o onboarding de utilizador (nome e username) antes de criares torneios.",
      );
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
    });
    if (!organization || !membership) {
      return fail(403, "FORBIDDEN");
    }

    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.TORNEIOS,
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
    const coverImageUrl = typeof body.coverImageUrl === "string" ? body.coverImageUrl.trim() || null : null;
    const startsAtRaw = body.startsAt;
    const endsAtRaw = body.endsAt;
    const addressIdInput = typeof body.addressId === "string" ? body.addressId.trim() || null : null;
    const timezone = typeof body.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : null;

    const templateTypeRaw =
      typeof (body as { templateType?: string | null }).templateType === "string"
        ? (body as { templateType?: string | null }).templateType?.trim().toUpperCase()
        : null;
    if (templateTypeRaw && templateTypeRaw !== "PADEL") {
      return fail(400, "BAD_REQUEST", "BAD_REQUEST", false, {
        reason: "ONLY_PADEL_SUPPORTED",
      });
    }

    if (!title) {
      return fail(400, "Título é obrigatório.");
    }

    if (!addressIdInput) {
      return fail(400, "Seleciona uma morada normalizada.");
    }
    const addressRecord = await prisma.address.findUnique({ where: { id: addressIdInput }, select: ADDRESS_SELECT });
    if (!addressRecord || addressRecord.sourceProvider !== AddressSourceProvider.APPLE_MAPS) {
      return fail(400, "CLUB_INVALID", "CLUB_INVALID", false);
    }

    const startsAt = parseDateTime(startsAtRaw);
    if (!startsAt) {
      return fail(400, "Data/hora de início inválida.");
    }

    const endsAt = parseDateTime(endsAtRaw);
    if (!endsAt) {
      return fail(400, "Data/hora de fim é obrigatória.");
    }
    if (!isEndsAtAfterStart(startsAt, endsAt)) {
      return fail(400, "A data/hora de fim tem de ser depois do início.");
    }

    const padelInput = body.padel ?? null;
    const requestedPadelFormat = parsePadelFormat(padelInput?.format);
    if (!requestedPadelFormat) {
      return fail(400, "INVALID_FORMAT", "INVALID_FORMAT", false);
    }

    const padelClubId = parsePositiveInt(padelInput?.clubId ?? padelInput?.padelClubId);
    if (!padelClubId) {
      return fail(400, "CLUB_INVALID", "CLUB_INVALID", false);
    }

    const requestedCourtIds = normalizeListOfIds(padelInput?.courtIds);
    const requestedStaffIds = normalizeListOfIds(padelInput?.staffIds);
    const partnerClubIds = normalizeListOfIds(padelInput?.partnerClubIds);
    const partnershipTournamentRequestId = parsePositiveInt(padelInput?.partnershipTournamentRequestId);

    const categoryConfigMap = new Map<number, CategoryConfigResolved>();
    const categoryConfigsRaw = Array.isArray(padelInput?.categoryConfigs) ? padelInput?.categoryConfigs : [];
    for (const cfg of categoryConfigsRaw) {
      const categoryId = parsePositiveInt(cfg?.padelCategoryId);
      if (!categoryId) continue;
      const capacityTeamsRaw = parsePositiveInt(cfg?.capacityTeams);
      const capacityTeams = typeof capacityTeamsRaw === "number" && capacityTeamsRaw > 0 ? capacityTeamsRaw : null;
      const format = parsePadelFormat(cfg?.format);
      const pricePerPlayerCents = parseMoneyToCents(cfg?.pricePerPlayer);
      const currency = normalizeCurrency(cfg?.currency);
      categoryConfigMap.set(categoryId, {
        capacityTeams,
        format,
        pricePerPlayerCents,
        currency,
      });
    }

    const requestedCategoryIds = normalizeListOfIds(padelInput?.categoryIds);
    const requestedDefaultCategoryId = parsePositiveInt(padelInput?.defaultCategoryId);
    const requestedCategoryIdsAll = Array.from(
      new Set([
        ...requestedCategoryIds,
        ...Array.from(categoryConfigMap.keys()),
        ...(requestedDefaultCategoryId ? [requestedDefaultCategoryId] : []),
      ]),
    );

    const eligibilityRaw = typeof padelInput?.eligibilityType === "string" ? padelInput.eligibilityType : null;
    const padelEligibilityType =
      eligibilityRaw && Object.values(PadelEligibilityType).includes(eligibilityRaw as PadelEligibilityType)
        ? (eligibilityRaw as PadelEligibilityType)
        : PadelEligibilityType.OPEN;

    const isInterclub = padelInput?.isInterclub === true;
    const teamSizeRaw = parsePositiveInt(padelInput?.teamSize);
    const teamSize = isInterclub && teamSizeRaw && teamSizeRaw >= 2 ? teamSizeRaw : null;
    if (isInterclub && !teamSize) {
      return fail(400, "TEAM_SIZE_REQUIRED", "TEAM_SIZE_REQUIRED", false);
    }

    const advancedSettings =
      padelInput?.advancedSettings && typeof padelInput.advancedSettings === "object" && !Array.isArray(padelInput.advancedSettings)
        ? (padelInput.advancedSettings as Record<string, unknown>)
        : null;

    const hasPaidRegistrations = Array.from(categoryConfigMap.values()).some((cfg) => cfg.pricePerPlayerCents > 0);
    const pricingMode = hasPaidRegistrations ? EventPricingMode.STANDARD : EventPricingMode.FREE_ONLY;
    const priceList = Array.from(categoryConfigMap.values()).map((cfg) => cfg.pricePerPlayerCents / 100);
    const pricingGuard = validateZeroPriceGuard({ pricingMode, ticketPrices: priceList });
    if (!pricingGuard.ok) {
      return fail(400, pricingGuard.error);
    }

    const isAdmin = Array.isArray(profile.roles) ? profile.roles.includes("admin") : false;
    if (hasPaidRegistrations && !isAdmin) {
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
            message: formatPaidSalesGateMessage(gate, "Para vender inscrições pagas,"),
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

    const club = await prisma.padelClub.findFirst({
      where: {
        id: padelClubId,
        organizationId: organization.id,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, kind: true, sourceClubId: true },
    });
    if (!club) {
      return fail(400, "CLUB_INVALID", "CLUB_INVALID", false);
    }

    if (club.kind === "PARTNER") {
      if (!club.sourceClubId) {
        return fail(400, "CLUB_INVALID", "CLUB_INVALID", false);
      }

      const agreementDateClauses: Prisma.PadelPartnershipAgreementWhereInput[] = [
        { OR: [{ startsAt: null }, { startsAt: { lte: endsAt } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: startsAt } }] },
      ];

      const agreement = await prisma.padelPartnershipAgreement.findFirst({
        where: {
          ownerClubId: club.sourceClubId,
          partnerOrganizationId: organization.id,
          status: "APPROVED",
          revokedAt: null,
          AND: [{ OR: [{ partnerClubId: club.id }, { partnerClubId: null }] }, ...agreementDateClauses],
        },
        select: { id: true },
      });

      if (!agreement) {
        return fail(400, "CLUB_INVALID", "CLUB_INVALID", false);
      }

      const windowsCount = await prisma.padelPartnershipWindow.count({
        where: {
          agreementId: agreement.id,
          isActive: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: endsAt } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: startsAt } }] },
          ],
        },
      });

      if (windowsCount === 0) {
        return fail(400, "CLUB_INVALID", "CLUB_INVALID", false);
      }

      if (!partnershipTournamentRequestId) {
        return fail(
          409,
          "PARTNERSHIP_TOURNAMENT_REQUEST_REQUIRED",
          "PARTNERSHIP_TOURNAMENT_REQUEST_REQUIRED",
          false,
        );
      }

      if (!partnershipTournamentRequestDelegate) {
        return fail(503, "PARTNERSHIP_REQUESTS_UNAVAILABLE", "PARTNERSHIP_REQUESTS_UNAVAILABLE", false);
      }

      const approvedRequest = await partnershipTournamentRequestDelegate.findFirst({
        where: {
          id: partnershipTournamentRequestId,
          status: "APPROVED",
          eventId: null,
          ownerClubId: club.sourceClubId,
          partnerOrganizationId: organization.id,
          partnerClubId: club.id,
          startsAt: { lte: endsAt },
          endsAt: { gte: startsAt },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { id: true },
      });
      if (!approvedRequest) {
        return fail(
          409,
          "PARTNERSHIP_TOURNAMENT_REQUEST_REQUIRED",
          "PARTNERSHIP_TOURNAMENT_REQUEST_REQUIRED",
          false,
        );
      }
    }

    let consumedPartnershipRequestId: number | null = null;
    if (club.kind === "PARTNER" && partnershipTournamentRequestId) {
      consumedPartnershipRequestId = partnershipTournamentRequestId;
    }

    const activeCourts = await prisma.padelClubCourt.findMany({
      where: { padelClubId, isActive: true },
      select: { id: true },
    });
    if (activeCourts.length === 0) {
      return fail(400, "COURTS_INVALID", "COURTS_INVALID", false);
    }

    const activeCourtIds = new Set(activeCourts.map((court) => court.id));
    const resolvedCourtIds =
      requestedCourtIds.length > 0 ? requestedCourtIds.filter((id) => activeCourtIds.has(id)) : activeCourts.map((court) => court.id);
    if (resolvedCourtIds.length === 0 || (requestedCourtIds.length > 0 && resolvedCourtIds.length !== requestedCourtIds.length)) {
      return fail(400, "COURTS_INVALID", "COURTS_INVALID", false);
    }

    let resolvedStaffIds: number[] = [];
    if (requestedStaffIds.length > 0) {
      const activeStaff = await prisma.padelClubStaff.findMany({
        where: { id: { in: requestedStaffIds }, padelClubId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      const activeStaffIds = new Set(activeStaff.map((staff) => staff.id));
      resolvedStaffIds = requestedStaffIds.filter((id) => activeStaffIds.has(id));
      if (resolvedStaffIds.length !== requestedStaffIds.length) {
        return fail(400, "CLUB_INVALID", "CLUB_INVALID", false, { reason: "STAFF_INVALID" });
      }
    }

    let allowedCategoryIds = new Set<number>();
    if (requestedCategoryIdsAll.length > 0) {
      const allowedCategories = await prisma.padelCategory.findMany({
        where: {
          organizationId: organization.id,
          isActive: true,
          id: { in: requestedCategoryIdsAll },
        },
        select: { id: true },
      });
      allowedCategoryIds = new Set(allowedCategories.map((c) => c.id));
      if (allowedCategoryIds.size !== requestedCategoryIdsAll.length) {
        return fail(400, "CATEGORIES_INVALID", "CATEGORIES_INVALID", false);
      }
    }

    const orderedRequestedCategoryIds = [
      ...requestedCategoryIds,
      ...Array.from(categoryConfigMap.keys()).filter((id) => !requestedCategoryIds.includes(id)),
    ];
    const resolvedCategoryIds =
      requestedCategoryIdsAll.length === 0
        ? []
        : orderedRequestedCategoryIds.filter((id) => allowedCategoryIds.has(id));
    if (requestedCategoryIdsAll.length > 0 && resolvedCategoryIds.length === 0) {
      return fail(400, "CATEGORIES_INVALID", "CATEGORIES_INVALID", false);
    }

    const defaultCategoryId =
      requestedDefaultCategoryId && allowedCategoryIds.has(requestedDefaultCategoryId)
        ? requestedDefaultCategoryId
        : resolvedCategoryIds[0] ?? null;

    if (requestedDefaultCategoryId && !defaultCategoryId) {
      return fail(400, "CATEGORIES_INVALID", "CATEGORIES_INVALID", false);
    }

    if (partnerClubIds.length > 0) {
      const activePartners = await prisma.padelClub.findMany({
        where: {
          id: { in: partnerClubIds },
          organizationId: organization.id,
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      const activePartnerIds = new Set(activePartners.map((clubItem) => clubItem.id));
      if (activePartnerIds.size !== partnerClubIds.length) {
        return fail(400, "CLUB_INVALID", "CLUB_INVALID", false, { reason: "PARTNER_CLUBS_INVALID" });
      }
    }

    if (partnerClubIds.length > 0 && resolvedStaffIds.length === 0) {
      return fail(
        400,
        "Seleciona pelo menos 1 elemento de staff para clubes parceiros.",
        "STAFF_REQUIRED_FOR_PARTNER_CLUBS",
        false,
      );
    }

    const accessPolicyResolution = resolveEventAccessPolicyInput({
      accessPolicy: body.accessPolicy ?? null,
      templateType: EventTemplateType.PADEL,
    });

    const payoutMode = resolveAllowedPayoutModeForOrganization(organizationInfo.orgType, null);
    const baseSlug = slugify(title) || "torneio";
    const slug = await generateUniqueSlug(baseSlug);

    const advancedSettingsResolved = { ...(advancedSettings ?? {}) };
    const scheduleDefaultsRaw =
      advancedSettingsResolved.scheduleDefaults &&
      typeof advancedSettingsResolved.scheduleDefaults === "object" &&
      !Array.isArray(advancedSettingsResolved.scheduleDefaults)
        ? (advancedSettingsResolved.scheduleDefaults as Record<string, unknown>)
        : null;
    const normalizedDailyWindows = normalizePadelDailyWindows(scheduleDefaultsRaw?.dailyWindows);
    if (scheduleDefaultsRaw && normalizedDailyWindows.length > 0) {
      const envelope = deriveEnvelopeFromDailyWindows(normalizedDailyWindows);
      advancedSettingsResolved.scheduleDefaults = {
        ...scheduleDefaultsRaw,
        dailyWindows: normalizedDailyWindows,
        windowStart: envelope.windowStart,
        windowEnd: envelope.windowEnd,
      };
    }

    const registrationEndsAtRaw =
      typeof advancedSettingsResolved.registrationEndsAt === "string"
        ? advancedSettingsResolved.registrationEndsAt
        : null;
    const inscriptionDeadlineAt =
      registrationEndsAtRaw && !Number.isNaN(new Date(registrationEndsAtRaw).getTime())
        ? new Date(registrationEndsAtRaw)
        : new Date(startsAt.getTime() - 24 * 60 * 60 * 1000);

    const created = await prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          slug,
          title,
          description,
          coverImageUrl,
          type: "ORGANIZATION_EVENT",
          templateType: EventTemplateType.PADEL,
          ownerUserId: profile.id,
          organizationId: organization.id,
          startsAt,
          endsAt,
          addressId: addressRecord.id,
          pricingMode,
          status: EventStatus.DRAFT,
          payoutMode,
          ...(timezone ? { timezone } : {}),
        },
      });

      await createEventAccessPolicyVersion(event.id, accessPolicyResolution.policyInput, tx);

      const lifecycleNow = new Date();
      const computedCourts = Math.max(1, resolvedCourtIds.length);
      const advancedSettingsBase = { ...advancedSettingsResolved };
      if (!Object.prototype.hasOwnProperty.call(advancedSettingsBase, "competitionState")) {
        advancedSettingsBase.competitionState = "DEVELOPMENT";
      }
      if (!Object.prototype.hasOwnProperty.call(advancedSettingsBase, "scoreRules")) {
        advancedSettingsBase.scoreRules = DEFAULT_PADEL_SCORE_RULES;
      }

      const config = await tx.padelTournamentConfig.upsert({
        where: { eventId: event.id },
        create: {
          eventId: event.id,
          organizationId: organization.id,
          padelClubId,
          partnerClubIds,
          numberOfCourts: computedCourts,
          format: requestedPadelFormat,
          ruleSetId: parsePositiveInt(padelInput?.ruleSetId) ?? undefined,
          defaultCategoryId: defaultCategoryId ?? undefined,
          eligibilityType: padelEligibilityType,
          splitDeadlineHours: FIXED_SPLIT_DEADLINE_HOURS,
          isInterclub,
          teamSize: isInterclub ? teamSize ?? undefined : null,
          padelV2Enabled: true,
          advancedSettings: {
            ...advancedSettingsBase,
            courtIds: resolvedCourtIds,
            staffIds: resolvedStaffIds,
          },
          lifecycleStatus: "DRAFT",
          lifecycleUpdatedAt: lifecycleNow,
        },
        update: {
          padelClubId,
          partnerClubIds,
          numberOfCourts: computedCourts,
          format: requestedPadelFormat,
          ruleSetId: parsePositiveInt(padelInput?.ruleSetId) ?? undefined,
          defaultCategoryId: defaultCategoryId ?? undefined,
          eligibilityType: padelEligibilityType,
          splitDeadlineHours: FIXED_SPLIT_DEADLINE_HOURS,
          isInterclub,
          teamSize: isInterclub ? teamSize ?? undefined : null,
          padelV2Enabled: true,
          advancedSettings: {
            ...advancedSettingsBase,
            courtIds: resolvedCourtIds,
            staffIds: resolvedStaffIds,
          },
          lifecycleStatus: "DRAFT",
          lifecycleUpdatedAt: lifecycleNow,
        },
      });

      if (config.ruleSetId) {
        const freshConfig = await tx.padelTournamentConfig.findUnique({
          where: { id: config.id },
          select: { id: true, ruleSetId: true, ruleSetVersionId: true },
        });
        if (freshConfig?.ruleSetId && !freshConfig.ruleSetVersionId) {
          const version = await ensurePadelRuleSetVersion({
            tx,
            tournamentConfigId: freshConfig.id,
            ruleSetId: freshConfig.ruleSetId,
            actorUserId: user.id,
          });
          await tx.padelTournamentConfig.update({
            where: { id: freshConfig.id },
            data: { ruleSetVersionId: version.id },
          });
        }
      }

      if (resolvedCategoryIds.length > 0) {
        await tx.padelEventCategoryLink.createMany({
          data: resolvedCategoryIds.map((categoryId) => {
            const categoryConfig = categoryConfigMap.get(categoryId);
            return {
              eventId: event.id,
              padelCategoryId: categoryId,
              format: categoryConfig?.format ?? requestedPadelFormat,
              capacityTeams: categoryConfig?.capacityTeams ?? null,
              pricePerPlayerCents: categoryConfig?.pricePerPlayerCents ?? 0,
              currency: categoryConfig?.currency ?? "EUR",
              isEnabled: true,
            };
          }),
          skipDuplicates: true,
        });
      }

      await tx.padelTournamentRoleAssignment.upsert({
        where: {
          eventId_role_userId: {
            eventId: event.id,
            role: PadelTournamentRole.DIRETOR_PROVA,
            userId: profile.id,
          },
        },
        create: {
          eventId: event.id,
          organizationId: organization.id,
          userId: profile.id,
          role: PadelTournamentRole.DIRETOR_PROVA,
        },
        update: {},
      });
      await syncTournamentOperationalRolesFromClubStaff({
        tx,
        organizationId: organization.id,
        eventId: event.id,
        staffIds: resolvedStaffIds,
        padelClubId,
      });

      const tournament = await createTournamentForEventInTx(tx, {
        eventId: event.id,
        format: TournamentFormat.MANUAL,
        config: { padelFormat: requestedPadelFormat },
        actorUserId: profile.id,
        inscriptionDeadlineAt,
      });
      if (!tournament.ok) {
        throw new ApiError(500, "TOURNAMENT_CREATE_FAILED", {
          details: { reason: tournament.error },
        });
      }

      const eventLogId = crypto.randomUUID();
      await appendEventLog(
        {
          eventId: eventLogId,
          organizationId: organization.id,
          eventType: "event.created",
          idempotencyKey: `event.created:${event.id}`,
          actorUserId: profile.id,
          sourceType: SourceType.EVENT,
          sourceId: String(event.id),
          correlationId: String(event.id),
          payload: {
            eventId: event.id,
            title: event.title,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            status: event.status,
            organizationId: organization.id,
          },
        },
        tx,
      );
      await recordOutboxEvent(
        {
          eventId: eventLogId,
          eventType: "event.created",
          dedupeKey: `event.created:${event.id}`,
          payload: {
            eventId: event.id,
            title: event.title,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            status: event.status,
            organizationId: organization.id,
          },
          correlationId: String(event.id),
        },
        tx,
      );
      await recordSearchIndexOutbox(
        {
          eventLogId,
          organizationId: organization.id,
          sourceType: SourceType.EVENT,
          sourceId: String(event.id),
          correlationId: String(event.id),
        },
        tx,
      );

      return event;
    });

    if (consumedPartnershipRequestId && partnershipTournamentRequestDelegate) {
      try {
        await partnershipTournamentRequestDelegate.updateMany({
          where: {
            id: consumedPartnershipRequestId,
            status: "APPROVED",
            eventId: null,
          },
          data: {
            eventId: created.id,
          },
        });
      } catch (err) {
        if (!isPartnershipTournamentRequestsTableMissingError(err)) {
          throw err;
        }
      }
    }

    return respondOk(
      ctx,
      {
        event: {
          id: created.id,
          slug: created.slug,
          title: created.title,
        },
        lifecycle: { status: "DRAFT" },
      },
      { status: 201 },
    );
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    if (isPartnershipTournamentRequestsTableMissingError(err)) {
      return fail(503, "PARTNERSHIP_REQUESTS_UNAVAILABLE", "PARTNERSHIP_REQUESTS_UNAVAILABLE", false);
    }
    if (err instanceof ApiError) {
      return fail(err.status, err.code, err.code, err.retryable, err.details);
    }
    const message = err instanceof Error ? err.message : "";
    if (message === "INVITE_TOKEN_REQUIRES_EMAIL") {
      return fail(400, "INVITE_TOKEN_REQUIRES_EMAIL");
    }
    if (message === "PADEL_RULESET_NOT_FOUND") {
      return fail(400, "INVALID_FORMAT", "INVALID_FORMAT", false);
    }
    console.error("POST /api/org/[orgId]/tournaments/create error:", err);
    return fail(500, "Erro interno ao criar torneio.");
  }
}

export const POST = withApiEnvelope(_POST);
