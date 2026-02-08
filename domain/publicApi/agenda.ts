import { prisma } from "@/lib/prisma";
import { SourceType } from "@prisma/client";
import { buildAgendaOverlapFilter } from "@/domain/agendaReadModel/overlap";

export async function listPublicAgenda(params: {
  organizationId: number;
  from?: Date | null;
  to?: Date | null;
  limit?: number;
  cursorId?: string | null;
  sourceTypes?: SourceType[];
  padelClubId?: number | null;
  courtId?: number | null;
}) {
  const { organizationId, from, to, limit = 200, cursorId, sourceTypes, padelClubId, courtId } = params;
  const rangeFilter = buildAgendaOverlapFilter({ from, to });
  return prisma.agendaItem.findMany({
    where: {
      organizationId,
      sourceType: sourceTypes?.length ? { in: sourceTypes } : undefined,
      ...rangeFilter,
      ...(padelClubId ? { padelClubId } : {}),
      ...(courtId ? { courtId } : {}),
      status: { not: "DELETED" },
    },
    orderBy: { startsAt: "asc" },
    take: Math.min(limit, 500),
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    select: {
      id: true,
      organizationId: true,
      sourceType: true,
      sourceId: true,
      title: true,
      startsAt: true,
      endsAt: true,
      status: true,
      lastEventId: true,
      updatedAt: true,
      padelClubId: true,
      courtId: true,
    },
  });
}
