import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { toPublicEventCardWithPrice, isPublicEventCardComplete } from "@/domain/events/publicEventCard";
import { PUBLIC_EVENT_STATUSES } from "@/domain/events/publicStatus";
import { getPublicDiscoverBySlug } from "@/domain/search/publicDiscover";
import { resolveEventAccessPolicyInput } from "@/lib/events/accessPolicy";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { checkPadelRegistrationWindow } from "@/domain/padelRegistration";
import { buildPadelEventSnapshot } from "@/lib/padel/eventSnapshot";
import { EventAccessMode } from "@prisma/client";

type Params = { slug: string };

async function _GET(req: NextRequest, context: { params: Params | Promise<Params> }) {
  const { slug } = await context.params;

  if (!slug) {
    return jsonWrap({ errorCode: "BAD_REQUEST", message: "Slug inválido." }, { status: 400 });
  }

  const event = await prisma.event.findFirst({
    where: {
      slug,
      status: { in: PUBLIC_EVENT_STATUSES },
      isDeleted: false,
      organization: { status: "ACTIVE" },
    },
    include: {
      organization: { select: { publicName: true, businessName: true, username: true } },
      addressRef: {
        select: {
          formattedAddress: true,
          canonical: true,
          latitude: true,
          longitude: true,
        },
      },
      ticketTypes: {
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          currency: true,
          status: true,
          startsAt: true,
          endsAt: true,
          totalQuantity: true,
          soldQuantity: true,
          sortOrder: true,
          padelEventCategoryLinkId: true,
          padelEventCategoryLink: {
            select: {
              id: true,
              category: { select: { label: true } },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      accessPolicies: {
        orderBy: { policyVersion: "desc" },
        take: 1,
      },
      padelTournamentConfig: {
        select: {
          padelV2Enabled: true,
          defaultCategoryId: true,
          advancedSettings: true,
          lifecycleStatus: true,
        },
      },
      padelCategoryLinks: {
        select: {
          id: true,
          padelCategoryId: true,
          pricePerPlayerCents: true,
          currency: true,
          capacityTeams: true,
          capacityPlayers: true,
          format: true,
          isEnabled: true,
          isHidden: true,
          category: { select: { label: true } },
        },
        orderBy: { pricePerPlayerCents: "asc" },
      },
      tournament: {
        select: { id: true, format: true },
      },
    },
  });

  if (!event) {
    const indexed = await getPublicDiscoverBySlug(slug);
    if (!indexed) {
      return jsonWrap({ errorCode: "NOT_FOUND", message: "Evento não encontrado." }, { status: 404 });
    }
    return jsonWrap({ item: indexed });
  }

  const ownerProfile = await prisma.profile.findUnique({
    where: { id: event.ownerUserId },
    select: { fullName: true, username: true },
  });

  const card = toPublicEventCardWithPrice({
    event,
    ownerProfile,
  });

  const { _priceFromCents, ...item } = card;
  if (!isPublicEventCardComplete(item)) {
    return jsonWrap({ errorCode: "NOT_FOUND", message: "Evento não encontrado." }, { status: 404 });
  }

  const latestPolicy = event.accessPolicies?.[0] ?? null;
  const resolvedPolicy = resolveEventAccessPolicyInput({
    accessPolicy: latestPolicy ?? null,
    templateType: event.templateType ?? null,
    defaultMode: EventAccessMode.UNLISTED,
  });
  const accessPolicy = {
    ...resolvedPolicy.policyInput,
    ...(latestPolicy?.policyVersion ? { policyVersion: latestPolicy.policyVersion } : {}),
  };

  const isPadelTemplate =
    typeof event.templateType === "string" && event.templateType.toUpperCase() === "PADEL";
  const padelConfig = event.padelTournamentConfig ?? null;
  const padelAdvanced = (padelConfig?.advancedSettings || {}) as {
    registrationStartsAt?: string | null;
    registrationEndsAt?: string | null;
    competitionState?: string | null;
  };
  const registrationStartsAt =
    padelAdvanced.registrationStartsAt && !Number.isNaN(new Date(padelAdvanced.registrationStartsAt).getTime())
      ? new Date(padelAdvanced.registrationStartsAt)
      : null;
  const registrationEndsAt =
    padelAdvanced.registrationEndsAt && !Number.isNaN(new Date(padelAdvanced.registrationEndsAt).getTime())
      ? new Date(padelAdvanced.registrationEndsAt)
      : null;
  const competitionState = isPadelTemplate
    ? resolvePadelCompetitionState({
        eventStatus: event.status,
        competitionState: padelAdvanced.competitionState ?? null,
        lifecycleStatus: padelConfig?.lifecycleStatus ?? null,
      })
    : null;
  const registrationCheck = isPadelTemplate
    ? checkPadelRegistrationWindow({
        eventStatus: event.status,
        eventStartsAt: event.startsAt ?? null,
        registrationStartsAt,
        registrationEndsAt,
        competitionState: padelAdvanced.competitionState ?? null,
        lifecycleStatus: padelConfig?.lifecycleStatus ?? null,
      })
    : null;

  const registrationStatus = registrationCheck
    ? registrationCheck.ok
      ? "OPEN"
      : registrationCheck.code === "INSCRIPTIONS_NOT_OPEN"
        ? "NOT_OPEN"
        : registrationCheck.code === "INSCRIPTIONS_CLOSED"
          ? "CLOSED"
          : registrationCheck.code === "TOURNAMENT_STARTED"
            ? "STARTED"
            : registrationCheck.code === "EVENT_NOT_PUBLISHED"
              ? "UNPUBLISHED"
              : "UNAVAILABLE"
    : null;

  const registrationMessage = registrationCheck
    ? registrationCheck.ok
      ? "Inscrições abertas."
      : registrationCheck.code === "INSCRIPTIONS_NOT_OPEN"
        ? "Inscrições ainda não abriram."
        : registrationCheck.code === "INSCRIPTIONS_CLOSED"
          ? "Inscrições encerradas."
          : registrationCheck.code === "TOURNAMENT_STARTED"
            ? "O torneio já começou. Inscrições encerradas."
            : registrationCheck.code === "EVENT_NOT_PUBLISHED"
              ? "O torneio ainda não está publicado."
              : "Inscrições indisponíveis."
    : null;

  const padelCategories = isPadelTemplate
    ? event.padelCategoryLinks.map((link) => ({
        id: link.padelCategoryId,
        linkId: link.id,
        label: link.category?.label ?? null,
        pricePerPlayerCents: link.pricePerPlayerCents ?? 0,
        currency: link.currency ?? "EUR",
        capacityTeams: link.capacityTeams ?? null,
        capacityPlayers: link.capacityPlayers ?? null,
        format: link.format ?? null,
        isEnabled: link.isEnabled ?? true,
        isHidden: link.isHidden ?? false,
      }))
    : [];

  const defaultCategoryId =
    padelConfig?.defaultCategoryId ??
    padelCategories.find((link) => link.isEnabled && !link.isHidden)?.id ??
    null;

  const padelSnapshot = isPadelTemplate ? await buildPadelEventSnapshot(event.id) : null;

  const extendedItem = {
    ...item,
    templateType: event.templateType ?? null,
    accessPolicy,
    tournament: event.tournament
      ? { id: event.tournament.id, format: event.tournament.format ?? null }
      : null,
    padel: isPadelTemplate
      ? {
          v2Enabled: Boolean(padelConfig?.padelV2Enabled),
          competitionState,
          registrationStartsAt: registrationStartsAt?.toISOString() ?? null,
          registrationEndsAt: registrationEndsAt?.toISOString() ?? null,
          registrationStatus,
          registrationMessage,
          defaultCategoryId,
          categories: padelCategories,
          snapshot: padelSnapshot,
        }
      : null,
  };

  return jsonWrap({ item: extendedItem });
}

export const GET = withApiEnvelope(_GET);
