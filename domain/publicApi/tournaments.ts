import { prisma } from "@/lib/prisma";
import { PUBLIC_EVENT_DISCOVER_STATUSES } from "@/domain/events/publicStatus";

export async function listPublicTournaments(params: {
  organizationId: number;
  from?: Date | null;
  to?: Date | null;
  limit?: number;
  cursorId?: number | null;
}) {
  const { organizationId, from, to, limit = 50, cursorId } = params;
  return prisma.tournament.findMany({
    where: {
      event: {
        organizationId,
        status: { in: PUBLIC_EVENT_DISCOVER_STATUSES },
        isDeleted: false,
        startsAt: from ? { gte: from } : undefined,
        endsAt: to ? { lte: to } : undefined,
      },
    },
    orderBy: { event: { startsAt: "asc" } },
    take: Math.min(limit, 200),
    ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    select: {
      id: true,
      format: true,
      event: {
        select: {
          id: true,
          slug: true,
          title: true,
          startsAt: true,
          endsAt: true,
          addressId: true,
          addressRef: { select: { formattedAddress: true, canonical: true } },
          coverImageUrl: true,
          organization: { select: { id: true, publicName: true, username: true } },
        },
      },
    },
  });
}
