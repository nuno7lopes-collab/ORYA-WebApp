import "server-only";
import crypto from "crypto";
import {
  AgendaResourceClaimStatus,
  AgendaResourceClaimType,
  AvailabilityScopeType,
  EventStatus,
  Prisma,
  SourceType,
} from "@prisma/client";
import { evaluateCandidate, type AgendaCandidate } from "@/domain/agenda/conflictEngine";
import { mapSourceTypeToAgendaCandidateType } from "@/domain/agenda/arbitrationPolicy";
import { readEventResourceSelection, validateEventResourceSelection } from "@/lib/events/resources";

const ACTIVE_BOOKING_STATUSES = new Set(["CONFIRMED", "DISPUTED", "NO_SHOW"]);
const ACTIVE_PENDING_BOOKING_STATUSES = new Set(["PENDING_CONFIRMATION", "PENDING"]);

function parseBoolean(value: string | undefined): boolean | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

export function isEventConsumesResourcesEnabled() {
  const explicit = parseBoolean(process.env.FEATURE_EVENT_CONSUMES_RESOURCES);
  if (explicit != null) return explicit;
  return false;
}

export type EventResourceClaimConflict = {
  scopeType: AvailabilityScopeType;
  scopeId: number;
  resourceKey: string;
  reason: string;
  blockedByType?: string;
  blockedBySourceId?: string;
};

export class EventResourceClaimsError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type ClaimSpec = {
  scopeType: AvailabilityScopeType;
  scopeId: number;
  claimType: AgendaResourceClaimType;
  claimResourceId: string;
  resourceKey: string;
};

function buildResourceKey(params: {
  resourceType: AgendaResourceClaimType;
  authorityOrgId: number;
  resourceId: string;
}) {
  return `${params.resourceType}:${params.authorityOrgId}:${params.resourceId}`;
}

function isBookingActive(booking: {
  status: string;
  pendingExpiresAt: Date | null;
  startsAt: Date;
}, now: Date) {
  if (ACTIVE_BOOKING_STATUSES.has(booking.status)) return true;
  if (ACTIVE_PENDING_BOOKING_STATUSES.has(booking.status)) {
    if (booking.startsAt <= now) return false;
    return booking.pendingExpiresAt ? booking.pendingExpiresAt > now : false;
  }
  return false;
}

function buildClaimSpecs(params: {
  organizationId: number;
  resources: Array<{ id: number; courtId: number | null }>;
  professionals: Array<{ id: number }>;
}) {
  const { organizationId, resources, professionals } = params;
  const claims: ClaimSpec[] = [];

  for (const professional of professionals) {
    const claimType = AgendaResourceClaimType.PROFESSIONAL;
    const claimResourceId = String(professional.id);
    claims.push({
      scopeType: AvailabilityScopeType.PROFESSIONAL,
      scopeId: professional.id,
      claimType,
      claimResourceId,
      resourceKey: buildResourceKey({
        resourceType: claimType,
        authorityOrgId: organizationId,
        resourceId: claimResourceId,
      }),
    });
  }

  for (const resource of resources) {
    const isCourt = typeof resource.courtId === "number" && resource.courtId > 0;
    const claimType = isCourt ? AgendaResourceClaimType.COURT : AgendaResourceClaimType.ROOM;
    const claimResourceId = String(isCourt ? resource.courtId : resource.id);
    claims.push({
      scopeType: AvailabilityScopeType.RESOURCE,
      scopeId: resource.id,
      claimType,
      claimResourceId,
      resourceKey: buildResourceKey({
        resourceType: claimType,
        authorityOrgId: organizationId,
        resourceId: claimResourceId,
      }),
    });
  }

  return claims;
}

function mapClaimToCandidate(claim: {
  sourceType: SourceType;
  sourceId: string;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
}) {
  const mapped = mapSourceTypeToAgendaCandidateType(claim.sourceType);
  return {
    type: mapped ?? `UNSUPPORTED_${claim.sourceType}`,
    sourceId: `${claim.sourceType}:${claim.sourceId}`,
    startsAt: claim.startsAt,
    endsAt: claim.endsAt,
    createdAt: claim.createdAt,
  } satisfies AgendaCandidate;
}

export async function releaseEventResourceClaims(params: {
  tx: Prisma.TransactionClient;
  eventId: number;
}) {
  await params.tx.agendaResourceClaim.updateMany({
    where: {
      sourceType: SourceType.EVENT,
      sourceId: String(params.eventId),
      status: AgendaResourceClaimStatus.CLAIMED,
    },
    data: {
      status: AgendaResourceClaimStatus.RELEASED,
    },
  });
}

export async function syncEventResourceClaims(params: {
  tx: Prisma.TransactionClient;
  organizationId: number;
  eventId: number;
  startsAt: Date;
  endsAt: Date;
  status: EventStatus;
  consumesResources: boolean;
}) {
  const { tx, organizationId, eventId, startsAt, endsAt, status, consumesResources } = params;

  if (!isEventConsumesResourcesEnabled()) {
    return { ok: true as const, applied: false as const, reason: "FEATURE_DISABLED" as const };
  }

  if (!consumesResources || status !== EventStatus.PUBLISHED) {
    await releaseEventResourceClaims({ tx, eventId });
    return { ok: true as const, applied: false as const, reason: "NOT_PUBLISHED_OR_DISABLED" as const };
  }

  if (!(endsAt.getTime() > startsAt.getTime())) {
    throw new EventResourceClaimsError(400, "EVENT_INTERVAL_INVALID", "Intervalo inválido para bloqueio de recursos.");
  }

  const selection = await readEventResourceSelection({ tx, eventId });
  const validation = await validateEventResourceSelection({
    tx,
    organizationId,
    selection,
    requireNonEmpty: true,
  });
  if (!validation.ok) {
    throw new EventResourceClaimsError(400, validation.code, validation.message, validation.details);
  }

  const claimSpecs = buildClaimSpecs({
    organizationId,
    resources: validation.resources,
    professionals: validation.professionals,
  });

  const lockKeys = Array.from(new Set(claimSpecs.map((spec) => `event-consumes:${spec.resourceKey}`))).sort();
  for (const lockKey of lockKeys) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
  }

  const now = new Date();
  const professionalScopeIds = validation.professionals.map((professional) => professional.id);
  const resourceScopeIds = validation.resources.map((resource) => resource.id);
  const courtScopeIds = validation.resources
    .map((resource) => resource.courtId)
    .filter((courtId): courtId is number => typeof courtId === "number" && courtId > 0);

  const [existingClaims, overlappingBookings, overlappingClassSessions] = await Promise.all([
    tx.agendaResourceClaim.findMany({
      where: {
        resourceKey: { in: claimSpecs.map((spec) => spec.resourceKey) },
        status: AgendaResourceClaimStatus.CLAIMED,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        NOT: {
          sourceType: SourceType.EVENT,
          sourceId: String(eventId),
        },
      },
      select: {
        sourceType: true,
        sourceId: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
        resourceKey: true,
      },
    }),
    tx.booking.findMany({
      where: {
        organizationId,
        startsAt: { lt: endsAt },
        OR: [
          ...(professionalScopeIds.length > 0 ? [{ professionalId: { in: professionalScopeIds } }] : []),
          ...(resourceScopeIds.length > 0 ? [{ resourceId: { in: resourceScopeIds } }] : []),
          ...(courtScopeIds.length > 0 ? [{ courtId: { in: courtScopeIds } }] : []),
        ],
      },
      select: {
        id: true,
        status: true,
        startsAt: true,
        durationMinutes: true,
        pendingExpiresAt: true,
        updatedAt: true,
        professionalId: true,
        resourceId: true,
        courtId: true,
      },
    }),
    professionalScopeIds.length > 0
      ? tx.classSession.findMany({
          where: {
            organizationId,
            professionalId: { in: professionalScopeIds },
            status: "SCHEDULED",
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            professionalId: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const claimsByResourceKey = new Map<string, AgendaCandidate[]>();
  for (const claim of existingClaims) {
    const bucket = claimsByResourceKey.get(claim.resourceKey) ?? [];
    bucket.push(mapClaimToCandidate(claim));
    claimsByResourceKey.set(claim.resourceKey, bucket);
  }

  const bookingCandidatesByProfessional = new Map<number, AgendaCandidate[]>();
  const bookingCandidatesByResource = new Map<number, AgendaCandidate[]>();
  const bookingCandidatesByCourt = new Map<number, AgendaCandidate[]>();

  for (const booking of overlappingBookings) {
    if (!isBookingActive(booking, now)) continue;
    const bookingEndsAt = new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000);
    const candidate: AgendaCandidate = {
      type: "BOOKING",
      sourceId: `BOOKING:${booking.id}`,
      startsAt: booking.startsAt,
      endsAt: bookingEndsAt,
      confirmedAt: booking.updatedAt ?? booking.startsAt,
    };

    if (booking.professionalId) {
      const bucket = bookingCandidatesByProfessional.get(booking.professionalId) ?? [];
      bucket.push(candidate);
      bookingCandidatesByProfessional.set(booking.professionalId, bucket);
    }
    if (booking.resourceId) {
      const bucket = bookingCandidatesByResource.get(booking.resourceId) ?? [];
      bucket.push(candidate);
      bookingCandidatesByResource.set(booking.resourceId, bucket);
    }
    if (booking.courtId) {
      const bucket = bookingCandidatesByCourt.get(booking.courtId) ?? [];
      bucket.push(candidate);
      bookingCandidatesByCourt.set(booking.courtId, bucket);
    }
  }

  const classCandidatesByProfessional = new Map<number, AgendaCandidate[]>();
  for (const session of overlappingClassSessions) {
    if (!session.professionalId) continue;
    const candidate: AgendaCandidate = {
      type: "CLASS_SESSION",
      sourceId: `CLASS_SESSION:${session.id}`,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
    };
    const bucket = classCandidatesByProfessional.get(session.professionalId) ?? [];
    bucket.push(candidate);
    classCandidatesByProfessional.set(session.professionalId, bucket);
  }

  const conflicts: EventResourceClaimConflict[] = [];
  for (const claimSpec of claimSpecs) {
    const candidate: AgendaCandidate = {
      type: "MATCH",
      sourceId: `EVENT:${eventId}:${claimSpec.scopeType}:${claimSpec.scopeId}`,
      startsAt,
      endsAt,
      reasonCode: "EVENT_CONSUMES_RESOURCES",
    };

    const existing: AgendaCandidate[] = [
      ...(claimsByResourceKey.get(claimSpec.resourceKey) ?? []),
      ...(claimSpec.scopeType === AvailabilityScopeType.PROFESSIONAL
        ? bookingCandidatesByProfessional.get(claimSpec.scopeId) ?? []
        : bookingCandidatesByResource.get(claimSpec.scopeId) ?? []),
      ...(claimSpec.scopeType === AvailabilityScopeType.PROFESSIONAL
        ? classCandidatesByProfessional.get(claimSpec.scopeId) ?? []
        : []),
      ...(claimSpec.claimType === AgendaResourceClaimType.COURT
        ? bookingCandidatesByCourt.get(Number(claimSpec.claimResourceId)) ?? []
        : []),
    ];

    const decision = evaluateCandidate({ candidate, existing });
    const hasConflict =
      !decision.allowed ||
      (decision.reason === "OVERRIDES_LOWER_PRIORITY" && decision.conflicts.length > 0);
    if (!hasConflict) continue;

    const primary = decision.conflicts[0];
    conflicts.push({
      scopeType: claimSpec.scopeType,
      scopeId: claimSpec.scopeId,
      resourceKey: claimSpec.resourceKey,
      reason: decision.reason,
      blockedByType: decision.blockedBy ?? primary?.withType,
      blockedBySourceId: primary?.withSourceId,
    });
  }

  if (conflicts.length > 0) {
    throw new EventResourceClaimsError(
      409,
      "EVENT_RESOURCES_CONFLICT",
      "Conflito de agenda para os recursos selecionados.",
      { conflicts },
    );
  }

  await releaseEventResourceClaims({ tx, eventId });

  const bundleId = crypto.randomUUID();
  await tx.agendaResourceClaim.createMany({
    data: claimSpecs.map((spec) => ({
      bundleId,
      organizationId,
      authorityOrgId: organizationId,
      eventId,
      sourceType: SourceType.EVENT,
      sourceId: String(eventId),
      resourceType: spec.claimType,
      resourceId: spec.claimResourceId,
      resourceKey: spec.resourceKey,
      startsAt,
      endsAt,
      status: AgendaResourceClaimStatus.CLAIMED,
      metadata: {
        reasonCode: "EVENT_CONSUMES_RESOURCES",
        scopeType: spec.scopeType,
        scopeId: spec.scopeId,
        feature: "FEATURE_EVENT_CONSUMES_RESOURCES",
      },
    })),
    skipDuplicates: false,
  });

  return {
    ok: true as const,
    applied: true as const,
    claimsCreated: claimSpecs.length,
    bundleId,
  };
}
