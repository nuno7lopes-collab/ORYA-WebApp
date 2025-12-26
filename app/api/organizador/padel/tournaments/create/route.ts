import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { resolveOrganizerIdFromRequest } from "@/lib/organizerId";
import { FeeMode, PadelFormat, RefundFeePayer, ResaleMode } from "@prisma/client";
import { isOrgAdminOrAbove } from "@/lib/organizerPermissions";

type TicketInput = {
  name?: string;
  price?: number;
  totalQuantity?: number | null;
};

type Body = {
  title?: string;
  description?: string;
  internalNote?: string | null;
  coverImageUrl?: string | null;
  startsAt?: string;
  endsAt?: string;
  locationName?: string | null;
  locationCity?: string;
  address?: string | null;
  templateType?: string;
  categories?: string[];
  feeMode?: "ADDED" | "INCLUDED";
  refundFeePayer?: RefundFeePayer;
  ticketTypes?: TicketInput[];
  padel?: unknown; // ignorado para já, usamos defaults globais
  visibility?: "PUBLIC" | "PRIVATE";
  publicListingEnabled?: boolean;
  padelClubId?: number;
  partnerClubIds?: Array<number | string>;
  courtsCount?: number | null;
  clubHours?: string | null;
  tournamentState?: "OCULTO" | "INSCRICOES" | "PUBLICO" | "TERMINADO" | "CANCELADO";
  advancedSettings?: Record<string, unknown> | null;
};

function parseDate(raw?: string | null) {
  if (!raw) return null;
  const normalized = raw.replace(" ", "T");
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) return date;
  const alt = new Date(`${normalized}:00`);
  if (!Number.isNaN(alt.getTime())) return alt;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 });
    }

    const organizerId = resolveOrganizerIdFromRequest(req);
    const { organizer, membership } = await getActiveOrganizerForUser(user.id, {
      organizerId: organizerId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!organizer || !profile || !membership || !isOrgAdminOrAbove(membership.role)) {
      return NextResponse.json({ ok: false, error: "Organizador não encontrado." }, { status: 403 });
    }
    const isAdmin = Array.isArray(profile.roles) ? profile.roles.includes("admin") : false;

    const title = body.title?.trim();
    if (!title) return NextResponse.json({ ok: false, error: "Título é obrigatório." }, { status: 400 });

    const padelClubId =
      typeof body.padelClubId === "number"
        ? body.padelClubId
        : typeof body.padelClubId === "string"
          ? Number(body.padelClubId)
          : null;
    if (!padelClubId || Number.isNaN(padelClubId)) {
      return NextResponse.json(
        { ok: false, error: "Precisas de escolher um clube de Padel para criar o torneio." },
        { status: 400 },
      );
    }

    const club = await prisma.padelClub.findFirst({
      where: { id: padelClubId, organizerId: organizer.id, isActive: true },
    });
    if (!club) {
      return NextResponse.json(
        { ok: false, error: "Clube de Padel inválido ou inativo para este organizador." },
        { status: 400 },
      );
    }

    const partnerClubIdsRaw = Array.isArray(body.partnerClubIds) ? body.partnerClubIds : [];
    const partnerClubIds = partnerClubIdsRaw
      .map((c) => (typeof c === "number" ? c : typeof c === "string" ? Number(c) : null))
      .filter((v) => Number.isFinite(v) && v !== padelClubId) as number[];
    const partnerClubs =
      partnerClubIds.length > 0
        ? await prisma.padelClub.findMany({
            where: { id: { in: partnerClubIds }, organizerId: organizer.id, isActive: true },
            select: { id: true },
          })
        : [];
    const validatedPartnerIds = partnerClubs.map((c) => c.id);
    const allClubIds = [club.id, ...validatedPartnerIds];

    const startsAt = parseDate(body.startsAt);
    if (!startsAt) return NextResponse.json({ ok: false, error: "Data de início inválida." }, { status: 400 });
    const endsAtParsed = parseDate(body.endsAt);
    const endsAt = endsAtParsed && endsAtParsed >= startsAt ? endsAtParsed : startsAt;

    const locationCity = body.locationCity?.trim() || club.city?.trim() || "";
    if (!locationCity) return NextResponse.json({ ok: false, error: "Cidade é obrigatória." }, { status: 400 });
    // Permitimos cidades fora da whitelist

    const ticketTypesInput = Array.isArray(body.ticketTypes) ? body.ticketTypes : [];
    const ticketTypes = ticketTypesInput
      .map((t) => {
        const name = t.name?.trim();
        if (!name) return null;
        const price = typeof t.price === "number" && !Number.isNaN(t.price) ? t.price : 0;
        const totalQuantity =
          typeof t.totalQuantity === "number" && t.totalQuantity > 0 ? Math.floor(t.totalQuantity) : null;
        return { name, price, totalQuantity };
      })
      .filter(Boolean) as { name: string; price: number; totalQuantity: number | null }[];

    if (ticketTypes.length === 0) {
      return NextResponse.json({ ok: false, error: "Adiciona pelo menos um tipo de inscrição." }, { status: 400 });
    }

    const payoutMode = !isAdmin && organizer.status !== "ACTIVE" ? "PLATFORM" : "ORGANIZER";
    const hasPaidTickets = ticketTypes.some((t) => t.price > 0);
    const paymentsStatus = organizer.stripeAccountId
      ? organizer.stripeChargesEnabled && organizer.stripePayoutsEnabled
        ? "READY"
        : "PENDING"
      : "NO_STRIPE";
    if (payoutMode === "ORGANIZER" && hasPaidTickets && paymentsStatus !== "READY" && !isAdmin) {
      return NextResponse.json(
        {
          ok: false,
          code: "PAYMENTS_NOT_READY",
          error: "Para vender inscrições pagas, primeiro liga a tua conta Stripe em Finanças & Payouts.",
        },
        { status: 403 },
      );
    }

    const feeModeRaw = (body.feeMode ?? "ADDED").toUpperCase();
    const feeMode: FeeMode = feeModeRaw === "INCLUDED" ? FeeMode.INCLUDED : FeeMode.ADDED;
    const refundFeePayer = body.refundFeePayer || organizer.refundFeePayer || RefundFeePayer.CUSTOMER;
    const advancedSettings =
      body.advancedSettings && typeof body.advancedSettings === "object" ? body.advancedSettings : null;

    // Courts e staff herdados dos clubes selecionados (principal + parceiros)
    const courtsFromClubs = await prisma.padelClubCourt.findMany({
      where: { padelClubId: { in: allClubIds }, isActive: true },
      select: { id: true, padelClubId: true, name: true, indoor: true, displayOrder: true },
      orderBy: [{ padelClubId: "asc" }, { displayOrder: "asc" }, { id: "asc" }],
    });
    const clubNames = await prisma.padelClub.findMany({
      where: { id: { in: allClubIds } },
      select: { id: true, name: true },
    });
    const clubNameMap = Object.fromEntries(clubNames.map((c) => [c.id, c.name]));

    const staffFromClubs = await prisma.padelClubStaff.findMany({
      where: { padelClubId: { in: allClubIds }, inheritToEvents: true },
      select: { id: true, padelClubId: true, email: true, userId: true, role: true },
      orderBy: [{ padelClubId: "asc" }, { id: "asc" }],
    });

    // Defaults do clube selecionado
    const courtsInput =
      typeof body.courtsCount === "number"
        ? body.courtsCount
        : typeof body.courtsCount === "string"
          ? Number(body.courtsCount)
          : null;
    const defaultCourts =
      courtsInput && Number.isFinite(courtsInput) && courtsInput > 0
        ? Math.min(1000, Math.floor(courtsInput))
        : club.courtsCount && club.courtsCount > 0
          ? club.courtsCount
          : 1;
    const defaultRuleSetId = organizer.padelDefaultRuleSetId ?? null;
    const clubHours = typeof body.clubHours === "string" ? body.clubHours.trim() : club.hours?.trim() || null;
    const locationName = body.locationName?.trim() || club.shortName || club.name;
    const address = body.address?.trim() || club.address || null;
    const tournamentState =
      typeof body.tournamentState === "string"
        ? body.tournamentState.toUpperCase()
        : "OCULTO";
    const eventStatus =
      tournamentState === "CANCELADO"
        ? "CANCELLED"
        : tournamentState === "TERMINADO"
          ? "FINISHED"
          : tournamentState === "OCULTO"
            ? "DRAFT"
            : "PUBLISHED";

    const event = await prisma.event.create({
      data: {
        slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        description: body.description?.trim() ?? "",
        type: "ORGANIZER_EVENT",
        templateType: "PADEL",
        organizer: { connect: { id: organizer.id } },
        ownerUserId: profile.id,
        startsAt,
        endsAt,
        locationName,
        locationCity,
        address,
        isFree: ticketTypes.every((t) => t.price === 0),
        status: eventStatus as any,
        resaleMode: ResaleMode.ALWAYS,
        coverImageUrl: body.coverImageUrl?.trim() || null,
        feeMode,
        payoutMode,
      },
    });

    // Categorias: força PADEL
    await prisma.eventCategory.create({
      data: {
        eventId: event.id,
        category: "PADEL",
      },
    });

    await prisma.ticketType.createMany({
      data: ticketTypes.map((t) => ({
        eventId: event.id,
        name: t.name,
        price: Math.round(t.price * 100),
        totalQuantity: t.totalQuantity,
      })),
    });

    // Validar rule set default (se existir)
    if (defaultRuleSetId) {
      const ruleSetValid = await prisma.padelRuleSet.findFirst({
        where: { id: defaultRuleSetId, organizerId: organizer.id },
        select: { id: true },
      });
      if (!ruleSetValid) {
        return NextResponse.json(
          { ok: false, error: "Rule set inválido para este organizador." },
          { status: 400 },
        );
      }
    }

    // Config Padel v2 (defaults globais + versionamento de formato)
    const formatValue: PadelFormat = "GRUPOS_ELIMINATORIAS";
    const formatEffective = formatValue;
    const generationVersion = "v1-groups-ko";
    const mergedAdvancedSettings = {
      ...advancedSettings,
      formatRequested: formatValue,
      formatEffective,
      generationVersion,
      groupsConfig: (advancedSettings as any)?.groupsConfig ?? {
        mode: "AUTO",
        qualifyPerGroup: 2,
        seeding: "SNAKE",
      },
    };
    await prisma.padelTournamentConfig.upsert({
      where: { eventId: event.id },
      create: {
        eventId: event.id,
        organizerId: organizer.id,
        format: formatEffective,
        numberOfCourts: defaultCourts,
        ruleSetId: defaultRuleSetId,
        padelClubId: club.id,
        partnerClubIds: validatedPartnerIds,
        clubHours,
        enabledFormats: [],
        padelV2Enabled: true,
        splitDeadlineHours: 48,
        autoCancelUnpaid: true,
        allowCaptainAssume: true,
        defaultPaymentMode: null,
        refundFeePayer,
        advancedSettings: {
          ...mergedAdvancedSettings,
          courtsFromClubs: courtsFromClubs.map((c) => ({
            id: c.id,
            clubId: c.padelClubId,
            clubName: clubNameMap[c.padelClubId] || null,
            name: c.name,
            indoor: c.indoor,
            displayOrder: c.displayOrder,
          })),
          staffFromClubs: staffFromClubs.map((s) => ({
            id: s.id,
            clubId: s.padelClubId,
            clubName: clubNameMap[s.padelClubId] || null,
            email: s.email,
            userId: s.userId,
            role: s.role,
          })),
        } as any,
      },
      update: {
        format: formatEffective,
        numberOfCourts: defaultCourts,
        ruleSetId: defaultRuleSetId,
        padelClubId: club.id,
        partnerClubIds: validatedPartnerIds,
        clubHours,
        enabledFormats: [],
        padelV2Enabled: true,
        splitDeadlineHours: 48,
        autoCancelUnpaid: true,
        allowCaptainAssume: true,
        defaultPaymentMode: null,
        refundFeePayer,
        advancedSettings: {
          ...mergedAdvancedSettings,
          courtsFromClubs: courtsFromClubs.map((c) => ({
            id: c.id,
            clubId: c.padelClubId,
            clubName: clubNameMap[c.padelClubId] || null,
            name: c.name,
            indoor: c.indoor,
            displayOrder: c.displayOrder,
          })),
          staffFromClubs: staffFromClubs.map((s) => ({
            id: s.id,
            clubId: s.padelClubId,
            clubName: clubNameMap[s.padelClubId] || null,
            email: s.email,
            userId: s.userId,
            role: s.role,
          })),
        } as any,
      },
    });

    return NextResponse.json({ ok: true, event: { id: event.id, slug: event.slug } }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("[organizador/padel/tournaments/create] error", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar torneio de Padel." }, { status: 500 });
  }
}
