

// app/api/organizacao/events/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { canManageEvents } from "@/lib/organizationPermissions";
import { clampDeadlineHours } from "@/domain/padelDeadlines";
import { DEFAULT_PADEL_SCORE_RULES } from "@/domain/padel/score";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { resolvePrimaryModule } from "@/lib/organizationCategories";
import {
  EventParticipantAccessMode,
  EventPublicAccessMode,
  EventTemplateType,
  LiveHubVisibility,
  PadelEligibilityType,
  PayoutMode,
  ResaleMode,
  padel_format,
} from "@prisma/client";

const ALLOWED_PADEL_FORMATS = new Set<padel_format>([
  padel_format.TODOS_CONTRA_TODOS,
  padel_format.QUADRO_ELIMINATORIO,
  padel_format.GRUPOS_ELIMINATORIAS,
  padel_format.QUADRO_AB,
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
  locationName?: string;
  locationCity?: string;
  templateType?: string; // PADEL | OTHER
  ticketTypes?: TicketTypeInput[];
  address?: string | null;
  resaleMode?: string; // ALWAYS | AFTER_SOLD_OUT | DISABLED
  coverImageUrl?: string | null;
  inviteOnly?: boolean;
  publicAccessMode?: string;
  participantAccessMode?: string;
  publicTicketScope?: string;
  participantTicketScope?: string;
  publicTicketTypeIds?: number[];
  participantTicketTypeIds?: number[];
  liveHubVisibility?: string;
  payoutMode?: string; // ORGANIZATION | PLATFORM
  feeMode?: string;
  platformFeeBps?: number;
  platformFeeFixedCents?: number;
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
    }>;
    splitDeadlineHours?: number | null;
    padelV2Enabled?: boolean;
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
  }>;
  splitDeadlineHours?: number | null;
  advancedSettings?: unknown;
  padelV2Enabled?: boolean;
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
  try {
    let body: CreateOrganizationEventBody | null = null;

    try {
      body = (await req.json()) as CreateOrganizationEventBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Body inválido." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    // Confirmar perfil e onboarding do utilizador (caso o user tenha contornado o onboarding)
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Perfil não encontrado. Completa o onboarding de utilizador antes de criares eventos de organização.",
        },
        { status: 400 }
      );
    }
    const hasUserOnboarding =
      profile.onboardingDone ||
      (Boolean(profile.fullName?.trim()) && Boolean(profile.username?.trim()));
    if (!hasUserOnboarding) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Completa o onboarding de utilizador (nome e username) antes de criares eventos de organização.",
        },
        { status: 400 }
      );
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
    });
    if (!organization || !membership || !canManageEvents(membership.role)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    const isAdmin = Array.isArray(profile.roles) ? profile.roles.includes("admin") : false;
    const isPlatformAccount = organization?.orgType === "PLATFORM";

    const title = body.title?.trim();
    const description = body.description?.trim() ?? "";
    const startsAtRaw = body.startsAt;
    const endsAtRaw = body.endsAt;
    const locationName = body.locationName?.trim() ?? "";
    const locationCity = body.locationCity?.trim() ?? "";
    const address = body.address?.trim() || null;
    const templateTypeRaw = body.templateType?.toUpperCase();
    const resaleModeRaw = body.resaleMode?.toUpperCase() as
      | "ALWAYS"
      | "AFTER_SOLD_OUT"
      | "DISABLED"
      | undefined;
    const payoutModeRequested =
      body.payoutMode?.toUpperCase() === "PLATFORM" ? PayoutMode.PLATFORM : PayoutMode.ORGANIZATION;
    const payoutMode: PayoutMode = isPlatformAccount ? PayoutMode.PLATFORM : payoutModeRequested;

    if (!title) {
      return NextResponse.json(
        { ok: false, error: "Título é obrigatório." },
        { status: 400 }
      );
    }

    if (!startsAtRaw) {
      return NextResponse.json(
        { ok: false, error: "Data/hora de início é obrigatória." },
        { status: 400 }
      );
    }

    if (!locationCity) {
      return NextResponse.json(
        { ok: false, error: "Cidade é obrigatória." },
        { status: 400 },
      );
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
      return NextResponse.json(
        { ok: false, error: "Data/hora de início inválida." },
        { status: 400 }
      );
    }

    // Para simplificar e evitar conflitos de tipos, endsAt será sempre enviado.
    // Se o utilizador não mandar, usamos a mesma data/hora de início.
    const endsAtParsed = parseDate(endsAtRaw);
    const endsAt = endsAtParsed && endsAtParsed >= startsAt ? endsAtParsed : startsAt;

    const primaryModule = resolvePrimaryModule(
      (organization as { primaryModule?: string | null })?.primaryModule ?? null,
      null,
    );
    const isPadelOrganization = primaryModule === "TORNEIOS";
    const padelRequested = Boolean(body.padel) || templateTypeRaw === "PADEL" || isPadelOrganization;
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
    const inviteOnly = body.inviteOnly === true;
    const publicAccessModeRaw = body.publicAccessMode?.toUpperCase();
    const participantAccessModeRaw = body.participantAccessMode?.toUpperCase();
    const publicAccessMode: EventPublicAccessMode =
      publicAccessModeRaw === "OPEN" || publicAccessModeRaw === "TICKET" || publicAccessModeRaw === "INVITE"
        ? (publicAccessModeRaw as EventPublicAccessMode)
        : inviteOnly
          ? EventPublicAccessMode.INVITE
          : EventPublicAccessMode.OPEN;
    const participantAccessMode: EventParticipantAccessMode =
      participantAccessModeRaw === "NONE" ||
      participantAccessModeRaw === "TICKET" ||
      participantAccessModeRaw === "INSCRIPTION" ||
      participantAccessModeRaw === "INVITE"
        ? (participantAccessModeRaw as EventParticipantAccessMode)
        : EventParticipantAccessMode.NONE;
    const publicTicketScopeRaw = body.publicTicketScope?.toUpperCase();
    const participantTicketScopeRaw = body.participantTicketScope?.toUpperCase();
    const publicTicketScope = publicTicketScopeRaw === "SPECIFIC" ? "SPECIFIC" : "ALL";
    const participantTicketScope = participantTicketScopeRaw === "SPECIFIC" ? "SPECIFIC" : "ALL";
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
      return NextResponse.json({ ok: false, error: ticketPriceError }, { status: 400 });
    }

    const hasPaidTickets = ticketTypesData.some((t) => t.price > 0);
    if (hasPaidTickets && !isAdmin) {
      const gate = getPaidSalesGate({
        officialEmail: organization?.officialEmail ?? null,
        officialEmailVerifiedAt: organization?.officialEmailVerifiedAt ?? null,
        stripeAccountId: organization?.stripeAccountId ?? null,
        stripeChargesEnabled: organization?.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: organization?.stripePayoutsEnabled ?? false,
        requireStripe: payoutMode === PayoutMode.ORGANIZATION && !isPlatformAccount,
      });
      if (!gate.ok) {
        return NextResponse.json(
          {
            ok: false,
            code: "PAYMENTS_NOT_READY",
            error: formatPaidSalesGateMessage(gate, "Para vender bilhetes pagos,"),
            missingEmail: gate.missingEmail,
            missingStripe: gate.missingStripe,
          },
          { status: 403 },
        );
      }
    }

    if (publicAccessMode === "TICKET" && publicTicketScope === "SPECIFIC") {
      const hasPublicTicket = ticketTypesData.some((t) => t.publicAccess);
      if (!hasPublicTicket) {
        return NextResponse.json(
          { ok: false, error: "Seleciona pelo menos um bilhete para o público." },
          { status: 400 },
        );
      }
    }
    if (participantAccessMode === "TICKET" && participantTicketScope === "SPECIFIC") {
      const hasParticipantTicket = ticketTypesData.some((t) => t.participantAccess);
      if (!hasParticipantTicket) {
        return NextResponse.json(
          { ok: false, error: "Seleciona pelo menos um bilhete para participantes." },
          { status: 400 },
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
    const categoryConfigMap = new Map<number, { capacityTeams: number | null; format: padel_format | null }>();

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
      const eligibilityRaw = typeof padelConfigInput?.eligibilityType === "string" ? padelConfigInput.eligibilityType : null;
      if (eligibilityRaw && Object.values(PadelEligibilityType).includes(eligibilityRaw as PadelEligibilityType)) {
        padelEligibilityType = eligibilityRaw as PadelEligibilityType;
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
        categoryConfigMap.set(categoryId, { capacityTeams, format });
      });

      const requestedCategoryIds = Array.isArray(padelConfigInput?.categoryIds)
        ? padelConfigInput.categoryIds.filter((id) => typeof id === "number" && Number.isFinite(id))
        : [];
      const requestedDefaultCategoryId =
        typeof padelConfigInput?.defaultCategoryId === "number" && Number.isFinite(padelConfigInput.defaultCategoryId)
          ? padelConfigInput.defaultCategoryId
          : null;
      let allowedCategoryIds: Set<number> | null = null;

      if (padelClubId) {
        const club = await prisma.padelClub.findFirst({
          where: { id: padelClubId, organizationId: organization.id, isActive: true, deletedAt: null },
          select: { id: true },
        });
        if (!club) {
          return NextResponse.json(
            { ok: false, error: "Clube de padel arquivado ou inexistente." },
            { status: 400 },
          );
        }
      }

      if (partnerClubIds.length > 0) {
        const activePartners = await prisma.padelClub.findMany({
          where: { id: { in: partnerClubIds }, organizationId: organization.id, isActive: true, deletedAt: null },
          select: { id: true },
        });
        const allowed = new Set(activePartners.map((c) => c.id));
        partnerClubIds = partnerClubIds.filter((id) => allowed.has(id));
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
        const isAllowed =
          padelCategoryIds.length === 0 || padelCategoryIds.includes(requestedDefaultCategoryId);
        padelDefaultCategoryId = isAllowed ? requestedDefaultCategoryId : null;
      } else if (padelCategoryIds.length > 0) {
        padelDefaultCategoryId = padelCategoryIds[0];
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

    // Criar o evento primeiro
    const event = await prisma.event.create({
      data: {
        slug,
        title,
        description,
        type: "ORGANIZATION_EVENT",
        templateType,
        ownerUserId: profile.id,
        organization: organization?.id ? { connect: { id: organization.id } } : undefined,
        startsAt,
        endsAt,
        locationName,
        locationCity,
        address,
        isFree: ticketTypesData.every((t) => t.price === 0),
        inviteOnly: publicAccessMode === "INVITE",
        publicAccessMode,
        participantAccessMode,
        publicTicketTypeIds: [],
        participantTicketTypeIds: [],
        liveHubVisibility,
        status: "PUBLISHED",
        resaleMode,
        coverImageUrl,
        payoutMode,
      },
    });

    if (templateType === "PADEL" && padelConfigInput && organization) {
      const padelV2Enabled = padelConfigInput?.padelV2Enabled ?? true;
      const courtIds = Array.isArray(padelConfigInput?.courtIds) ? padelConfigInput?.courtIds : [];
      const staffIds = Array.isArray(padelConfigInput?.staffIds) ? padelConfigInput?.staffIds : [];
      const computedCourts = Math.max(1, padelConfigInput.numberOfCourts || courtIds.length || 1);
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
        await prisma.padelTournamentConfig.upsert({
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
            padelV2Enabled,
            advancedSettings: { ...baseAdvanced, courtIds, staffIds },
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
            padelV2Enabled,
            advancedSettings: { ...baseAdvanced, courtIds, staffIds },
          },
        });
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
        return {
          eventId: event.id,
          padelCategoryId: categoryId,
          format: config?.format ?? linkFormat,
          capacityTeams: config?.capacityTeams ?? null,
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

    const createdTicketTypes: Array<{
      id: number;
      publicAccess: boolean;
      participantAccess: boolean;
    }> = [];

    for (const ticket of autoTicketTypes) {
      const padelEventCategoryLinkId =
        templateType === "PADEL" && ticket.padelCategoryId
          ? padelCategoryLinkMap.get(ticket.padelCategoryId) ?? null
          : null;
      const created = await prisma.ticketType.create({
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
      createdTicketTypes.push({
        id: created.id,
        publicAccess: ticket.publicAccess,
        participantAccess: ticket.participantAccess,
      });
    }

    const shouldAssignPublic = publicAccessMode === "TICKET" && publicTicketScope === "SPECIFIC";
    const shouldAssignParticipant = participantAccessMode === "TICKET" && participantTicketScope === "SPECIFIC";
    const publicTicketTypeIds = shouldAssignPublic
      ? createdTicketTypes.filter((t) => t.publicAccess).map((t) => t.id)
      : [];
    const participantTicketTypeIds = shouldAssignParticipant
      ? createdTicketTypes.filter((t) => t.participantAccess).map((t) => t.id)
      : [];

    if (publicTicketTypeIds.length > 0 || participantTicketTypeIds.length > 0) {
      await prisma.event.update({
        where: { id: event.id },
        data: {
          publicTicketTypeIds,
          participantTicketTypeIds,
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        event: {
          id: event.id,
          slug: event.slug,
          title: event.title,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("POST /api/organizacao/events/create error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao criar evento." },
      { status: 500 }
    );
  }
}
