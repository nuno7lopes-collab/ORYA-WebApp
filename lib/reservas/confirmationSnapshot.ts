import { FeeMode, type Prisma } from "@prisma/client";
import { computePricing } from "@/lib/pricing";
import { computeCombinedFees } from "@/lib/fees";
import { getPlatformFees, getStripeBaseFees } from "@/lib/platformSettings";

export const BOOKING_CONFIRMATION_SNAPSHOT_VERSION = 1;

type BookingPolicyRow = {
  id: number;
  policyType: string;
  cancellationWindowMinutes: number | null;
  guestBookingAllowed: boolean | null;
  allowPayAtVenue: boolean | null;
  depositRequired: boolean | null;
  depositAmountCents: number | null;
  noShowFeeCents: number | null;
};

type BookingOrganizationRow = {
  feeMode: FeeMode | null;
  platformFeeBps: number | null;
  platformFeeFixedCents: number | null;
  orgType: string | null;
};

type BookingServiceRow = {
  policyId: number | null;
  unitPriceCents: number | null;
  currency: string | null;
  organization: BookingOrganizationRow | null;
};

type BookingRow = {
  id: number;
  organizationId: number;
  price: number | null;
  currency: string | null;
  policyRef: { policyId: number } | null;
  service: BookingServiceRow | null;
};

export type BookingPolicySnapshot = {
  policyId: number;
  policyType: string;
  cancellationWindowMinutes: number | null;
  guestBookingAllowed: boolean;
  allowPayAtVenue: boolean;
  depositRequired: boolean;
  depositAmountCents: number;
  noShowFeeCents: number;
};

export type BookingPricingSnapshot = {
  baseCents: number;
  discountCents: number;
  feeCents: number;
  taxCents: number;
  totalCents: number;
  feeMode: FeeMode;
  platformFeeBps: number;
  platformFeeFixedCents: number;
  stripeFeeBps: number;
  stripeFeeFixedCents: number;
  stripeFeeEstimateCents: number;
  cardPlatformFeeCents: number;
  combinedFeeEstimateCents: number;
};

export type BookingConfirmationSnapshot = {
  version: number;
  createdAt: string;
  currency: string;
  policySnapshot: BookingPolicySnapshot;
  pricingSnapshot: BookingPricingSnapshot;
};

export type BookingConfirmationPaymentMeta = {
  grossAmountCents?: number | string | null;
  cardPlatformFeeCents?: number | string | null;
  stripeFeeEstimateCents?: number | string | null;
};

type BuildSnapshotParams = {
  tx: Prisma.TransactionClient;
  booking: BookingRow;
  now?: Date;
  policyIdHint?: number | null;
  paymentMeta?: BookingConfirmationPaymentMeta | null;
};

type BuildSnapshotResult =
  | { ok: true; snapshot: BookingConfirmationSnapshot; policyId: number }
  | { ok: false; code: "POLICY_SNAPSHOT_MISSING" | "PRICING_SNAPSHOT_MISSING" };

const toInt = (value: unknown) => {
  if (value == null) return null;
  const parsed =
    typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const normalizeFeeMode = (mode: FeeMode) => (mode === FeeMode.ON_TOP ? FeeMode.ADDED : mode);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const clampNonNegative = (value: unknown, fallback = 0) => {
  const parsed = toInt(value);
  if (parsed == null || parsed < 0) return fallback;
  return parsed;
};

async function resolvePolicy(params: {
  tx: Prisma.TransactionClient;
  organizationId: number;
  policyIdHint?: number | null;
  policyRefId?: number | null;
  servicePolicyId?: number | null;
}): Promise<BookingPolicyRow | null> {
  const { tx, organizationId, policyIdHint, policyRefId, servicePolicyId } = params;

  const candidates = [policyRefId, policyIdHint, servicePolicyId].filter((id): id is number =>
    Number.isFinite(id as number),
  );

  for (const candidateId of candidates) {
    const policy = await tx.organizationPolicy.findFirst({
      where: { id: candidateId, organizationId },
      select: {
        id: true,
        policyType: true,
        cancellationWindowMinutes: true,
        guestBookingAllowed: true,
        allowPayAtVenue: true,
        depositRequired: true,
        depositAmountCents: true,
        noShowFeeCents: true,
      },
    });
    if (policy) return policy;
  }

  const fallback =
    (await tx.organizationPolicy.findFirst({
      where: { organizationId, policyType: "MODERATE" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        policyType: true,
        cancellationWindowMinutes: true,
        guestBookingAllowed: true,
        allowPayAtVenue: true,
        depositRequired: true,
        depositAmountCents: true,
        noShowFeeCents: true,
      },
    })) ??
    (await tx.organizationPolicy.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        policyType: true,
        cancellationWindowMinutes: true,
        guestBookingAllowed: true,
        allowPayAtVenue: true,
        depositRequired: true,
        depositAmountCents: true,
        noShowFeeCents: true,
      },
    }));

  return fallback;
}

function buildPolicySnapshot(policy: BookingPolicyRow): BookingPolicySnapshot {
  return {
    policyId: policy.id,
    policyType: policy.policyType,
    cancellationWindowMinutes:
      typeof policy.cancellationWindowMinutes === "number" ? policy.cancellationWindowMinutes : null,
    guestBookingAllowed: Boolean(policy.guestBookingAllowed),
    allowPayAtVenue: Boolean(policy.allowPayAtVenue),
    depositRequired: Boolean(policy.depositRequired),
    depositAmountCents: Math.max(0, toInt(policy.depositAmountCents) ?? 0),
    noShowFeeCents: Math.max(0, toInt(policy.noShowFeeCents) ?? 0),
  };
}

async function buildPricingSnapshot(params: {
  booking: BookingRow;
  paymentMeta?: BookingConfirmationPaymentMeta | null;
}): Promise<BookingPricingSnapshot | null> {
  const { booking, paymentMeta } = params;
  const baseCentsRaw = toInt(booking.price) ?? toInt(booking.service?.unitPriceCents) ?? 0;
  const baseCents = Math.max(0, baseCentsRaw);
  if (!Number.isFinite(baseCents)) return null;

  const cardPlatformFeeCents = Math.max(0, toInt(paymentMeta?.cardPlatformFeeCents) ?? 0);
  const grossAmountCents = toInt(paymentMeta?.grossAmountCents);

  const platformDefaults = await getPlatformFees();
  const stripeDefaults = await getStripeBaseFees();
  const org = booking.service?.organization ?? null;
  const isPlatformOrg = org?.orgType === "PLATFORM";

  const pricing = computePricing(baseCents, 0, {
    platformDefaultFeeMode: FeeMode.INCLUDED,
    organizationFeeMode: org?.feeMode ?? null,
    organizationPlatformFeeBps: org?.platformFeeBps ?? null,
    organizationPlatformFeeFixedCents: org?.platformFeeFixedCents ?? null,
    platformDefaultFeeBps: platformDefaults.feeBps,
    platformDefaultFeeFixedCents: platformDefaults.feeFixedCents,
    isPlatformOrg,
  });
  const feeMode = normalizeFeeMode(pricing.feeMode);

  const combinedFees = computeCombinedFees({
    amountCents: baseCents,
    discountCents: 0,
    feeMode,
    platformFeeBps: pricing.feeBpsApplied,
    platformFeeFixedCents: pricing.feeFixedApplied,
    stripeFeeBps: stripeDefaults.feeBps,
    stripeFeeFixedCents: stripeDefaults.feeFixedCents,
  });

  const totalCents =
    typeof grossAmountCents === "number" && grossAmountCents >= 0
      ? grossAmountCents
      : Math.max(0, combinedFees.totalCents + cardPlatformFeeCents);

  // Fee cents represent only what is added on top of the base price.
  const feeCents = feeMode === FeeMode.ADDED ? Math.max(0, totalCents - baseCents) : 0;
  const stripeFeeEstimateCents =
    Math.max(0, toInt(paymentMeta?.stripeFeeEstimateCents) ?? combinedFees.stripeFeeCentsEstimate);

  return {
    baseCents,
    discountCents: 0,
    feeCents,
    taxCents: 0,
    totalCents,
    feeMode,
    platformFeeBps: pricing.feeBpsApplied,
    platformFeeFixedCents: pricing.feeFixedApplied,
    stripeFeeBps: stripeDefaults.feeBps,
    stripeFeeFixedCents: stripeDefaults.feeFixedCents,
    stripeFeeEstimateCents,
    cardPlatformFeeCents,
    combinedFeeEstimateCents: combinedFees.combinedFeeCents + cardPlatformFeeCents,
  };
}

export async function buildBookingConfirmationSnapshot({
  tx,
  booking,
  now = new Date(),
  policyIdHint,
  paymentMeta,
}: BuildSnapshotParams): Promise<BuildSnapshotResult> {
  if (!booking.service) {
    return { ok: false, code: "PRICING_SNAPSHOT_MISSING" };
  }

  const policy = await resolvePolicy({
    tx,
    organizationId: booking.organizationId,
    policyIdHint,
    policyRefId: booking.policyRef?.policyId ?? null,
    servicePolicyId: booking.service.policyId ?? null,
  });
  if (!policy) {
    return { ok: false, code: "POLICY_SNAPSHOT_MISSING" };
  }

  const pricingSnapshot = await buildPricingSnapshot({ booking, paymentMeta });
  if (!pricingSnapshot) {
    return { ok: false, code: "PRICING_SNAPSHOT_MISSING" };
  }

  const currency = (booking.currency ?? booking.service.currency ?? "EUR").toUpperCase();
  const createdAt = now.toISOString();

  return {
    ok: true,
    policyId: policy.id,
    snapshot: {
      version: BOOKING_CONFIRMATION_SNAPSHOT_VERSION,
      createdAt,
      currency,
      policySnapshot: buildPolicySnapshot(policy),
      pricingSnapshot,
    },
  };
}

function parsePolicySnapshot(raw: unknown): BookingPolicySnapshot | null {
  if (!isRecord(raw)) return null;
  const policyId = clampNonNegative(raw.policyId, -1);
  if (policyId <= 0) return null;
  const policyType =
    typeof raw.policyType === "string" && raw.policyType.trim()
      ? raw.policyType
      : "CUSTOM";
  const cancellationWindowMinutes =
    raw.cancellationWindowMinutes === null
      ? null
      : clampNonNegative(raw.cancellationWindowMinutes, -1);

  return {
    policyId,
    policyType,
    cancellationWindowMinutes:
      typeof cancellationWindowMinutes === "number" && cancellationWindowMinutes >= 0
        ? cancellationWindowMinutes
        : null,
    guestBookingAllowed: Boolean(raw.guestBookingAllowed),
    allowPayAtVenue: Boolean(raw.allowPayAtVenue),
    depositRequired: Boolean(raw.depositRequired),
    depositAmountCents: clampNonNegative(raw.depositAmountCents),
    noShowFeeCents: clampNonNegative(raw.noShowFeeCents),
  };
}

function parsePricingSnapshot(raw: unknown): BookingPricingSnapshot | null {
  if (!isRecord(raw)) return null;
  const totalCents = clampNonNegative(raw.totalCents, -1);
  if (totalCents < 0) return null;
  const feeModeRaw = raw.feeMode;
  const feeMode =
    feeModeRaw === FeeMode.INCLUDED || feeModeRaw === FeeMode.ADDED || feeModeRaw === FeeMode.ON_TOP
      ? normalizeFeeMode(feeModeRaw)
      : FeeMode.INCLUDED;

  return {
    baseCents: clampNonNegative(raw.baseCents),
    discountCents: clampNonNegative(raw.discountCents),
    feeCents: clampNonNegative(raw.feeCents),
    taxCents: clampNonNegative(raw.taxCents),
    totalCents,
    feeMode,
    platformFeeBps: clampNonNegative(raw.platformFeeBps),
    platformFeeFixedCents: clampNonNegative(raw.platformFeeFixedCents),
    stripeFeeBps: clampNonNegative(raw.stripeFeeBps),
    stripeFeeFixedCents: clampNonNegative(raw.stripeFeeFixedCents),
    stripeFeeEstimateCents: clampNonNegative(raw.stripeFeeEstimateCents),
    cardPlatformFeeCents: clampNonNegative(raw.cardPlatformFeeCents),
    combinedFeeEstimateCents: clampNonNegative(raw.combinedFeeEstimateCents),
  };
}

export function parseBookingConfirmationSnapshot(raw: unknown): BookingConfirmationSnapshot | null {
  if (!isRecord(raw)) return null;
  const policySnapshot = parsePolicySnapshot(raw.policySnapshot);
  const pricingSnapshot = parsePricingSnapshot(raw.pricingSnapshot);
  if (!policySnapshot || !pricingSnapshot) return null;
  const version = clampNonNegative(raw.version, BOOKING_CONFIRMATION_SNAPSHOT_VERSION);
  const createdAt =
    typeof raw.createdAt === "string" && !Number.isNaN(new Date(raw.createdAt).getTime())
      ? raw.createdAt
      : new Date().toISOString();
  const currencyRaw =
    typeof raw.currency === "string" && raw.currency.trim() ? raw.currency : "EUR";

  return {
    version,
    createdAt,
    currency: currencyRaw.toUpperCase(),
    policySnapshot,
    pricingSnapshot,
  };
}

export function getPolicySnapshot(raw: unknown): BookingPolicySnapshot | null {
  return parseBookingConfirmationSnapshot(raw)?.policySnapshot ?? null;
}

export function getPricingSnapshot(raw: unknown): BookingPricingSnapshot | null {
  return parseBookingConfirmationSnapshot(raw)?.pricingSnapshot ?? null;
}

export function getSnapshotCancellationWindowMinutes(raw: unknown): number | null {
  return getPolicySnapshot(raw)?.cancellationWindowMinutes ?? null;
}

export function getSnapshotTotalCents(raw: unknown): number | null {
  const pricing = getPricingSnapshot(raw);
  if (!pricing) return null;
  return pricing.totalCents;
}

export type SnapshotRefundRule = "FULL_REFUND" | "NO_SHOW_FEE" | "FULL_FORFEIT";

export type SnapshotRefundComputation = {
  currency: string;
  totalCents: number;
  penaltyCents: number;
  refundCents: number;
  rule: SnapshotRefundRule;
};

export function computeCancellationRefundFromSnapshot(raw: unknown): SnapshotRefundComputation | null {
  const snapshot = parseBookingConfirmationSnapshot(raw);
  if (!snapshot) return null;
  const totalCents = snapshot.pricingSnapshot.totalCents;
  return {
    currency: snapshot.currency,
    totalCents,
    penaltyCents: 0,
    refundCents: totalCents,
    rule: "FULL_REFUND",
  };
}

export function computeNoShowRefundFromSnapshot(raw: unknown): SnapshotRefundComputation | null {
  const snapshot = parseBookingConfirmationSnapshot(raw);
  if (!snapshot) return null;
  const totalCents = snapshot.pricingSnapshot.totalCents;
  const noShowFeeCents = snapshot.policySnapshot.noShowFeeCents;
  const penaltyCents =
    noShowFeeCents > 0 ? Math.min(noShowFeeCents, totalCents) : totalCents;
  return {
    currency: snapshot.currency,
    totalCents,
    penaltyCents,
    refundCents: Math.max(0, totalCents - penaltyCents),
    rule: noShowFeeCents > 0 ? "NO_SHOW_FEE" : "FULL_FORFEIT",
  };
}
