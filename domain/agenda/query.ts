import { prisma } from "@/lib/prisma";
import { SourceType } from "@prisma/client";

export type AgendaItem = {
  kind: "EVENT" | "TOURNAMENT" | "RESERVATION";
  eventId?: number | null;
  tournamentId?: number | null;
  reservationId?: number | null;
  title: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
};

export async function getAgendaItemsForOrganization(params: {
  organizationId: number;
  from: Date;
  to: Date;
}) {
  const { organizationId, from, to } = params;

  const items = await prisma.agendaItem.findMany({
    where: {
      organizationId,
      startsAt: { lte: to },
      endsAt: { gte: from },
    },
    select: {
      title: true,
      startsAt: true,
      endsAt: true,
      sourceType: true,
      sourceId: true,
      status: true,
    },
    orderBy: { startsAt: "asc" },
  });

  return items.map((item) => {
    const base = {
      title: item.title,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      status: item.status,
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
    return {
      ...base,
      kind: "EVENT",
      eventId: Number(item.sourceId),
    } satisfies AgendaItem;
  });
}
