import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const BATCH_SIZE = 64;

const uniquePositiveIds = (eventIds: number[]) =>
  Array.from(
    new Set(
      eventIds.filter((value) => Number.isFinite(value) && Number.isInteger(value) && value > 0),
    ),
  );

async function ensureEventThreadBatch(eventIds: number[]) {
  if (!eventIds.length) return;
  await prisma.$executeRaw(
    Prisma.sql`
      SELECT app_v3.chat_ensure_event_thread(v.event_id)
      FROM (
        VALUES ${Prisma.join(eventIds.map((eventId) => Prisma.sql`(${eventId})`))}
      ) AS v(event_id)
    `,
  );
}

export async function ensureEventThreads(eventIds: number[]) {
  const uniqueIds = uniquePositiveIds(eventIds);
  if (!uniqueIds.length) return;

  const existing = await prisma.chatThread.findMany({
    where: {
      entityType: "EVENT",
      entityId: { in: uniqueIds },
    },
    select: { entityId: true },
  });
  const existingSet = new Set(existing.map((row) => row.entityId));
  const missing = uniqueIds.filter((eventId) => !existingSet.has(eventId));
  if (!missing.length) return;

  for (let index = 0; index < missing.length; index += BATCH_SIZE) {
    const batch = missing.slice(index, index + BATCH_SIZE);
    await ensureEventThreadBatch(batch);
  }
}

export async function ensureEventThread(eventId: number) {
  await ensureEventThreads([eventId]);
}
