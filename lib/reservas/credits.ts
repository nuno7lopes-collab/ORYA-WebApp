import { Prisma } from "@prisma/client";

const CREDIT_EXPIRY_MONTHS = 6;

export function computeCreditExpiry(now = new Date()) {
  const next = new Date(now);
  next.setMonth(next.getMonth() + CREDIT_EXPIRY_MONTHS);
  return next;
}

export function resolveCreditExpiry(current: Date | null, now = new Date()) {
  const candidate = computeCreditExpiry(now);
  if (!current) return candidate;
  return current > candidate ? current : candidate;
}

export async function addCredits(
  tx: Prisma.TransactionClient,
  params: { userId: string; serviceId: number; units: number; now?: Date },
) {
  const now = params.now ?? new Date();
  const existing = await tx.serviceCreditBalance.findUnique({
    where: { userId_serviceId: { userId: params.userId, serviceId: params.serviceId } },
  });
  const expiresAt = resolveCreditExpiry(existing?.expiresAt ?? null, now);
  const nextRemaining = (existing?.remainingUnits ?? 0) + params.units;
  const status =
    nextRemaining <= 0 ? "DEPLETED" : expiresAt && expiresAt <= now ? "EXPIRED" : "ACTIVE";

  const balance = await tx.serviceCreditBalance.upsert({
    where: { userId_serviceId: { userId: params.userId, serviceId: params.serviceId } },
    update: {
      remainingUnits: nextRemaining,
      expiresAt,
      status,
    },
    create: {
      userId: params.userId,
      serviceId: params.serviceId,
      remainingUnits: nextRemaining,
      expiresAt,
      status,
    },
  });

  return { balance, expiresAt };
}

export async function consumeCredits(
  tx: Prisma.TransactionClient,
  params: { userId: string; serviceId: number; units: number; now?: Date },
) {
  const now = params.now ?? new Date();
  const balance = await tx.serviceCreditBalance.findUnique({
    where: { userId_serviceId: { userId: params.userId, serviceId: params.serviceId } },
  });
  if (!balance || balance.remainingUnits < params.units) {
    return { ok: false as const, reason: "INSUFFICIENT" };
  }
  if (balance.expiresAt && balance.expiresAt <= now) {
    await tx.serviceCreditBalance.update({
      where: { id: balance.id },
      data: { status: "EXPIRED", remainingUnits: 0 },
    });
    return { ok: false as const, reason: "EXPIRED" };
  }

  const nextRemaining = balance.remainingUnits - params.units;
  const status = nextRemaining <= 0 ? "DEPLETED" : "ACTIVE";
  const updated = await tx.serviceCreditBalance.update({
    where: { id: balance.id },
    data: { remainingUnits: nextRemaining, status },
  });

  return { ok: true as const, balance: updated };
}
