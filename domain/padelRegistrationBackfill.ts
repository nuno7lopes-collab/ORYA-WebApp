import { prisma } from "@/lib/prisma";
import { PadelRegistrationStatus } from "@prisma/client";
import { recordOutboxEvent } from "@/domain/outbox/producer";

export async function backfillPadelRegistrationOutbox(params?: { limit?: number; before?: Date | null }) {
  const limit = params?.limit ?? 200;
  const before = params?.before ?? null;

  const registrations = await prisma.padelRegistration.findMany({
    where: {
      ...(before ? { createdAt: { lt: before } } : {}),
      status: { in: Object.values(PadelRegistrationStatus) },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 500),
  });

  let emitted = 0;

  for (const reg of registrations) {
    const statusChangedExists = await prisma.outboxEvent.findFirst({
      where: {
        eventType: "PADREG_STATUS_CHANGED",
        payload: { path: ["registrationId"], equals: reg.id },
      },
      select: { eventId: true },
    });

    if (!statusChangedExists) {
      await recordOutboxEvent({
        eventType: "PADREG_STATUS_CHANGED",
        payload: {
          registrationId: reg.id,
          from: null,
          to: reg.status,
          reason: "BACKFILL",
        },
        correlationId: `backfill:${reg.id}`,
      });
      emitted += 1;
    }

    if (reg.status === PadelRegistrationStatus.EXPIRED) {
      const expiredExists = await prisma.outboxEvent.findFirst({
        where: {
          eventType: "PADREG_EXPIRED",
          payload: { path: ["registrationId"], equals: reg.id },
        },
        select: { eventId: true },
      });
      if (!expiredExists) {
        await recordOutboxEvent({
          eventType: "PADREG_EXPIRED",
          payload: {
            registrationId: reg.id,
            reason: "BACKFILL",
          },
          correlationId: `backfill:${reg.id}`,
        });
        emitted += 1;
      }
    }
  }

  const nextBefore = registrations.length
    ? registrations[registrations.length - 1].createdAt
    : null;

  return { scanned: registrations.length, emitted, nextBefore };
}
