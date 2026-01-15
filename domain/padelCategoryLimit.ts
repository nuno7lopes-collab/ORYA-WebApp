import { Prisma } from "@prisma/client";

type LimitResult = { ok: true } | { ok: false; code: "ALREADY_IN_CATEGORY" | "MAX_CATEGORIES" };

type LimitParams = {
  tx: Prisma.TransactionClient;
  eventId: number;
  userId: string;
  categoryId: number | null;
  excludePairingId?: number | null;
};

export async function checkPadelCategoryLimit(params: LimitParams): Promise<LimitResult> {
  const { tx, eventId, userId, categoryId, excludePairingId } = params;

  if (!categoryId) return { ok: true };

  const config = await tx.padelTournamentConfig.findUnique({
    where: { eventId },
    select: { advancedSettings: true },
  });
  const advanced = (config?.advancedSettings || {}) as { allowSecondCategory?: boolean };
  const maxCategories = advanced.allowSecondCategory === false ? 1 : 2;

  const slots = await tx.padelPairingSlot.findMany({
    where: {
      profileId: userId,
      slotStatus: "FILLED",
      paymentStatus: "PAID",
      pairing: {
        eventId,
        pairingStatus: { not: "CANCELLED" },
        lifecycleStatus: { not: "CANCELLED_INCOMPLETE" },
        ...(excludePairingId ? { id: { not: excludePairingId } } : {}),
      },
    },
    select: {
      pairing: { select: { categoryId: true } },
    },
  });

  const categories = new Set<number>();
  for (const slot of slots) {
    const slotCategory = slot.pairing?.categoryId ?? null;
    if (slotCategory) categories.add(slotCategory);
  }

  if (categories.has(categoryId)) {
    return { ok: false, code: "ALREADY_IN_CATEGORY" };
  }

  if (categories.size >= maxCategories) {
    return { ok: false, code: "MAX_CATEGORIES" };
  }

  return { ok: true };
}
