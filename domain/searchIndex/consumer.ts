import { prisma } from "@/lib/prisma";
import { SearchIndexVisibility, SourceType } from "@prisma/client";
import { deriveIsFreeEvent } from "@/domain/events/derivedIsFree";
import { normalizeSourceType } from "@/domain/sourceType";

const ALLOWLIST = new Set([
  "event.created",
  "event.updated",
  "event.cancelled",
  "organization.status.updated",
]);

type SearchIndexConsumeResult =
  | { ok: true; deduped?: boolean; stale?: boolean }
  | { ok: false; code: string };

function resolveVisibility(input: {
  status: string;
  isDeleted: boolean;
  orgStatus: string | null;
  orgId: number | null;
}): SearchIndexVisibility {
  const isPublicStatus = input.status === "PUBLISHED" || input.status === "DATE_CHANGED";
  if (!input.orgId) return SearchIndexVisibility.HIDDEN;
  if (!isPublicStatus) return SearchIndexVisibility.HIDDEN;
  if (input.isDeleted) return SearchIndexVisibility.HIDDEN;
  if (input.orgStatus !== "ACTIVE") return SearchIndexVisibility.HIDDEN;
  return SearchIndexVisibility.PUBLIC;
}

async function upsertFromEvent(params: {
  eventId: number;
  eventLogId: string;
  eventLogCreatedAt: Date;
}): Promise<SearchIndexConsumeResult> {
  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      status: true,
      templateType: true,
      pricingMode: true,
      isDeleted: true,
      coverImageUrl: true,
      locationName: true,
      locationCity: true,
      address: true,
      locationFormattedAddress: true,
      latitude: true,
      longitude: true,
      locationSource: true,
      ownerUserId: true,
      organizationId: true,
      organization: { select: { status: true, publicName: true } },
      ticketTypes: { select: { price: true } },
    },
  });

  if (!event) return { ok: false, code: "EVENT_NOT_FOUND" };
  if (!event.organizationId) return { ok: false, code: "EVENT_ORG_MISSING" };

  const ownerProfile = event.ownerUserId
    ? await prisma.profile.findUnique({
        where: { id: event.ownerUserId },
        select: { fullName: true, username: true },
      })
    : null;

  const ticketPrices = event.ticketTypes
    .map((t) => (typeof t.price === "number" ? t.price : null))
    .filter((price): price is number => price !== null);
  const isGratis = deriveIsFreeEvent({ pricingMode: event.pricingMode, ticketPrices });
  const priceFromCents = isGratis ? 0 : ticketPrices.length > 0 ? Math.min(...ticketPrices) : null;

  const visibility = resolveVisibility({
    status: event.status,
    isDeleted: event.isDeleted,
    orgStatus: event.organization?.status ?? null,
    orgId: event.organizationId,
  });

  const existing = await prisma.searchIndexItem.findUnique({
    where: {
      organizationId_sourceType_sourceId: {
        organizationId: event.organizationId,
        sourceType: SourceType.EVENT,
        sourceId: String(event.id),
      },
    },
    select: { lastEventId: true, updatedAt: true },
  });

  if (existing?.lastEventId === params.eventLogId) return { ok: true, deduped: true };
  if (existing && params.eventLogCreatedAt.getTime() <= existing.updatedAt.getTime()) {
    return { ok: true, stale: true };
  }

  await prisma.searchIndexItem.upsert({
    where: {
      organizationId_sourceType_sourceId: {
        organizationId: event.organizationId,
        sourceType: SourceType.EVENT,
        sourceId: String(event.id),
      },
    },
    update: {
      slug: event.slug,
      title: event.title,
      description: event.description,
      startsAt: event.startsAt,
      endsAt: event.endsAt ?? event.startsAt,
      templateType: event.templateType,
      pricingMode: event.pricingMode,
      isGratis,
      priceFromCents,
      coverImageUrl: event.coverImageUrl,
      hostName: event.organization?.publicName ?? ownerProfile?.fullName ?? null,
      hostUsername: ownerProfile?.username ?? null,
      locationName: event.locationName,
      locationCity: event.locationCity,
      address: event.address,
      locationFormattedAddress: event.locationFormattedAddress,
      latitude: event.latitude,
      longitude: event.longitude,
      locationSource: event.locationSource,
      status: event.status,
      visibility,
      lastEventId: params.eventLogId,
      updatedAt: params.eventLogCreatedAt,
    },
    create: {
      organizationId: event.organizationId,
      sourceType: SourceType.EVENT,
      sourceId: String(event.id),
      slug: event.slug,
      title: event.title,
      description: event.description,
      startsAt: event.startsAt,
      endsAt: event.endsAt ?? event.startsAt,
      templateType: event.templateType,
      pricingMode: event.pricingMode,
      isGratis,
      priceFromCents,
      coverImageUrl: event.coverImageUrl,
      hostName: event.organization?.publicName ?? ownerProfile?.fullName ?? null,
      hostUsername: ownerProfile?.username ?? null,
      locationName: event.locationName,
      locationCity: event.locationCity,
      address: event.address,
      locationFormattedAddress: event.locationFormattedAddress,
      latitude: event.latitude,
      longitude: event.longitude,
      locationSource: event.locationSource,
      status: event.status,
      visibility,
      lastEventId: params.eventLogId,
      updatedAt: params.eventLogCreatedAt,
    },
  });

  return { ok: true };
}

async function handleOrgStatusUpdate(params: {
  organizationId: number;
  eventLogId: string;
  eventLogCreatedAt: Date;
}): Promise<SearchIndexConsumeResult> {
  const organization = await prisma.organization.findUnique({
    where: { id: params.organizationId },
    select: { id: true, status: true },
  });
  if (!organization) return { ok: false, code: "ORG_NOT_FOUND" };

  if (organization.status !== "ACTIVE") {
    await prisma.searchIndexItem.updateMany({
      where: { organizationId: organization.id },
      data: {
        visibility: SearchIndexVisibility.HIDDEN,
        lastEventId: params.eventLogId,
        updatedAt: params.eventLogCreatedAt,
      },
    });
    return { ok: true };
  }

  const events = await prisma.event.findMany({
    where: { organizationId: organization.id },
    select: { id: true },
  });

  for (const event of events) {
    await upsertFromEvent({
      eventId: event.id,
      eventLogId: params.eventLogId,
      eventLogCreatedAt: params.eventLogCreatedAt,
    });
  }

  return { ok: true };
}

export async function consumeSearchIndexEvent(eventLogId: string): Promise<SearchIndexConsumeResult> {
  const log = await prisma.eventLog.findUnique({ where: { id: eventLogId } });
  if (!log) return { ok: false, code: "EVENTLOG_NOT_FOUND" };
  if (!ALLOWLIST.has(log.eventType)) return { ok: true, deduped: true };

  if (log.eventType === "organization.status.updated") {
    const payload = (log.payload ?? {}) as Record<string, unknown>;
    const orgId =
      typeof payload.organizationId === "number"
        ? payload.organizationId
        : typeof payload.organizationId === "string"
          ? Number(payload.organizationId)
          : null;
    if (!orgId || !Number.isFinite(orgId)) return { ok: false, code: "ORG_ID_INVALID" };
    return handleOrgStatusUpdate({
      organizationId: orgId,
      eventLogId: log.id,
      eventLogCreatedAt: log.createdAt,
    });
  }

  const payload = (log.payload ?? {}) as Record<string, unknown>;
  const sourceType =
    normalizeSourceType(payload.sourceType as string | null) ?? log.sourceType ?? SourceType.EVENT;
  if (sourceType !== SourceType.EVENT) return { ok: true, deduped: true };

  const sourceId =
    typeof payload.sourceId === "string"
      ? payload.sourceId
      : typeof payload.eventId === "number" || typeof payload.eventId === "string"
        ? String(payload.eventId)
        : log.sourceId ?? null;

  if (!sourceId) return { ok: false, code: "SOURCE_ID_MISSING" };
  const eventId = Number(sourceId);
  if (!Number.isFinite(eventId)) return { ok: false, code: "EVENT_ID_INVALID" };

  return upsertFromEvent({
    eventId,
    eventLogId: log.id,
    eventLogCreatedAt: log.createdAt,
  });
}

export async function handleSearchIndexOutboxEvent(params: {
  eventType: string;
  payload: Record<string, unknown>;
}): Promise<SearchIndexConsumeResult> {
  if (params.eventType === "search.index.upsert.requested") {
    const eventLogId = typeof params.payload.eventId === "string" ? params.payload.eventId : null;
    if (!eventLogId) return { ok: false, code: "SEARCH_INDEX_EVENT_ID_MISSING" };
    return consumeSearchIndexEvent(eventLogId);
  }
  if (params.eventType === "search.index.org_status_changed") {
    const eventLogId = typeof params.payload.eventId === "string" ? params.payload.eventId : null;
    if (!eventLogId) return { ok: false, code: "SEARCH_INDEX_EVENT_ID_MISSING" };
    return consumeSearchIndexEvent(eventLogId);
  }
  return { ok: true, deduped: true };
}

export const SEARCH_INDEX_EVENT_TYPES = Array.from(ALLOWLIST);
