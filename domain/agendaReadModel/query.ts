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
}) {
  const { organizationId, from, to, padelClubId = null, courtId = null } = params;
  const rangeFilter = buildAgendaOverlapFilter({ from, to });

  const items = await prisma.agendaItem.findMany({
    where: {
      organizationId,
      ...rangeFilter,
      ...(padelClubId ? { padelClubId } : {}),
      ...(courtId ? { courtId } : {}),
      sourceType: { in: [SourceType.EVENT, SourceType.TOURNAMENT, SourceType.BOOKING, SourceType.SOFT_BLOCK] },
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
    return {
      ...base,
      kind: "EVENT",
      eventId: Number(item.sourceId),
    } satisfies AgendaItem;
  });
}
