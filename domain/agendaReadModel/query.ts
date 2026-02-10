import { prisma } from "@/lib/prisma";
import { SourceType } from "@prisma/client";
import { buildAgendaOverlapFilter } from "@/domain/agendaReadModel/overlap";

export type AgendaItem = {
  kind: "EVENT" | "TOURNAMENT" | "RESERVATION" | "SOFT_BLOCK";
  eventId?: number | null;
  tournamentId?: number | null;
  reservationId?: number | null;
  softBlockId?: number | null;
  padelClubId?: number | null;
  courtId?: number | null;
  resourceId?: number | null;
  professionalId?: number | null;
  title: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
};

export async function getAgendaItemsForOrganization(params: {
  organizationId: number;
  from: Date;
  to: Date;
  padelClubId?: number | null;
  courtId?: number | null;
  scopeFilter?: {
    courtIds?: number[];
    resourceIds?: number[];
    professionalIds?: number[];
  } | null;
  scopeMode?: "OR" | "AND";
}) {
  const { organizationId, from, to, padelClubId = null, courtId = null, scopeFilter = null, scopeMode = "OR" } = params;
  const rangeFilter = buildAgendaOverlapFilter({ from, to });
  const scopeOr: Array<Record<string, unknown>> = [];
  const courtIds = scopeFilter?.courtIds ?? [];
  const resourceIds = scopeFilter?.resourceIds ?? [];
  const professionalIds = scopeFilter?.professionalIds ?? [];
  if (courtIds.length > 0) scopeOr.push({ courtId: { in: courtIds } });
  if (resourceIds.length > 0) scopeOr.push({ resourceId: { in: resourceIds } });
  if (professionalIds.length > 0) scopeOr.push({ professionalId: { in: professionalIds } });
  const scopeAnd: Record<string, unknown> = {
    ...(courtIds.length > 0 ? { courtId: { in: courtIds } } : {}),
    ...(resourceIds.length > 0 ? { resourceId: { in: resourceIds } } : {}),
    ...(professionalIds.length > 0 ? { professionalId: { in: professionalIds } } : {}),
  };

  const items = await prisma.agendaItem.findMany({
    where: {
      organizationId,
      ...rangeFilter,
      ...(padelClubId ? { padelClubId } : {}),
      ...(courtId ? { courtId } : {}),
      ...(scopeMode === "AND"
        ? Object.keys(scopeAnd).length > 0
          ? scopeAnd
          : {}
        : scopeOr.length > 0
          ? { OR: scopeOr }
          : {}),
      sourceType: {
        in: [SourceType.EVENT, SourceType.TOURNAMENT, SourceType.BOOKING, SourceType.SOFT_BLOCK, SourceType.CLASS_SESSION],
      },
      status: { not: "DELETED" },
    },
    select: {
      title: true,
      startsAt: true,
      endsAt: true,
      sourceType: true,
      sourceId: true,
      status: true,
      padelClubId: true,
      courtId: true,
      resourceId: true,
      professionalId: true,
    },
    orderBy: { startsAt: "asc" },
  });

  return items.map((item) => {
    const base = {
      title: item.title,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      status: item.status,
      padelClubId: item.padelClubId ?? null,
      courtId: item.courtId ?? null,
      resourceId: item.resourceId ?? null,
      professionalId: item.professionalId ?? null,
    };
    if (item.sourceType === SourceType.TOURNAMENT) {
      return {
        ...base,
        kind: "TOURNAMENT",
        tournamentId: Number(item.sourceId),
      } satisfies AgendaItem;
    }
    if (item.sourceType === SourceType.BOOKING) {
      return {
        ...base,
        kind: "RESERVATION",
        reservationId: Number(item.sourceId),
      } satisfies AgendaItem;
    }
    if (item.sourceType === SourceType.SOFT_BLOCK) {
      return {
        ...base,
        kind: "SOFT_BLOCK",
        softBlockId: Number(item.sourceId),
      } satisfies AgendaItem;
    }
    if (item.sourceType === SourceType.CLASS_SESSION) {
      return {
        ...base,
        kind: "RESERVATION",
        reservationId: null,
      } satisfies AgendaItem;
    }
    return {
      ...base,
      kind: "EVENT",
      eventId: Number(item.sourceId),
    } satisfies AgendaItem;
  });
}
