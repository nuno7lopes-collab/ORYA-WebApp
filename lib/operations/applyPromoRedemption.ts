import { prisma } from "@/lib/prisma";

type ApplyPromoPayload = {
  purchaseId?: string | null;
  paymentIntentId?: string | null;
  promoCodeId?: number | null;
  userId?: string | null;
  guestEmail?: string | null;
};

/**
 * Aplica promo_redemption de forma idempotente (unique purchaseId+promoCodeId).
 * Revalida limites (maxUses/perUser) dentro de transação simples.
 */
export async function applyPromoRedemptionOperation(payload: ApplyPromoPayload) {
  const purchaseId = payload.purchaseId ?? payload.paymentIntentId ?? null;
  if (!purchaseId) throw new Error("APPLY_PROMO_REDEMPTION missing purchaseId");

  // Determinar promo a partir do payload ou do SaleSummary
  let promoCodeId = payload.promoCodeId ?? null;
  let userId = payload.userId ?? null;
  let guestEmail = payload.guestEmail ?? null;

  if (!promoCodeId) {
    const sale = await prisma.saleSummary.findFirst({
      where: {
        OR: [{ purchaseId }, { paymentIntentId: purchaseId }],
      },
      select: { promoCodeId: true, userId: true },
    });
    promoCodeId = sale?.promoCodeId ?? null;
    userId = userId ?? sale?.userId ?? null;
  }

  if (!promoCodeId) {
    // nada a aplicar
    return;
  }

  await prisma.$transaction(async (tx) => {
    const promo = await tx.promoCode.findUnique({
      where: { id: promoCodeId },
      select: { id: true, maxUses: true, perUserLimit: true, code: true },
    });
    if (!promo) throw new Error("PROMO_NOT_FOUND");

    const totalUses = await tx.promoRedemption.count({ where: { promoCodeId } });
    if (promo.maxUses != null && totalUses >= promo.maxUses) {
      throw new Error("PROMO_MAX_USES_REACHED");
    }

    if (promo.perUserLimit != null) {
      if (userId) {
        const userUses = await tx.promoRedemption.count({ where: { promoCodeId, userId } });
        if (userUses >= promo.perUserLimit) throw new Error("PROMO_USER_LIMIT_REACHED");
      } else if (guestEmail) {
        const guestUses = await tx.promoRedemption.count({
          where: { promoCodeId, guestEmail: { equals: guestEmail, mode: "insensitive" } },
        });
        if (guestUses >= promo.perUserLimit) throw new Error("PROMO_USER_LIMIT_REACHED");
      }
    }

    try {
      await tx.promoRedemption.upsert({
        where: {
          purchaseId_promoCodeId: {
            purchaseId,
            promoCodeId,
          },
        },
        update: {
          userId: userId ?? null,
          guestEmail: guestEmail ?? null,
        },
        create: {
          promoCodeId,
          purchaseId,
          userId: userId ?? null,
          guestEmail: guestEmail ?? null,
        },
      });
    } catch (err) {
      const isUnique =
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002";
      // Se já existe redemption (user/promo) não falhamos a operação: idempotente/silencioso.
      if (!isUnique) {
        throw err;
      }
      console.warn("[applyPromoRedemption] unique conflict ignorado (idempotente)", {
        promoCodeId,
        purchaseId,
        userId,
        guestEmail,
      });
    }
  });
}
