

// app/api/organizacao/events/create/route.ts
import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { clampDeadlineHours } from "@/domain/padelDeadlines";
import { DEFAULT_PADEL_SCORE_RULES } from "@/domain/padel/score";
import { ensurePadelRuleSetVersion } from "@/domain/padel/ruleSetSnapshot";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { appendEventLog } from "@/domain/eventLog/append";
import { SourceType, EventPricingMode } from "@prisma/client";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { recordSearchIndexOutbox } from "@/domain/searchIndex/outbox";
import { validateZeroPriceGuard } from "@/domain/events/pricingGuard";
import { createTournamentForEvent } from "@/domain/tournaments/commands";
import { createEventAccessPolicyVersion } from "@/lib/checkin/accessPolicy";
import { resolveEventAccessPolicyInput } from "@/lib/events/accessPolicy";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import {
  EventTemplateType,
  EventStatus,
  LiveHubVisibility,
  LocationSource,
  PadelEligibilityType,
  PayoutMode,
  ResaleMode,
  Prisma,
  AddressSourceProvider,
  padel_format,
  OrganizationModule,
  TournamentFormat,
} from "@prisma/client";

const ALLOWED_PADEL_FORMATS = new Set<padel_format>([
  padel_format.TODOS_CONTRA_TODOS,
  padel_format.QUADRO_ELIMINATORIO,
  padel_format.GRUPOS_ELIMINATORIAS,
  padel_format.QUADRO_AB,
  padel_format.DUPLA_ELIMINACAO,
  padel_format.NON_STOP,
  padel_format.CAMPEONATO_LIGA,
]);

// Tipos esperados no body do pedido
type TicketTypeInput = {
  name?: string;
  price?: number;
  totalQuantity?: number | null;
  publicAccess?: boolean;
  participantAccess?: boolean;
  padelCategoryId?: number | null;
};

type CreateOrganizationEventBody = {
  title?: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  status?: string;
  timezone?: string;
  locationName?: string;
  locationCity?: string;
  templateType?: string; // PADEL | OTHER
  ticketTypes?: TicketTypeInput[];
  locationSource?: string | null;
  locationProviderId?: string | null;
  locationFormattedAddress?: string | null;
  locationComponents?: Record<string, unknown> | null;
  locationOverrides?: Record<string, unknown> | null;
  addressId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  resaleMode?: string; // ALWAYS | AFTER_SOLD_OUT | DISABLED
  pricingMode?: string | null;
  coverImageUrl?: string | null;
  liveHubVisibility?: string;
  payoutMode?: string; // ORGANIZATION | PLATFORM
  feeMode?: string;
  platformFeeBps?: number;
  platformFeeFixedCents?: number;
  accessPolicy?: Record<string, unknown> | null;
  padel?: {
    format?: string;
    numberOfCourts?: number;
    ruleSetId?: number | null;
    defaultCategoryId?: number | null;
    eligibilityType?: string | null;
    categoryIds?: number[];
    categoryConfigs?: Array<{
      padelCategoryId?: number | null;
      capacityTeams?: number | null;
      format?: string | null;
      pricePerPlayer?: number | null;
      currency?: string | null;
    }>;
    splitDeadlineHours?: number | null;
    padelV2Enabled?: boolean;
    isInterclub?: boolean | null;
    teamSize?: number | null;
    padelClubId?: number | null;
    courtIds?: number[];
    staffIds?: number[];
  } | null;
};

type PadelConfigInput = {
  padelClubId?: number | null;
  partnerClubIds?: number[];
  format?: string;
  numberOfCourts?: number;
  ruleSetId?: number | null;
  defaultCategoryId?: number | null;
  eligibilityType?: string | null;
  categoryIds?: number[];
  categoryConfigs?: Array<{
    padelCategoryId?: number | null;
    capacityTeams?: number | null;
    format?: string | null;
    pricePerPlayer?: number | null;
    currency?: string | null;
  }>;
  splitDeadlineHours?: number | null;
  advancedSettings?: unknown;
  padelV2Enabled?: boolean;
  isInterclub?: boolean | null;
  teamSize?: number | null;
  courtIds?: number[];
  staffIds?: number[];
} | null;

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

const pickCanonicalField = (canonical: Prisma.JsonValue | null, ...keys: string[]) => {
  if (!canonical || typeof canonical !== "object") return null;
  const record = canonical as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

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

const mapAddressProviderToLocationSource = (provider?: AddressSourceProvider | null) => {
  if (!provider || provider === AddressSourceProvider.MANUAL) return LocationSource.MANUAL;
  if (provider === AddressSourceProvider.APPLE_MAPS) return LocationSource.APPLE_MAPS;
  return LocationSource.OSM;
};

async function generateUniqueSlug(baseSlug: string) {
  const existing = await prisma.event.findMany({
    where: { slug: { startsWith: baseSlug } },
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

export async function POST(req: NextRequest) {
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
          errorCode: emailGate.error ?? "FORBIDDEN",
          message: emailGate.message ?? emailGate.error ?? "Sem permissões.",
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
    const isPlatformAccount = organizationInfo.orgType === "PLATFORM";

    const title = body.title?.trim();
    const description = body.description?.trim() ?? "";
    const startsAtRaw = body.startsAt;
    const endsAtRaw = body.endsAt;
    const locationName = body.locationName?.trim() ?? "";
    const locationCity = body.locationCity?.trim() ?? "";
    const locationSourceRaw = typeof body.locationSource === "string" ? body.locationSource.toUpperCase() : null;
    const locationSource =
      locationSourceRaw === "APPLE_MAPS"
        ? LocationSource.APPLE_MAPS
        : locationSourceRaw === "OSM"
          ? LocationSource.OSM
          : LocationSource.MANUAL;
    const locationProviderId =
      typeof body.locationProviderId === "string" ? body.locationProviderId.trim() || null : null;
    const locationFormattedAddress =
      typeof body.locationFormattedAddress === "string" ? body.locationFormattedAddress.trim() || null : null;
    const locationComponents =
      body.locationComponents && typeof body.locationComponents === "object"
        ? (body.locationComponents as Prisma.InputJsonValue)
        : null;
    const addressIdInput = typeof body.addressId === "string" ? body.addressId.trim() || null : null;
    const rawOverrides =
      body.locationOverrides && typeof body.locationOverrides === "object"
        ? (body.locationOverrides as Record<string, unknown>)
        : null;
    const overridesHouse =
      typeof rawOverrides?.houseNumber === "string" ? rawOverrides.houseNumber.trim() || null : null;
    const overridesPostal =
      typeof rawOverrides?.postalCode === "string" ? rawOverrides.postalCode.trim() || null : null;
    const locationOverrides =
      overridesHouse || overridesPostal
        ? ({ houseNumber: overridesHouse, postalCode: overridesPostal } as Prisma.InputJsonValue)
        : null;
    const latitude =
      typeof body.latitude === "number" || typeof body.latitude === "string"
        ? Number(body.latitude)
        : null;
    const longitude =
      typeof body.longitude === "number" || typeof body.longitude === "string"
        ? Number(body.longitude)
        : null;
    const templateTypeRaw = body.templateType?.toUpperCase();
    const resaleModeRaw = body.resaleMode?.toUpperCase() as
      | "ALWAYS"
      | "AFTER_SOLD_OUT"
      | "DISABLED"
      | undefined;
    const payoutModeRequested =
      body.payoutMode?.toUpperCase() === "PLATFORM" ? PayoutMode.PLATFORM : PayoutMode.ORGANIZATION;
    const payoutMode: PayoutMode = isPlatformAccount ? PayoutMode.PLATFORM : payoutModeRequested;
    const statusRaw = typeof body.status === "string" ? body.status.trim().toUpperCase() : null;
    const eventStatus: EventStatus =
      statusRaw === "DRAFT" || statusRaw === "PUBLISHED" ? (statusRaw as EventStatus) : EventStatus.PUBLISHED;
    const timezone =
      typeof body.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : null;

    if (!title) {
      return fail(400, "Título é obrigatório.");
    }

    const addressRecord = addressIdInput
      ? await prisma.address.findUnique({ where: { id: addressIdInput }, select: ADDRESS_SELECT })
      : null;
    if (addressIdInput && !addressRecord) {
      return fail(400, "Morada inválida.");
    }

    if (!startsAtRaw) {
      return fail(400, "Data/hora de início é obrigatória.");
    }

    const canonical = addressRecord?.canonical ?? null;
    const resolvedLocationSource = addressRecord
      ? mapAddressProviderToLocationSource(addressRecord.sourceProvider)
      : locationSource;
    const resolvedLocationProviderId = addressRecord ? addressRecord.sourceProviderPlaceId || null : locationProviderId;
    const resolvedLocationFormattedAddress = addressRecord
      ? addressRecord.formattedAddress
      : locationFormattedAddress;
    const resolvedLocationComponents = addressRecord ? (canonical as Prisma.InputJsonValue) : locationComponents;
    const resolvedLatitude = addressRecord ? addressRecord.latitude : latitude;
    const resolvedLongitude = addressRecord ? addressRecord.longitude : longitude;
    const resolvedAddress =
      addressRecord?.formattedAddress ||
      locationFormattedAddress ||
      pickCanonicalField(canonical, "addressLine1", "street", "road") ||
      null;
    const resolvedCity =
      locationCity || pickCanonicalField(canonical, "city", "addressLine2", "locality") || "";

    const isLocationTbd =
      resolvedLocationSource === LocationSource.MANUAL && !locationName && !resolvedCity && !resolvedAddress;
    if (!resolvedCity && !isLocationTbd) {
      return fail(400, "Cidade é obrigatória.");
    }
    if (resolvedLocationSource !== LocationSource.MANUAL) {
      if (!addressRecord) {
        return fail(400, "Seleciona uma morada normalizada.");
      }
    }
    // Permitimos cidades fora da whitelist para não bloquear dados existentes

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

    // Para simplificar e evitar conflitos de tipos, endsAt será sempre enviado.
    // Se o utilizador não mandar, usamos a mesma data/hora de início.
    const endsAtParsed = parseDate(endsAtRaw);
    const endsAt = endsAtParsed && endsAtParsed >= startsAt ? endsAtParsed : startsAt;

    const padelRequested = Boolean(body.padel) || templateTypeRaw === "PADEL";
    const templateTypeFromBody =
      templateTypeRaw === "PADEL"
        ? EventTemplateType.PADEL
        : templateTypeRaw === "VOLUNTEERING"
          ? EventTemplateType.VOLUNTEERING
          : EventTemplateType.OTHER;

    let templateType: EventTemplateType = templateTypeFromBody;
    if (padelRequested) {
      templateType = EventTemplateType.PADEL;
    }

    const ticketTypesInput = body.ticketTypes ?? [];
    const coverImageUrl = body.coverImageUrl?.trim?.() || null;
    const liveHubVisibilityRaw = body.liveHubVisibility?.toUpperCase();
    const liveHubVisibility: LiveHubVisibility =
      liveHubVisibilityRaw === "PUBLIC" || liveHubVisibilityRaw === "PRIVATE" || liveHubVisibilityRaw === "DISABLED"
        ? (liveHubVisibilityRaw as LiveHubVisibility)
        : LiveHubVisibility.PUBLIC;
    // Validar tipos de bilhete
    let ticketPriceError: string | null = null;
    let ticketTypesData = ticketTypesInput
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
        const padelCategoryId =
          typeof t.padelCategoryId === "number" && Number.isFinite(t.padelCategoryId)
            ? Math.floor(t.padelCategoryId)
            : null;

        return {
          name,
          price: priceRaw,
          totalQuantity,
          publicAccess: t.publicAccess === true,
          participantAccess: t.participantAccess === true,
          padelCategoryId,
        };
      })
      .filter((t): t is { name: string; price: number; totalQuantity: number | null; publicAccess: boolean; participantAccess: boolean; padelCategoryId: number | null } =>
        Boolean(t)
      );

    if (ticketPriceError) {
      return fail(400, ticketPriceError);
    }

    const pricingModeRaw = typeof body.pricingMode === "string" ? body.pricingMode.trim().toUpperCase() : null;
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
        requireStripe: payoutMode === PayoutMode.ORGANIZATION && !isPlatformAccount,
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
    const resaleMode: ResaleMode =
      resaleModeRaw === "AFTER_SOLD_OUT" || resaleModeRaw === "DISABLED"
        ? (resaleModeRaw as ResaleMode)
        : ResaleMode.ALWAYS;

    // Validar configuração de padel antes de criar o evento
    let padelConfigInput: PadelConfigInput = null;
    let padelClubId: number | null = null;
    let partnerClubIds: number[] = [];
    let advancedSettings: unknown = null;
    let padelCategoryIds: number[] = [];
    let padelDefaultCategoryId: number | null = null;
    let padelEligibilityType: PadelEligibilityType = PadelEligibilityType.OPEN;
    let splitDeadlineHours: number | null = null;
    let isInterclub = false;
    let teamSize: number | null = null;
    let resolvedCourtIds: number[] = [];
    let resolvedStaffIds: number[] = [];
    const categoryConfigMap = new Map<
      number,
      { capacityTeams: number | null; format: padel_format | null; pricePerPlayerCents: number | null; currency: string | null }
    >();

    if (padelRequested && organization) {
      padelConfigInput = (body.padel ?? {}) as PadelConfigInput;
      padelClubId =
        typeof padelConfigInput?.padelClubId === "number" && Number.isFinite(padelConfigInput.padelClubId)
          ? padelConfigInput.padelClubId
          : null;
      partnerClubIds = Array.isArray(padelConfigInput?.partnerClubIds)
        ? padelConfigInput.partnerClubIds.filter((id) => typeof id === "number" && Number.isFinite(id))
        : [];
      advancedSettings = padelConfigInput?.advancedSettings ?? null;
      const requestedCourtIds = Array.isArray(padelConfigInput?.courtIds)
        ? Array.from(
            new Set(padelConfigInput.courtIds.filter((id) => typeof id === "number" && Number.isFinite(id))),
          )
        : [];
      const requestedStaffIds = Array.isArray(padelConfigInput?.staffIds)
        ? Array.from(
            new Set(padelConfigInput.staffIds.filter((id) => typeof id === "number" && Number.isFinite(id))),
          )
        : [];
      const eligibilityRaw = typeof padelConfigInput?.eligibilityType === "string" ? padelConfigInput.eligibilityType : null;
      if (eligibilityRaw && Object.values(PadelEligibilityType).includes(eligibilityRaw as PadelEligibilityType)) {
        padelEligibilityType = eligibilityRaw as PadelEligibilityType;
      }

      isInterclub = padelConfigInput?.isInterclub === true;
      const teamSizeRaw =
        typeof padelConfigInput?.teamSize === "number"
          ? padelConfigInput.teamSize
          : typeof padelConfigInput?.teamSize === "string"
            ? Number(padelConfigInput.teamSize)
            : null;
      teamSize =
        isInterclub && Number.isFinite(teamSizeRaw as number) && (teamSizeRaw as number) >= 2
          ? Math.floor(teamSizeRaw as number)
          : null;
      if (isInterclub && !teamSize) {
        return fail(400, "Tamanho de equipa inválido.");
      }
      if (typeof padelConfigInput?.splitDeadlineHours === "number" && Number.isFinite(padelConfigInput.splitDeadlineHours)) {
        splitDeadlineHours = clampDeadlineHours(padelConfigInput.splitDeadlineHours);
      }

      const categoryConfigsRaw = Array.isArray(padelConfigInput?.categoryConfigs)
        ? padelConfigInput.categoryConfigs
        : [];
      categoryConfigsRaw.forEach((cfg) => {
        const categoryId =
          typeof cfg?.padelCategoryId === "number" && Number.isFinite(cfg.padelCategoryId) ? cfg.padelCategoryId : null;
        if (!categoryId) return;
        const capacityTeams =
          typeof cfg?.capacityTeams === "number" && Number.isFinite(cfg.capacityTeams) && cfg.capacityTeams > 0
            ? Math.floor(cfg.capacityTeams)
            : null;
        const format =
          typeof cfg?.format === "string" && ALLOWED_PADEL_FORMATS.has(cfg.format as padel_format)
            ? (cfg.format as padel_format)
            : null;
        const priceRaw = typeof cfg?.pricePerPlayer === "number" && Number.isFinite(cfg.pricePerPlayer)
          ? cfg.pricePerPlayer
          : typeof cfg?.pricePerPlayer === "string"
            ? Number(cfg.pricePerPlayer)
            : null;
        const pricePerPlayerCents =
          typeof priceRaw === "number" && Number.isFinite(priceRaw) ? Math.max(0, Math.round(priceRaw * 100)) : null;
        const currencyRaw = typeof cfg?.currency === "string" ? cfg.currency.trim().toUpperCase() : null;
        const currency = currencyRaw && /^[A-Z]{3}$/.test(currencyRaw) ? currencyRaw : null;
        categoryConfigMap.set(categoryId, { capacityTeams, format, pricePerPlayerCents, currency });
      });

      const requestedCategoryIds = Array.isArray(padelConfigInput?.categoryIds)
        ? padelConfigInput.categoryIds.filter((id) => typeof id === "number" && Number.isFinite(id))
        : [];
      const requestedDefaultCategoryId =
        typeof padelConfigInput?.defaultCategoryId === "number" && Number.isFinite(padelConfigInput.defaultCategoryId)
          ? padelConfigInput.defaultCategoryId
          : null;
      let allowedCategoryIds: Set<number> | null = null;

      if (!padelClubId) {
        return fail(400, "Seleciona um clube de padel.");
      }

      const club = await prisma.padelClub.findFirst({
        where: { id: padelClubId, organizationId: organization.id, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!club) {
        return fail(400, "Clube de padel arquivado ou inexistente.");
      }

      const activeCourts = await prisma.padelClubCourt.findMany({
        where: { padelClubId, isActive: true },
        select: { id: true },
      });
      if (activeCourts.length === 0) {
        return fail(400, "O clube selecionado não tem courts ativos.");
      }
      const activeCourtIds = new Set(activeCourts.map((court) => court.id));
      if (requestedCourtIds.length > 0) {
        resolvedCourtIds = requestedCourtIds.filter((id) => activeCourtIds.has(id));
        if (resolvedCourtIds.length === 0) {
          return fail(400, "Seleciona courts válidos para o clube.");
        }
      } else {
        resolvedCourtIds = activeCourts.map((court) => court.id);
      }

      if (requestedStaffIds.length > 0) {
        const activeStaff = await prisma.padelClubStaff.findMany({
          where: { id: { in: requestedStaffIds }, padelClubId, isActive: true, deletedAt: null },
          select: { id: true },
        });
        const activeStaffIds = new Set(activeStaff.map((member) => member.id));
        resolvedStaffIds = requestedStaffIds.filter((id) => activeStaffIds.has(id));
        if (resolvedStaffIds.length === 0) {
          return fail(400, "Seleciona staff válido para o clube.");
        }
      } else {
        resolvedStaffIds = [];
      }

      if (partnerClubIds.length > 0) {
        const activePartners = await prisma.padelClub.findMany({
          where: { id: { in: partnerClubIds }, organizationId: organization.id, isActive: true, deletedAt: null },
          select: { id: true },
        });
        const permittedPartners = new Set(activePartners.map((c) => c.id));
        partnerClubIds = partnerClubIds.filter((id) => permittedPartners.has(id));
      }

      const requestedCategoryIdsAll = Array.from(
        new Set([
          ...requestedCategoryIds,
          ...Array.from(categoryConfigMap.keys()),
          ...(requestedDefaultCategoryId ? [requestedDefaultCategoryId] : []),
        ]),
      );
      if (requestedCategoryIdsAll.length > 0) {
        const allowedCategories = await prisma.padelCategory.findMany({
          where: { organizationId: organization.id, isActive: true },
          select: { id: true },
        });
        allowedCategoryIds = new Set(allowedCategories.map((c) => c.id));
      }

      if (requestedCategoryIdsAll.length > 0 && allowedCategoryIds) {
        const orderedRequested = [
          ...requestedCategoryIds,
          ...Array.from(categoryConfigMap.keys()).filter((id) => !requestedCategoryIds.includes(id)),
        ];
        padelCategoryIds = orderedRequested.filter((id) => allowedCategoryIds?.has(id));
        categoryConfigMap.forEach((value, key) => {
          if (!allowedCategoryIds?.has(key)) {
            categoryConfigMap.delete(key);
          }
        });
      }

      if (requestedDefaultCategoryId && (!allowedCategoryIds || allowedCategoryIds.has(requestedDefaultCategoryId))) {
        const isPermitted =
          padelCategoryIds.length === 0 || padelCategoryIds.includes(requestedDefaultCategoryId);
        padelDefaultCategoryId = isPermitted ? requestedDefaultCategoryId : null;
      } else if (padelCategoryIds.length > 0) {
        padelDefaultCategoryId = padelCategoryIds[0];
      }
    }

    if (padelRequested && categoryConfigMap.size > 0 && !isAdmin) {
      const hasPaidPadel = Array.from(categoryConfigMap.values()).some(
        (cfg) => (cfg.pricePerPlayerCents ?? 0) > 0,
      );
      if (hasPaidPadel) {
        const gate = getPaidSalesGate({
          officialEmail: organizationInfo.officialEmail ?? null,
          officialEmailVerifiedAt: organizationInfo.officialEmailVerifiedAt ?? null,
          stripeAccountId: organizationInfo.stripeAccountId ?? null,
          stripeChargesEnabled: organizationInfo.stripeChargesEnabled ?? false,
          stripePayoutsEnabled: organizationInfo.stripePayoutsEnabled ?? false,
          requireStripe: payoutMode === PayoutMode.ORGANIZATION && !isPlatformAccount,
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
    }

    if (templateType === "PADEL" && padelCategoryIds.length > 0) {
      ticketTypesData = ticketTypesData.map((ticket) => ({
        ...ticket,
        padelCategoryId:
          ticket.padelCategoryId && padelCategoryIds.includes(ticket.padelCategoryId)
            ? ticket.padelCategoryId
            : null,
      }));
    } else {
      ticketTypesData = ticketTypesData.map((ticket) => ({ ...ticket, padelCategoryId: null }));
    }

    // Criar o evento + EventLog/Outbox na mesma tx
    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          slug,
          title,
          description,
          type: "ORGANIZATION_EVENT",
          templateType,
          ownerUserId: profile.id,
          organizationId: organization?.id ?? null,
          startsAt,
          endsAt,
          locationName,
          locationCity: resolvedCity,
          locationSource: resolvedLocationSource,
          locationProviderId: resolvedLocationProviderId,
          locationFormattedAddress: resolvedLocationFormattedAddress,
          locationComponents: resolvedLocationComponents ?? undefined,
          locationOverrides: locationOverrides ?? undefined,
          latitude: Number.isFinite(resolvedLatitude ?? NaN) ? resolvedLatitude : null,
          longitude: Number.isFinite(resolvedLongitude ?? NaN) ? resolvedLongitude : null,
          addressId: addressRecord?.id ?? null,
          pricingMode,
          liveHubVisibility,
          status: eventStatus,
          ...(timezone ? { timezone } : {}),
          resaleMode,
          coverImageUrl,
          payoutMode,
        },
      });

      await createEventAccessPolicyVersion(created.id, accessPolicyInput, tx);

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

    if (templateType === "PADEL" && padelConfigInput && organization) {
      const padelV2Enabled = padelConfigInput?.padelV2Enabled ?? true;
      const courtIds = resolvedCourtIds;
      const staffIds = resolvedStaffIds;
      const lifecycleNow = new Date();
      const lifecycleStatus = eventStatus === EventStatus.PUBLISHED ? "PUBLISHED" : "DRAFT";
      const computedCourts = Math.max(1, courtIds.length || padelConfigInput.numberOfCourts || 1);
      const requestedFormat =
        typeof padelConfigInput.format === "string" ? padelConfigInput.format : null;
      const padelFormat =
        requestedFormat && ALLOWED_PADEL_FORMATS.has(requestedFormat as padel_format)
          ? (requestedFormat as padel_format)
          : padel_format.TODOS_CONTRA_TODOS;
      const baseAdvanced = { ...((advancedSettings as Record<string, unknown>) ?? {}) };
      if (!Object.prototype.hasOwnProperty.call(baseAdvanced, "competitionState")) {
        baseAdvanced.competitionState = "DEVELOPMENT";
      }
      if (!Object.prototype.hasOwnProperty.call(baseAdvanced, "scoreRules")) {
        baseAdvanced.scoreRules = DEFAULT_PADEL_SCORE_RULES;
      }
      try {
        const config = await prisma.padelTournamentConfig.upsert({
          where: { eventId: event.id },
          create: {
            eventId: event.id,
            organizationId: organization.id,
            padelClubId,
            partnerClubIds,
            numberOfCourts: computedCourts,
            format: padelFormat,
            ruleSetId: padelConfigInput.ruleSetId || undefined,
            defaultCategoryId: padelDefaultCategoryId || undefined,
            eligibilityType: padelEligibilityType,
            splitDeadlineHours: splitDeadlineHours ?? undefined,
            isInterclub,
            teamSize: isInterclub ? teamSize ?? undefined : null,
            padelV2Enabled,
            advancedSettings: { ...baseAdvanced, courtIds, staffIds },
            lifecycleStatus,
            ...(eventStatus === EventStatus.PUBLISHED ? { publishedAt: lifecycleNow } : {}),
            lifecycleUpdatedAt: lifecycleNow,
          },
          update: {
            padelClubId,
            partnerClubIds,
            numberOfCourts: computedCourts,
            format: padelFormat,
            ruleSetId: padelConfigInput.ruleSetId || undefined,
            defaultCategoryId: padelDefaultCategoryId || undefined,
            eligibilityType: padelEligibilityType,
            splitDeadlineHours: splitDeadlineHours ?? undefined,
            isInterclub,
            teamSize: isInterclub ? teamSize ?? undefined : null,
            padelV2Enabled,
            advancedSettings: { ...baseAdvanced, courtIds, staffIds },
            ...(body?.status
              ? {
                  lifecycleStatus,
                  ...(eventStatus === EventStatus.PUBLISHED ? { publishedAt: lifecycleNow } : {}),
                  lifecycleUpdatedAt: lifecycleNow,
                }
              : {}),
          },
        });
        if (config.ruleSetId) {
          await prisma.$transaction(async (tx) => {
            const fresh = await tx.padelTournamentConfig.findUnique({
              where: { id: config.id },
              select: { id: true, ruleSetId: true, ruleSetVersionId: true },
            });
            if (!fresh?.ruleSetId) return;
            if (!fresh.ruleSetVersionId) {
              const version = await ensurePadelRuleSetVersion({
                tx,
                tournamentConfigId: fresh.id,
                ruleSetId: fresh.ruleSetId,
                actorUserId: user.id,
              });
              await tx.padelTournamentConfig.update({
                where: { id: fresh.id },
                data: { ruleSetVersionId: version.id },
              });
            }
          });
        }
      } catch (padelErr) {
        console.warn("[organização/events/create] padel config falhou", padelErr);
      }
    }

    if (templateType === "PADEL" && padelCategoryIds.length > 0) {
      const linkFormat =
        typeof padelConfigInput?.format === "string" && ALLOWED_PADEL_FORMATS.has(padelConfigInput.format as padel_format)
          ? (padelConfigInput.format as padel_format)
          : undefined;
      const linkData = padelCategoryIds.map((categoryId) => {
        const config = categoryConfigMap.get(categoryId);
        const pricePerPlayerCents =
          typeof config?.pricePerPlayerCents === "number" && Number.isFinite(config.pricePerPlayerCents)
            ? Math.max(0, Math.floor(config.pricePerPlayerCents))
            : 0;
        const currency = config?.currency ?? "EUR";
        return {
          eventId: event.id,
          padelCategoryId: categoryId,
          format: config?.format ?? linkFormat,
          capacityTeams: config?.capacityTeams ?? null,
          pricePerPlayerCents,
          currency,
          isEnabled: true,
        };
      });
      try {
        await prisma.padelEventCategoryLink.createMany({
          data: linkData,
          skipDuplicates: true,
        });
      } catch (padelLinkErr) {
        console.warn("[organização/events/create] padel categories falhou", padelLinkErr);
      }
    }

    let padelCategoryLinkMap = new Map<number, number>();
    if (templateType === "PADEL" && padelCategoryIds.length > 0) {
      const links = await prisma.padelEventCategoryLink.findMany({
        where: { eventId: event.id },
        select: { id: true, padelCategoryId: true },
      });
      padelCategoryLinkMap = new Map(links.map((link) => [link.padelCategoryId, link.id]));
    }

    if (templateType === "PADEL") {
      const advanced =
        advancedSettings && typeof advancedSettings === "object"
          ? (advancedSettings as Record<string, unknown>)
          : null;
      const registrationEndsAtRaw =
        advanced && typeof advanced.registrationEndsAt === "string" ? advanced.registrationEndsAt : null;
      const registrationEndsAt =
        registrationEndsAtRaw && !Number.isNaN(new Date(registrationEndsAtRaw).getTime())
          ? new Date(registrationEndsAtRaw)
          : null;
      const fallbackDeadline = startsAt
        ? new Date(startsAt.getTime() - 24 * 60 * 60 * 1000)
        : null;
      const inscriptionDeadlineAt = registrationEndsAt ?? fallbackDeadline ?? null;
      const requestedFormat =
        typeof padelConfigInput?.format === "string" ? padelConfigInput.format : null;
      const padelFormat =
        requestedFormat && ALLOWED_PADEL_FORMATS.has(requestedFormat as padel_format)
          ? (requestedFormat as padel_format)
          : padel_format.TODOS_CONTRA_TODOS;
      try {
        await createTournamentForEvent({
          eventId: event.id,
          format: TournamentFormat.MANUAL,
          config: { padelFormat },
          actorUserId: profile.id,
          ...(inscriptionDeadlineAt ? { inscriptionDeadlineAt } : {}),
        });
      } catch (err) {
        console.warn("[organização/events/create] criar tournament falhou", err);
      }
    }

    if (templateType !== "PADEL") {
      const autoTicketTypes =
        ticketTypesData.length === 0
          ? [
              {
                name: "Entrada gratuita",
                price: 0,
                totalQuantity: null,
                publicAccess: true,
                participantAccess: false,
                padelCategoryId: null,
              },
            ]
          : ticketTypesData;

      for (const ticket of autoTicketTypes) {
        const padelEventCategoryLinkId = null;
        await prisma.ticketType.create({
          data: {
            eventId: event.id,
            name: ticket.name,
            price: Math.round(ticket.price * 100),
            totalQuantity: ticket.totalQuantity ?? null,
            currency: "EUR",
            padelEventCategoryLinkId,
          },
          select: { id: true },
        });
      }
    }

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
    console.error("POST /api/organizacao/events/create error:", err);
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
