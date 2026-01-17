import { Prisma } from "@prisma/client";

type EventCapacityResult = { ok: true } | { ok: false; code: "EVENT_FULL" };

type EventCapacityParams = {
  tx: Prisma.TransactionClient;
  eventId: number;
  maxEntriesTotal?: number | null;
  excludePairingId?: number | null;
};

export async function checkPadelEventCapacity(params: EventCapacityParams): Promise<EventCapacityResult> {
  const { tx, eventId, maxEntriesTotal, excludePairingId } = params;
  if (!maxEntriesTotal || !Number.isFinite(maxEntriesTotal) || maxEntriesTotal <= 0) {
    return { ok: true };
  }
  const count = await tx.padelPairing.count({
    where: {
      eventId,
      pairingStatus: { not: "CANCELLED" },
      lifecycleStatus: { not: "CANCELLED_INCOMPLETE" },
      ...(excludePairingId ? { id: { not: excludePairingId } } : {}),
    },
  });
  if (count >= Math.floor(maxEntriesTotal)) return { ok: false, code: "EVENT_FULL" };
  return { ok: true };
}
