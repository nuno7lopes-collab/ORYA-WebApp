import { prisma } from "@/lib/prisma";
import { TournamentEntryStatus, TournamentEntryRole } from "@prisma/client";

export async function ensureEntriesForConfirmedPairing(pairingId: number) {
  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    select: {
      id: true,
      eventId: true,
      player1UserId: true,
      player2UserId: true,
    },
  });
  if (!pairing) return;

  const entriesData: Array<{ userId: string; role: TournamentEntryRole }> = [];
  if (pairing.player1UserId) entriesData.push({ userId: pairing.player1UserId, role: "CAPTAIN" });
  if (pairing.player2UserId) entriesData.push({ userId: pairing.player2UserId, role: "PARTNER" });

  if (!entriesData.length) return;

  const entryIdsByUser: Record<string, number> = {};

  for (const entry of entriesData) {
    const upserted = await prisma.tournamentEntry.upsert({
      where: {
        eventId_userId: { eventId: pairing.eventId, userId: entry.userId },
      },
      update: {
        status: TournamentEntryStatus.CONFIRMED,
        role: entry.role,
        pairingId: pairing.id,
        ownerUserId: entry.userId,
        ownerIdentityId: null,
      },
      create: {
        eventId: pairing.eventId,
        userId: entry.userId,
        pairingId: pairing.id,
        role: entry.role,
        status: TournamentEntryStatus.CONFIRMED,
        ownerUserId: entry.userId,
        ownerIdentityId: null,
      },
    });
    entryIdsByUser[entry.userId] = upserted.id;
  }

  // Linkar tickets existentes (se já criados) ao tournament_entry
  const ticketUpdates = Object.entries(entryIdsByUser).map(([userId, entryId]) =>
    prisma.ticket.updateMany({
      where: { pairingId: pairing.id, userId, tournamentEntryId: null },
      data: { tournamentEntryId: entryId },
    }),
  );
  if (ticketUpdates.length) {
    await Promise.all(ticketUpdates);
  }
}
