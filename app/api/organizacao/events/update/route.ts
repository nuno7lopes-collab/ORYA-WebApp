// app/api/organizacao/events/update/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import {
  TicketTypeStatus,
  Prisma,
  EventTemplateType,
  LiveHubVisibility,
  EventPublicAccessMode,
  EventParticipantAccessMode,
  EventPricingMode,
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
import { createEventAccessPolicyVersion } from "@/lib/checkin/accessPolicy";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { appendEventLog } from "@/domain/eventLog/append";
import { SourceType } from "@prisma/client";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { recordSearchIndexOutbox } from "@/domain/searchIndex/outbox";
import { validateZeroPriceGuard } from "@/domain/events/pricingGuard";
import { shouldEmitSearchIndexUpdate } from "@/domain/searchIndex/triggers";

type TicketTypeUpdate = {
  id: number;
  status?: TicketTypeStatus;
};

type NewTicketType = {
  name: string;
  description?: string | null;
  price: number; // cents
  totalQuantity?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  padelEventCategoryLinkId?: number | null;
};

type UpdateEventBody = {
  eventId?: number;
  archive?: boolean;
  title?: string | null;
  slug?: string | null;
  description?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  locationName?: string | null;
  locationCity?: string | null;
  address?: string | null;
  locationSource?: string | null;
  locationProviderId?: string | null;
  locationFormattedAddress?: string | null;
  locationComponents?: Record<string, unknown> | null;
  locationOverrides?: Record<string, unknown> | null;
  latitude?: number | null;
  longitude?: number | null;
  templateType?: string | null;
  isGratis?: boolean;
  pricingMode?: string | null;
  inviteOnly?: boolean;
  coverImageUrl?: string | null;
  liveHubVisibility?: string | null;
  liveStreamUrl?: string | null;
  publicAccessMode?: string | null;
  participantAccessMode?: string | null;
  publicTicketTypeIds?: number[];
  participantTicketTypeIds?: number[];
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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    let body: UpdateEventBody | null = null;
    try {
      body = (await req.json()) as UpdateEventBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 });
    }

    const eventId = Number(body?.eventId);
    if (!eventId || Number.isNaN(eventId)) {
      return NextResponse.json({ ok: false, error: "eventId é obrigatório." }, { status: 400 });
    }

    // Autorização: perfil + membership no organization do evento
    let event: {
      id: number;
      slug: string;
      organizationId: number | null;
      pricingMode: EventPricingMode | null;
      payoutMode: PayoutMode | null;
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
              organizationId: true,
              pricingMode: true,
              templateType: true,
              payoutMode: true,
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
                organization_id: number | null;
                payout_mode: PayoutMode | null;
                pricing_mode: EventPricingMode | null;
              }[]
            >(Prisma.sql`SELECT id, slug, organization_id, payout_mode, pricing_mode FROM app_v3.events WHERE id = ${eventId} LIMIT 1`);
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
              organizationId: row.organization_id,
              pricingMode: row.pricing_mode ?? null,
              payoutMode: row.payout_mode,
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
      return NextResponse.json(
        { ok: false, error: "Perfil não encontrado. Completa o onboarding de utilizador." },
        { status: 400 },
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
            "Completa o onboarding de utilizador (nome e username) antes de editares eventos.",
        },
        { status: 400 },
      );
    }

    event = eventResult;

    if (!event) {
      return NextResponse.json({ ok: false, error: "Evento não encontrado." }, { status: 404 });
    }

    const isAdmin = Array.isArray(profile.roles) ? profile.roles.includes("admin") : false;

    let membership: { role: OrganizationMemberRole; rolePack: OrganizationRolePack | null } | null = null;
    if (event.organizationId == null) {
      if (!isAdmin) {
        return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
    } else {
      membership = await resolveGroupMemberForOrg({ organizationId: event.organizationId, userId: user.id });
      if (!membership) {
        return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
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
        return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
    }

    if (event.organization) {
      const emailGate = ensureOrganizationEmailVerified(event.organization);
      if (!emailGate.ok) {
        return NextResponse.json({ ok: false, error: emailGate.error }, { status: 403 });
      }
    }

    if (body.accessPolicy) {
      try {
        await createEventAccessPolicyVersion(event.id, body.accessPolicy);
      } catch (err: any) {
        const message = typeof err?.message === "string" ? err.message : "";
        if (message.startsWith("ACCESS_POLICY_LOCKED")) {
          return NextResponse.json({ ok: false, error: "ACCESS_POLICY_LOCKED" }, { status: 409 });
        }
        if (message === "INVITE_TOKEN_TTL_REQUIRED") {
          return NextResponse.json(
            { ok: false, error: "INVITE_TOKEN_TTL_REQUIRED" },
            { status: 400 },
          );
        }
        throw err;
      }
    }

    const hasNonEurTickets = event.ticketTypes.some(
      (t) => t.currency && t.currency.toUpperCase() !== "EUR",
    );
    const hasNewTickets = Array.isArray(body.newTicketTypes) && body.newTicketTypes.length > 0;
    if (hasNonEurTickets && hasNewTickets) {
      return NextResponse.json(
        { ok: false, error: "CURRENCY_NOT_SUPPORTED" },
        { status: 400 },
      );
    }

    const organization = event.organization;

    const dataUpdate: Partial<Prisma.EventUncheckedUpdateInput> = {};
    if (body.archive === true) {
      const hasSoldTickets = event.ticketTypes.some((t) => (t.soldQuantity ?? 0) > 0);
      const hasRegistrations = (event._count?.tickets ?? 0) > 0 || (event._count?.reservations ?? 0) > 0;
      const hasPayments = hasSoldTickets;
      if (hasRegistrations || hasPayments) {
        return NextResponse.json(
          {
            ok: false,
            code: "EVENT_HAS_ATTENDEES",
            error:
              "Não é possível apagar/arquivar este evento porque já existem inscrições ou pagamentos associados.",
          },
          { status: 400 },
        );
      }
    }
    if (body.archive === true) {
      dataUpdate.isDeleted = true;
      dataUpdate.deletedAt = new Date();
    }
    if (body.title !== undefined) dataUpdate.title = body.title?.trim() ?? "";
    const slugSource =
      body.slug !== undefined
        ? body.slug
        : body.title !== undefined
          ? body.title
          : undefined;
    if (slugSource !== undefined) {
      const baseSlug = slugify(typeof slugSource === "string" ? slugSource : "");
      if (!baseSlug) {
        return NextResponse.json({ ok: false, error: "Slug inválido." }, { status: 400 });
      }
      const nextSlug = await generateUniqueSlug(baseSlug, eventId);
      if (nextSlug !== event.slug) {
        dataUpdate.slug = nextSlug;
      }
    }
    if (body.description !== undefined) dataUpdate.description = body.description ?? "";
    if (body.startsAt) {
      const d = new Date(body.startsAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ ok: false, error: "startsAt inválido." }, { status: 400 });
      }
      dataUpdate.startsAt = d;
    }
    if (body.endsAt) {
      const d = new Date(body.endsAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ ok: false, error: "endsAt inválido." }, { status: 400 });
      }
      dataUpdate.endsAt = d;
    }
    if (body.locationName !== undefined) dataUpdate.locationName = body.locationName ?? "";
    if (body.locationCity !== undefined) {
      const city = body.locationCity ?? "";
      // Permitimos cidades fora da whitelist
      dataUpdate.locationCity = city;
    }
    if (body.address !== undefined) dataUpdate.address = body.address ?? null;
    if (body.locationSource !== undefined) {
      const sourceRaw = typeof body.locationSource === "string" ? body.locationSource.toUpperCase() : null;
      dataUpdate.locationSource = sourceRaw === "OSM" ? "OSM" : sourceRaw === "MANUAL" ? "MANUAL" : null;
    }
    if (body.locationProviderId !== undefined) {
      dataUpdate.locationProviderId = body.locationProviderId?.trim() || null;
    }
    if (body.locationFormattedAddress !== undefined) {
      dataUpdate.locationFormattedAddress = body.locationFormattedAddress?.trim() || null;
    }
    if (body.locationComponents !== undefined) {
      dataUpdate.locationComponents =
        body.locationComponents && typeof body.locationComponents === "object"
          ? (body.locationComponents as Prisma.InputJsonValue)
          : null;
    }
    if (body.locationOverrides !== undefined) {
      const rawOverrides =
        body.locationOverrides && typeof body.locationOverrides === "object"
          ? (body.locationOverrides as Record<string, unknown>)
          : null;
      const overridesHouse =
        typeof rawOverrides?.houseNumber === "string" ? rawOverrides.houseNumber.trim() || null : null;
      const overridesPostal =
        typeof rawOverrides?.postalCode === "string" ? rawOverrides.postalCode.trim() || null : null;
      dataUpdate.locationOverrides =
        overridesHouse || overridesPostal
          ? ({ houseNumber: overridesHouse, postalCode: overridesPostal } as Prisma.InputJsonValue)
          : null;
    }
    if (body.latitude !== undefined) {
      const lat = typeof body.latitude === "number" || typeof body.latitude === "string" ? Number(body.latitude) : NaN;
      dataUpdate.latitude = Number.isFinite(lat) ? lat : null;
    }
    if (body.longitude !== undefined) {
      const lng = typeof body.longitude === "number" || typeof body.longitude === "string" ? Number(body.longitude) : NaN;
      dataUpdate.longitude = Number.isFinite(lng) ? lng : null;
    }
    if (body.templateType) {
      const tpl = body.templateType.toUpperCase();
      if (tpl === "SPORT") {
        dataUpdate.templateType = "PADEL";
      } else if ((Object.values(EventTemplateType) as string[]).includes(tpl)) {
        dataUpdate.templateType = tpl as EventTemplateType;
      }
    }
    if (body.inviteOnly !== undefined && body.publicAccessMode === undefined) {
      const inviteOnly = body.inviteOnly === true;
      dataUpdate.inviteOnly = inviteOnly;
      dataUpdate.publicAccessMode = inviteOnly ? EventPublicAccessMode.INVITE : EventPublicAccessMode.OPEN;
    }
    if (body.coverImageUrl !== undefined) dataUpdate.coverImageUrl = body.coverImageUrl ?? null;
    if (body.liveStreamUrl !== undefined) {
      const trimmed = typeof body.liveStreamUrl === "string" ? body.liveStreamUrl.trim() : "";
      dataUpdate.liveStreamUrl = trimmed ? trimmed : null;
    }
    if (body.liveHubVisibility !== undefined) {
      const normalized =
        typeof body.liveHubVisibility === "string" ? body.liveHubVisibility.trim().toUpperCase() : "";
      if (normalized === "PUBLIC" || normalized === "PRIVATE" || normalized === "DISABLED") {
        dataUpdate.liveHubVisibility = normalized as LiveHubVisibility;
      }
    }
    if (body.publicAccessMode !== undefined) {
      const normalized = typeof body.publicAccessMode === "string" ? body.publicAccessMode.trim().toUpperCase() : "";
      if (normalized === "OPEN" || normalized === "TICKET" || normalized === "INVITE") {
        dataUpdate.publicAccessMode = normalized as EventPublicAccessMode;
        dataUpdate.inviteOnly = normalized === "INVITE";
      }
    }
    if (body.participantAccessMode !== undefined) {
      const normalized = typeof body.participantAccessMode === "string" ? body.participantAccessMode.trim().toUpperCase() : "";
      if (normalized === "NONE" || normalized === "TICKET" || normalized === "INSCRIPTION" || normalized === "INVITE") {
        dataUpdate.participantAccessMode = normalized as EventParticipantAccessMode;
      }
    }
    if (Array.isArray(body.publicTicketTypeIds)) {
      dataUpdate.publicTicketTypeIds = body.publicTicketTypeIds
        .filter((id) => Number.isFinite(id))
        .map((id) => Number(id));
    }
    if (Array.isArray(body.participantTicketTypeIds)) {
      dataUpdate.participantTicketTypeIds = body.participantTicketTypeIds
        .filter((id) => Number.isFinite(id))
        .map((id) => Number(id));
    }
    if (
      isAdmin &&
      body.payoutMode &&
      (body.payoutMode.toUpperCase() === "PLATFORM" || body.payoutMode.toUpperCase() === "ORGANIZATION")
    ) {
      dataUpdate.payoutMode = body.payoutMode.toUpperCase() as PayoutMode;
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

    const payoutMode = event.payoutMode ?? PayoutMode.ORGANIZATION;
    const hasExistingPaid = event.ticketTypes.some((t) => (t.price ?? 0) > 0);
    const hasNewPaid = newTicketTypes.some((nt) => Number(nt.price ?? 0) > 0);
    if (event.organizationId && (hasExistingPaid || hasNewPaid) && !isAdmin) {
      const gate = getPaidSalesGate({
        officialEmail: organization?.officialEmail ?? null,
        officialEmailVerifiedAt: organization?.officialEmailVerifiedAt ?? null,
        stripeAccountId: organization?.stripeAccountId ?? null,
        stripeChargesEnabled: organization?.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: organization?.stripePayoutsEnabled ?? false,
        requireStripe: payoutMode === PayoutMode.ORGANIZATION && organization?.orgType !== "PLATFORM",
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

    const hasDataUpdate = Object.keys(dataUpdate).length > 0;
    const hasTicketStatusUpdates = ticketTypeUpdates.length > 0;
    const hasNewTickets = newTicketTypes.length > 0;
    const agendaRelevantUpdate =
      dataUpdate.title !== undefined ||
      dataUpdate.startsAt !== undefined ||
      dataUpdate.endsAt !== undefined ||
      dataUpdate.status !== undefined ||
      dataUpdate.isDeleted !== undefined;
    const searchIndexRelevantUpdate = shouldEmitSearchIndexUpdate({
      agendaRelevantUpdate,
      hasNewTickets,
      hasTicketStatusUpdates,
    });
    const eventLogId = searchIndexRelevantUpdate && event.organizationId ? crypto.randomUUID() : null;

    const ticketStatusOps: Array<{ ids: number[]; status: TicketTypeStatus }> = [];
    if (hasTicketStatusUpdates) {
      const updatesByStatus = new Map<TicketTypeStatus, number[]>();
      for (const upd of ticketTypeUpdates) {
        const tt = event.ticketTypes.find((t) => t.id === upd.id);
        if (!tt) continue;
        const status =
          upd.status && Object.values(TicketTypeStatus).includes(upd.status)
            ? upd.status
            : null;
        if (!status) continue;
        const list = updatesByStatus.get(status) ?? [];
        list.push(tt.id);
        updatesByStatus.set(status, list);
      }
      updatesByStatus.forEach((ids, status) => {
        ticketStatusOps.push({ ids, status });
      });
    }

    let newTicketData: typeof newTicketTypes | null = null;
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
          totalQuantity,
          status: TicketTypeStatus.ON_SALE,
          startsAt: startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : null,
          endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
          padelEventCategoryLinkId: padelLinkId ?? undefined,
          currency: "EUR",
        };
      });
    }

    const ticketPrices = [
      ...event.ticketTypes.map((t) => Number(t.price ?? 0)),
      ...newTicketTypes.map((t) => Number(t.price ?? 0)),
    ];
    const nextPricingMode = (dataUpdate.pricingMode ?? event.pricingMode ?? EventPricingMode.STANDARD) as EventPricingMode;
    const guard = validateZeroPriceGuard({ pricingMode: nextPricingMode, ticketPrices });
    if (!guard.ok) {
      return NextResponse.json({ ok: false, error: guard.error }, { status: 400 });
    }

    if (!hasDataUpdate && !hasTicketStatusUpdates && !hasNewTickets) {
      return NextResponse.json({ ok: false, error: "Nada para atualizar." }, { status: 400 });
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
      if (hasTicketStatusUpdates) {
        ticketStatusOps.forEach((op) => {
          txOps.push(
            tx.ticketType.updateMany({
              where: { id: { in: op.ids } },
              data: { status: op.status },
            }),
          );
        });
      }
      if (hasNewTickets) {
        if (Array.isArray(newTicketData) && newTicketData.length > 0) {
          txOps.push(
            tx.ticketType.createMany({
              data: newTicketData,
            }),
          );
        }
      }

      if (txOps.length > 0) {
        await Promise.all(txOps);
      }

      if (searchIndexRelevantUpdate && event.organizationId && eventLogId) {
        const nextTitle = (dataUpdate.title ?? event.title) as string;
        const nextStartsAt = (dataUpdate.startsAt ?? event.startsAt) as Date;
        const nextEndsAt = (dataUpdate.endsAt ?? event.endsAt ?? event.startsAt) as Date;
        const nextStatus =
          typeof dataUpdate.status === "string" ? dataUpdate.status : (event.status as string);

        await appendEventLog(
          {
            eventId: eventLogId,
            organizationId: event.organizationId,
            eventType: "event.updated",
            idempotencyKey: `event.updated:${eventId}:${Date.now()}`,
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

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/organizacao/events/update error:", err);
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    if (message === "INVALID_PADEL_CATEGORY_LINK") {
      return NextResponse.json({ ok: false, error: "Categoria Padel inválida para este evento." }, { status: 400 });
    }
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const code = err.code;
      const column =
        typeof err.meta?.column === "string" ? err.meta.column : null;
      const error =
        code === "P2022" && column
          ? `Erro de base de dados ao atualizar evento (coluna em falta: ${column}).`
          : "Erro de base de dados ao atualizar evento.";
      return NextResponse.json({ ok: false, error, code }, { status: 400 });
    }
    return NextResponse.json(
      {
        ok: false,
        error: "Erro interno ao atualizar evento.",
      },
      { status: 500 },
    );
  }
}
