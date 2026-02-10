import { prisma } from "@/lib/prisma";
import { SearchIndexVisibility, SourceType } from "@prisma/client";
import { PUBLIC_EVENT_DISCOVER_STATUSES } from "@/domain/events/publicStatus";

type SearchIndexLike = {
  id: string;
  sourceId: string;
  sourceType?: SourceType | null;
};

const coerceEventId = (value: string): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return rounded > 0 ? rounded : null;
};

export async function filterOrphanedEventSearchItems<T extends SearchIndexLike>(
  items: T[],
  opts?: { prune?: boolean },
): Promise<T[]> {
  if (!items.length) return items;

  const eventItems = items.filter(
    (item) => !item.sourceType || item.sourceType === SourceType.EVENT,
  );
  if (!eventItems.length) return items;

  const eventIds = Array.from(
    new Set(
      eventItems
        .map((item) => coerceEventId(item.sourceId))
        .filter((id): id is number => id !== null),
    ),
  );

  if (!eventIds.length) {
    if (opts?.prune) {
      const orphanIds = eventItems.map((item) => item.id);
      if (orphanIds.length) {
        await prisma.searchIndexItem.updateMany({
          where: { id: { in: orphanIds } },
          data: { visibility: SearchIndexVisibility.HIDDEN },
        });
      }
    }
    return items.filter((item) => item.sourceType && item.sourceType !== SourceType.EVENT);
  }

  const existing = await prisma.event.findMany({
    where: {
      id: { in: eventIds },
      isDeleted: false,
      status: { in: PUBLIC_EVENT_DISCOVER_STATUSES },
      organization: { status: "ACTIVE" },
    },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((row) => row.id));

  const valid = items.filter((item) => {
    if (item.sourceType && item.sourceType !== SourceType.EVENT) return true;
    const eventId = coerceEventId(item.sourceId);
    return eventId !== null && existingIds.has(eventId);
  });

  if (opts?.prune) {
    const orphanIds = eventItems
      .filter((item) => {
        const eventId = coerceEventId(item.sourceId);
        return eventId === null || !existingIds.has(eventId);
      })
      .map((item) => item.id);
    if (orphanIds.length) {
      await prisma.searchIndexItem.updateMany({
        where: { id: { in: orphanIds } },
        data: { visibility: SearchIndexVisibility.HIDDEN },
      });
    }
  }

  return valid;
}
