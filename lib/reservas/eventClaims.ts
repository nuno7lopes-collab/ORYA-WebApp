import type { Prisma } from "@prisma/client";
import { AgendaResourceClaimStatus, AgendaResourceClaimType, SourceType } from "@prisma/client";
import type { AgendaCandidate } from "@/domain/agenda/conflictEngine";

export type EventClaimBlock = {
  sourceId: string;
  startsAt: Date;
  endsAt: Date;
  professionalId: number | null;
  resourceId: number | null;
  courtId: number | null;
};

function buildResourceKey(params: {
  resourceType: AgendaResourceClaimType;
  organizationId: number;
  resourceId: string;
}) {
  return `${params.resourceType}:${params.organizationId}:${params.resourceId}`;
}

export async function loadActiveEventClaimBlocks(params: {
  tx: { agendaResourceClaim: Prisma.TransactionClient["agendaResourceClaim"] };
  organizationId: number;
  rangeStart: Date;
  rangeEnd: Date;
  professionalIds?: number[];
  resourceIds?: number[];
  courtIds?: number[];
}) {
  const professionalIds = Array.from(new Set(params.professionalIds ?? [])).filter((id) => id > 0);
  const resourceIds = Array.from(new Set(params.resourceIds ?? [])).filter((id) => id > 0);
  const courtIds = Array.from(new Set(params.courtIds ?? [])).filter((id) => id > 0);

  const resourceKeys = [
    ...professionalIds.map((id) =>
      buildResourceKey({
        resourceType: AgendaResourceClaimType.PROFESSIONAL,
        organizationId: params.organizationId,
        resourceId: String(id),
      }),
    ),
    ...resourceIds.map((id) =>
      buildResourceKey({
        resourceType: AgendaResourceClaimType.ROOM,
        organizationId: params.organizationId,
        resourceId: String(id),
      }),
    ),
    ...courtIds.map((id) =>
      buildResourceKey({
        resourceType: AgendaResourceClaimType.COURT,
        organizationId: params.organizationId,
        resourceId: String(id),
      }),
    ),
  ];

  if (resourceKeys.length === 0) return [] as EventClaimBlock[];

  const rows = await params.tx.agendaResourceClaim.findMany({
    where: {
      organizationId: params.organizationId,
      sourceType: SourceType.EVENT,
      status: AgendaResourceClaimStatus.CLAIMED,
      startsAt: { lt: params.rangeEnd },
      endsAt: { gt: params.rangeStart },
      resourceKey: { in: resourceKeys },
    },
    select: {
      sourceId: true,
      startsAt: true,
      endsAt: true,
      resourceType: true,
      resourceId: true,
    },
  });

  return rows.map((row) => {
    const parsedId = Number(row.resourceId);
    const numericId = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
    return {
      sourceId: row.sourceId,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      professionalId:
        row.resourceType === AgendaResourceClaimType.PROFESSIONAL && numericId != null ? numericId : null,
      resourceId: row.resourceType === AgendaResourceClaimType.ROOM && numericId != null ? numericId : null,
      courtId: row.resourceType === AgendaResourceClaimType.COURT && numericId != null ? numericId : null,
    } satisfies EventClaimBlock;
  });
}

export function buildEventClaimConflictBlocks(params: {
  claims: EventClaimBlock[];
  courtToResourceIds?: Map<number, number[]>;
}) {
  const blocks: Array<{ start: Date; end: Date; professionalId: number | null; resourceId: number | null }> = [];
  for (const claim of params.claims) {
    if (claim.professionalId) {
      blocks.push({
        start: claim.startsAt,
        end: claim.endsAt,
        professionalId: claim.professionalId,
        resourceId: null,
      });
      continue;
    }
    if (claim.resourceId) {
      blocks.push({
        start: claim.startsAt,
        end: claim.endsAt,
        professionalId: null,
        resourceId: claim.resourceId,
      });
      continue;
    }
    if (claim.courtId && params.courtToResourceIds) {
      const mappedResourceIds = params.courtToResourceIds.get(claim.courtId) ?? [];
      for (const mappedResourceId of mappedResourceIds) {
        blocks.push({
          start: claim.startsAt,
          end: claim.endsAt,
          professionalId: null,
          resourceId: mappedResourceId,
        });
      }
    }
  }
  return blocks;
}

function toAgendaCandidate(claim: EventClaimBlock): AgendaCandidate {
  return {
    type: "MATCH",
    sourceId: `EVENT:${claim.sourceId}:${claim.startsAt.toISOString()}`,
    startsAt: claim.startsAt,
    endsAt: claim.endsAt,
    reasonCode: "EVENT_CONSUMES_RESOURCES",
  };
}

export function buildEventClaimCandidatesForProfessional(params: {
  claims: EventClaimBlock[];
  professionalId: number | null;
}) {
  if (!params.professionalId) return [] as AgendaCandidate[];
  return params.claims
    .filter((claim) => claim.professionalId === params.professionalId)
    .map((claim) => toAgendaCandidate(claim));
}

export function buildEventClaimCandidatesForResource(params: {
  claims: EventClaimBlock[];
  resourceId: number | null;
  courtId?: number | null;
}) {
  if (!params.resourceId && !params.courtId) return [] as AgendaCandidate[];
  return params.claims
    .filter(
      (claim) =>
        (params.resourceId != null && claim.resourceId === params.resourceId) ||
        (params.courtId != null && claim.courtId === params.courtId),
    )
    .map((claim) => toAgendaCandidate(claim));
}
