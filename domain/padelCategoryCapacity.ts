import { Prisma } from "@prisma/client";

type CapacityCheckResult = { ok: true } | { ok: false; code: "CATEGORY_FULL" | "CATEGORY_PLAYERS_FULL" };

type CapacityCheckParams = {
  tx: Prisma.TransactionClient;
  eventId: number;
  categoryId: number | null;
  excludePairingId?: number | null;
};

export async function checkPadelCategoryCapacity(params: CapacityCheckParams): Promise<CapacityCheckResult> {
  const { tx, eventId, categoryId, excludePairingId } = params;
  if (!categoryId) return { ok: true };

  const link = await tx.padelEventCategoryLink.findFirst({
    where: { eventId, padelCategoryId: categoryId, isEnabled: true },
    select: { capacityTeams: true, capacityPlayers: true },
  });
  if (!link) return { ok: true };

  const capacityTeams =
    typeof link.capacityTeams === "number" && Number.isFinite(link.capacityTeams) && link.capacityTeams > 0
      ? Math.floor(link.capacityTeams)
      : null;
  const capacityPlayers =
    typeof link.capacityPlayers === "number" && Number.isFinite(link.capacityPlayers) && link.capacityPlayers > 0
      ? Math.floor(link.capacityPlayers)
      : null;

  if (!capacityTeams && !capacityPlayers) return { ok: true };

  const pairingFilter = {
    eventId,
    categoryId,
    pairingStatus: { not: "CANCELLED" as const },
    lifecycleStatus: { not: "CANCELLED_INCOMPLETE" as const },
    ...(excludePairingId ? { id: { not: excludePairingId } } : {}),
  };

  if (capacityTeams) {
    const teamsCount = await tx.padelPairing.count({ where: pairingFilter });
    if (teamsCount >= capacityTeams) return { ok: false, code: "CATEGORY_FULL" };
  }

  if (capacityPlayers) {
    const playersCount = await tx.padelPairingSlot.count({
      where: {
        slotStatus: "FILLED",
        pairing: pairingFilter,
      },
    });
    if (playersCount >= capacityPlayers) return { ok: false, code: "CATEGORY_PLAYERS_FULL" };
  }

  return { ok: true };
}

type PlayerCapacityResult = { ok: true } | { ok: false; code: "CATEGORY_PLAYERS_FULL" };

type PlayerCapacityParams = {
  tx: Prisma.TransactionClient;
  eventId: number;
  categoryId: number | null;
  excludePairingId?: number | null;
};

export async function checkPadelCategoryPlayerCapacity(params: PlayerCapacityParams): Promise<PlayerCapacityResult> {
  const { tx, eventId, categoryId, excludePairingId } = params;
  if (!categoryId) return { ok: true };

  const link = await tx.padelEventCategoryLink.findFirst({
    where: { eventId, padelCategoryId: categoryId, isEnabled: true },
    select: { capacityPlayers: true },
  });
  if (!link) return { ok: true };

  const capacityPlayers =
    typeof link.capacityPlayers === "number" && Number.isFinite(link.capacityPlayers) && link.capacityPlayers > 0
      ? Math.floor(link.capacityPlayers)
      : null;
  if (!capacityPlayers) return { ok: true };

  const playersCount = await tx.padelPairingSlot.count({
    where: {
      slotStatus: "FILLED",
      pairing: {
        eventId,
        categoryId,
        pairingStatus: { not: "CANCELLED" as const },
        lifecycleStatus: { not: "CANCELLED_INCOMPLETE" as const },
        ...(excludePairingId ? { id: { not: excludePairingId } } : {}),
      },
    },
  });
  if (playersCount >= capacityPlayers) return { ok: false, code: "CATEGORY_PLAYERS_FULL" };

  return { ok: true };
}
