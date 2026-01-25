import { prisma } from "@/lib/prisma";
import { SourceType } from "@prisma/client";

export async function listPublicAgenda(params: {
  organizationId: number;
  from?: Date | null;
  to?: Date | null;
  limit?: number;
  cursorId?: string | null;
  sourceTypes?: SourceType[];
}) {
  const { organizationId, from, to, limit = 200, cursorId, sourceTypes } = params;
  return prisma.agendaItem.findMany({
    where: {
      organizationId,
      sourceType: sourceTypes?.length ? { in: sourceTypes } : undefined,
      startsAt: from ? { gte: from } : undefined,
      endsAt: to ? { lte: to } : undefined,
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
    },
  });
}
