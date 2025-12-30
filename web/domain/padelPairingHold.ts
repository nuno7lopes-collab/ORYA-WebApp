import { Prisma, PadelPairingHoldStatus } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

const DEFAULT_HOLD_MINUTES = 30;

export async function upsertActiveHold(
  tx: TxClient,
  params: { pairingId: number; eventId: number; ttlMinutes?: number },
) {
  const { pairingId, eventId, ttlMinutes } = params;
  const minutes = ttlMinutes && ttlMinutes > 0 ? ttlMinutes : DEFAULT_HOLD_MINUTES;
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

  // Alguns ambientes perderam o unique constraint, por isso evitamos upsert/ON CONFLICT.
  const updated = await tx.padelPairingHold.updateMany({
    where: { pairingId, status: PadelPairingHoldStatus.ACTIVE },
    data: { expiresAt },
  });

  if (updated.count === 0) {
    await tx.padelPairingHold.create({
      data: {
        pairingId,
        eventId,
        holds: 2,
        status: PadelPairingHoldStatus.ACTIVE,
        expiresAt,
      },
    });
  }

  return { expiresAt };
}

export async function cancelActiveHold(tx: TxClient, pairingId: number) {
  await tx.padelPairingHold.updateMany({
    where: { pairingId, status: PadelPairingHoldStatus.ACTIVE },
    data: { status: PadelPairingHoldStatus.CANCELLED },
  });
}

export async function expireHolds(tx: TxClient, now: Date) {
  await tx.padelPairingHold.updateMany({
    where: { status: PadelPairingHoldStatus.ACTIVE, expiresAt: { lt: now } },
    data: { status: PadelPairingHoldStatus.EXPIRED },
  });
}
