import { prisma } from "@/lib/prisma";
import { computeHoldUntil } from "@/lib/payments/payoutConfig";
import { PendingPayoutStatus } from "@prisma/client";

export type PendingPayoutMetadata = {
  sourceType: string;
  sourceId: string;
  recipientConnectAccountId: string;
  paymentIntentId: string;
  chargeId?: string | null;
  currency: string;
  grossAmountCents: number;
  platformFeeCents: number;
  feeMode: string;
  amountCents: number;
  paidAt: Date;
};

function parseRequiredString(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}

function parseRequiredNumber(value: unknown) {
  const num = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(num) ? Math.round(num) : null;
}

export function parsePendingPayoutMetadata(
  meta: Record<string, string | undefined | null>,
  paymentIntentId: string,
  paidAt: Date,
  chargeId?: string | null,
): PendingPayoutMetadata | null {
  const recipientConnectAccountId = parseRequiredString(meta.recipientConnectAccountId);
  const sourceType = parseRequiredString(meta.sourceType);
  const sourceId = parseRequiredString(meta.sourceId);
  const currency = parseRequiredString(meta.currency);
  const grossAmountCents = parseRequiredNumber(meta.grossAmountCents);
  const platformFeeCents = parseRequiredNumber(meta.platformFeeCents);
  const amountCents = parseRequiredNumber(meta.payoutAmountCents);
  const feeMode = parseRequiredString(meta.feeMode ?? meta.platformFeeMode);
  const allowedFeeModes = new Set(["INCLUDED", "ADDED", "ON_TOP"]);

  if (!recipientConnectAccountId || !sourceType || !sourceId || !currency) return null;
  if (grossAmountCents === null || platformFeeCents === null || amountCents === null) return null;
  if (!allowedFeeModes.has(feeMode)) return null;

  return {
    sourceType,
    sourceId,
    recipientConnectAccountId,
    paymentIntentId,
    chargeId: chargeId ?? null,
    currency: currency.toUpperCase(),
    grossAmountCents,
    platformFeeCents,
    feeMode,
    amountCents,
    paidAt,
  };
}

export async function createPendingPayout(metadata: PendingPayoutMetadata) {
  const holdUntil = computeHoldUntil(metadata.paidAt);
  return prisma.pendingPayout.upsert({
    where: { paymentIntentId: metadata.paymentIntentId },
    update: {
      status: PendingPayoutStatus.HELD,
      holdUntil,
      amountCents: metadata.amountCents,
      currency: metadata.currency,
      recipientConnectAccountId: metadata.recipientConnectAccountId,
      sourceType: metadata.sourceType,
      sourceId: metadata.sourceId,
      grossAmountCents: metadata.grossAmountCents,
      platformFeeCents: metadata.platformFeeCents,
      feeMode: metadata.feeMode,
      chargeId: metadata.chargeId ?? undefined,
      blockedReason: null,
    },
    create: {
      sourceType: metadata.sourceType,
      sourceId: metadata.sourceId,
      paymentIntentId: metadata.paymentIntentId,
      chargeId: metadata.chargeId ?? null,
      recipientConnectAccountId: metadata.recipientConnectAccountId,
      currency: metadata.currency,
      grossAmountCents: metadata.grossAmountCents,
      platformFeeCents: metadata.platformFeeCents,
      feeMode: metadata.feeMode,
      amountCents: metadata.amountCents,
      holdUntil,
      status: PendingPayoutStatus.HELD,
    },
  });
}

export async function cancelPendingPayout(paymentIntentId: string, reason: string) {
  return prisma.pendingPayout.updateMany({
    where: { paymentIntentId, status: { in: [PendingPayoutStatus.HELD, PendingPayoutStatus.RELEASING] } },
    data: { status: PendingPayoutStatus.CANCELLED, blockedReason: reason },
  });
}

export async function blockPendingPayout(paymentIntentId: string, reason: string) {
  return prisma.pendingPayout.updateMany({
    where: { paymentIntentId, status: { in: [PendingPayoutStatus.HELD, PendingPayoutStatus.RELEASING] } },
    data: { status: PendingPayoutStatus.BLOCKED, blockedReason: reason },
  });
}

export async function unblockPendingPayout(paymentIntentId: string) {
  return prisma.pendingPayout.updateMany({
    where: { paymentIntentId, status: PendingPayoutStatus.BLOCKED },
    data: { status: PendingPayoutStatus.HELD, blockedReason: null },
  });
}
