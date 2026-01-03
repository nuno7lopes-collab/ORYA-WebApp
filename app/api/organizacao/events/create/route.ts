

// app/api/organizacao/events/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { canManageEvents } from "@/lib/organizationPermissions";
import {
  EventParticipantAccessMode,
  EventPublicAccessMode,
  EventTemplateType,
  LiveHubVisibility,
  PayoutMode,
  ResaleMode,
} from "@prisma/client";

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

    // Confirmar que o profile existe (caso o user tenha contornado o onboarding)
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Perfil não encontrado. Completa o onboarding antes de criares eventos de organização.",
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
    const organizationTrusted = organization?.status === "ACTIVE";
    const payoutMode: PayoutMode = !isAdmin && !organizationTrusted ? PayoutMode.PLATFORM : payoutModeRequested;

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

    const isPadelOrganization = organization?.organizationCategory === "PADEL";
    const padelRequested = Boolean(body.padel) || isPadelOrganization;
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
          publicAccess: t.publicAccess === true,
          participantAccess: t.participantAccess === true,
        };
      })
      .filter((t): t is { name: string; price: number; totalQuantity: number | null; publicAccess: boolean; participantAccess: boolean } =>
        Boolean(t)
      );

    if (ticketPriceError) {
      return NextResponse.json({ ok: false, error: ticketPriceError }, { status: 400 });
    }

    const paymentsStatus = organization
      ? organization.stripeAccountId
        ? organization.stripeChargesEnabled && organization.stripePayoutsEnabled
          ? "READY"
          : "PENDING"
        : "NO_STRIPE"
      : "NO_STRIPE";
    const hasPaidTickets = ticketTypesData.some((t) => t.price > 0);
    if (payoutMode === PayoutMode.ORGANIZATION && hasPaidTickets && paymentsStatus !== "READY" && !isAdmin) {
      return NextResponse.json(
        {
          ok: false,
          code: "PAYMENTS_NOT_READY",
          error: "Para vender bilhetes pagos, primeiro liga a tua conta Stripe em Finanças & Payouts.",
        },
        { status: 403 },
      );
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
      try {
        await prisma.padelTournamentConfig.upsert({
          where: { eventId: event.id },
          create: {
            eventId: event.id,
            organizationId: organization.id,
            padelClubId,
            partnerClubIds,
            numberOfCourts: computedCourts,
            format: (padelConfigInput.format as any) ?? "TODOS_CONTRA_TODOS",
            ruleSetId: padelConfigInput.ruleSetId || undefined,
            defaultCategoryId: padelConfigInput.defaultCategoryId || undefined,
            padelV2Enabled,
            advancedSettings: { ...((advancedSettings as any) ?? {}), courtIds, staffIds },
          },
          update: {
            padelClubId,
            partnerClubIds,
            numberOfCourts: computedCourts,
            format: (padelConfigInput.format as any) ?? "TODOS_CONTRA_TODOS",
            ruleSetId: padelConfigInput.ruleSetId || undefined,
            defaultCategoryId: padelConfigInput.defaultCategoryId || undefined,
            padelV2Enabled,
            advancedSettings: { ...((advancedSettings as any) ?? {}), courtIds, staffIds },
          },
        });
      } catch (padelErr) {
        console.warn("[organização/events/create] padel config falhou", padelErr);
      }
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
            },
          ]
        : ticketTypesData;

    const createdTicketTypes: Array<{
      id: number;
      publicAccess: boolean;
      participantAccess: boolean;
    }> = [];

    for (const ticket of autoTicketTypes) {
      const created = await prisma.ticketType.create({
        data: {
          eventId: event.id,
          name: ticket.name,
          price: Math.round(ticket.price * 100),
          totalQuantity: ticket.totalQuantity ?? null,
          currency: "EUR",
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
