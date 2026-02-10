import { FeeMode, type Prisma } from "@prisma/client";
import { computePricing } from "@/lib/pricing";
import { computeCombinedFees } from "@/lib/fees";
import { getPlatformFees } from "@/lib/platformSettings";

export const BOOKING_CONFIRMATION_SNAPSHOT_VERSION = 5;

type BookingPolicyRow = {
  id: number;
  policyType: string;
  allowCancellation: boolean | null;
  cancellationWindowMinutes: number | null;
  cancellationPenaltyBps: number | null;
  allowReschedule: boolean | null;
  rescheduleWindowMinutes: number | null;
  guestBookingAllowed: boolean | null;
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
  bookingPackage?: {
    packageId: number | null;
    label: string;
    durationMinutes: number;
    priceCents: number;
  } | null;
  addons?: Array<{
    addonId: number | null;
    label: string;
    deltaMinutes: number;
    deltaPriceCents: number;
    quantity: number;
    sortOrder: number;
  }> | null;
};

export type BookingPolicySnapshot = {
  policyId: number;
  policyType: string;
  allowCancellation: boolean;
  cancellationWindowMinutes: number | null;
  cancellationPenaltyBps: number;
  allowReschedule: boolean;
  rescheduleWindowMinutes: number | null;
  guestBookingAllowed: boolean;
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

export type BookingAddonSnapshotItem = {
  addonId: number | null;
  label: string;
  deltaMinutes: number;
  deltaPriceCents: number;
  quantity: number;
  sortOrder: number;
};

export type BookingAddonsSnapshot = {
  items: BookingAddonSnapshotItem[];
  totalDeltaMinutes: number;
  totalDeltaPriceCents: number;
};

export type BookingPackageSnapshot = {
  packageId: number | null;
  label: string;
  durationMinutes: number;
  priceCents: number;
};

export type BookingConfirmationSnapshot = {
  version: number;
  createdAt: string;
  currency: string;
  policySnapshot: BookingPolicySnapshot;
  pricingSnapshot: BookingPricingSnapshot;
  packageSnapshot?: BookingPackageSnapshot | null;
  addonsSnapshot?: BookingAddonsSnapshot | null;
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
        allowCancellation: true,
        cancellationWindowMinutes: true,
        cancellationPenaltyBps: true,
        allowReschedule: true,
        rescheduleWindowMinutes: true,
        guestBookingAllowed: true,
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
        allowCancellation: true,
        cancellationWindowMinutes: true,
        cancellationPenaltyBps: true,
        allowReschedule: true,
        rescheduleWindowMinutes: true,
        guestBookingAllowed: true,
        noShowFeeCents: true,
      },
    })) ??
    (await tx.organizationPolicy.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        policyType: true,
        allowCancellation: true,
        cancellationWindowMinutes: true,
        cancellationPenaltyBps: true,
        allowReschedule: true,
        rescheduleWindowMinutes: true,
        guestBookingAllowed: true,
        noShowFeeCents: true,
      },
    }));

  return fallback;
}

function buildPolicySnapshot(policy: BookingPolicyRow): BookingPolicySnapshot {
  const cancellationWindowMinutes =
    typeof policy.cancellationWindowMinutes === "number" ? policy.cancellationWindowMinutes : null;
  const rescheduleWindowMinutesRaw =
    typeof policy.rescheduleWindowMinutes === "number" ? policy.rescheduleWindowMinutes : null;
  const rescheduleWindowMinutes =
    rescheduleWindowMinutesRaw === null ? cancellationWindowMinutes : rescheduleWindowMinutesRaw;

  return {
    policyId: policy.id,
    policyType: policy.policyType,
    allowCancellation: Boolean(policy.allowCancellation),
    cancellationWindowMinutes,
    cancellationPenaltyBps: Math.max(0, Math.min(10000, toInt(policy.cancellationPenaltyBps) ?? 0)),
    allowReschedule: Boolean(policy.allowReschedule),
    rescheduleWindowMinutes,
    guestBookingAllowed: Boolean(policy.guestBookingAllowed),
    noShowFeeCents: Math.max(0, toInt(policy.noShowFeeCents) ?? 0),
  };
}

function buildAddonsSnapshot(
  addons: BookingRow["addons"] | null | undefined,
): BookingAddonsSnapshot | null {
  if (!addons || !Array.isArray(addons) || addons.length === 0) return null;
  const items = addons
    .map((addon) => ({
      addonId: addon.addonId ?? null,
      label: addon.label,
      deltaMinutes: addon.deltaMinutes ?? 0,
      deltaPriceCents: addon.deltaPriceCents ?? 0,
      quantity: addon.quantity ?? 1,
      sortOrder: addon.sortOrder ?? 0,
    }))
    .filter((addon) => addon.quantity > 0);
  if (items.length === 0) return null;
  const totalDeltaMinutes = items.reduce((sum, item) => sum + item.deltaMinutes * item.quantity, 0);
  const totalDeltaPriceCents = items.reduce(
    (sum, item) => sum + item.deltaPriceCents * item.quantity,
    0,
  );
  return {
    items: items.sort((a, b) => a.sortOrder - b.sortOrder || (a.addonId ?? 0) - (b.addonId ?? 0)),
    totalDeltaMinutes,
    totalDeltaPriceCents,
  };
}

function buildPackageSnapshot(
  bookingPackage: BookingRow["bookingPackage"] | null | undefined,
): BookingPackageSnapshot | null {
  if (!bookingPackage) return null;
  const label = typeof bookingPackage.label === "string" ? bookingPackage.label.trim() : "";
  if (!label) return null;
  return {
    packageId: bookingPackage.packageId ?? null,
    label,
    durationMinutes: Math.max(0, bookingPackage.durationMinutes ?? 0),
    priceCents: Math.max(0, bookingPackage.priceCents ?? 0),
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
    stripeFeeBps: 0,
    stripeFeeFixedCents: 0,
  });

  const totalCents =
    typeof grossAmountCents === "number" && grossAmountCents >= 0
      ? grossAmountCents
      : Math.max(0, combinedFees.totalCents + cardPlatformFeeCents);

  // Fee cents represent only what is added on top of the base price.
  const feeCents = feeMode === FeeMode.ADDED ? Math.max(0, totalCents - baseCents) : 0;
  const stripeFeeEstimateCents = 0;

  return {
    baseCents,
    discountCents: 0,
    feeCents,
    taxCents: 0,
    totalCents,
    feeMode,
    platformFeeBps: pricing.feeBpsApplied,
    platformFeeFixedCents: pricing.feeFixedApplied,
    stripeFeeBps: 0,
    stripeFeeFixedCents: 0,
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
      packageSnapshot: buildPackageSnapshot(booking.bookingPackage ?? null),
      addonsSnapshot: buildAddonsSnapshot(booking.addons ?? null),
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

  const allowCancellation = raw.allowCancellation == null ? true : Boolean(raw.allowCancellation);
  const cancellationPenaltyBps = clampNonNegative(raw.cancellationPenaltyBps);
  const allowReschedule = raw.allowReschedule == null ? true : Boolean(raw.allowReschedule);
  const rescheduleWindowMinutes =
    raw.rescheduleWindowMinutes === null || raw.rescheduleWindowMinutes == null
      ? null
      : clampNonNegative(raw.rescheduleWindowMinutes, -1);

  return {
    policyId,
    policyType,
    allowCancellation,
    cancellationWindowMinutes:
      typeof cancellationWindowMinutes === "number" && cancellationWindowMinutes >= 0
        ? cancellationWindowMinutes
        : null,
    cancellationPenaltyBps: Math.max(0, Math.min(10000, cancellationPenaltyBps)),
    allowReschedule,
    rescheduleWindowMinutes:
      typeof rescheduleWindowMinutes === "number" && rescheduleWindowMinutes >= 0
        ? rescheduleWindowMinutes
        : null,
    guestBookingAllowed: Boolean(raw.guestBookingAllowed),
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

function parseAddonsSnapshot(raw: unknown): BookingAddonsSnapshot | null {
  if (!isRecord(raw)) return null;
  const itemsRaw = raw.items;
  if (!Array.isArray(itemsRaw)) return null;
  const items: BookingAddonSnapshotItem[] = itemsRaw
    .map((item) => {
      if (!isRecord(item)) return null;
      return {
        addonId: typeof item.addonId === "number" ? item.addonId : null,
        label: typeof item.label === "string" ? item.label : "",
        deltaMinutes: clampNonNegative(item.deltaMinutes),
        deltaPriceCents: clampNonNegative(item.deltaPriceCents),
        quantity: Math.max(1, clampNonNegative(item.quantity, 1)),
        sortOrder: clampNonNegative(item.sortOrder),
      };
    })
    .filter((item): item is BookingAddonSnapshotItem => item !== null && item.label.length > 0);
  if (items.length === 0) return null;
  const totalDeltaMinutes =
    typeof raw.totalDeltaMinutes === "number"
      ? Math.max(0, raw.totalDeltaMinutes)
      : items.reduce((sum, item) => sum + item.deltaMinutes * item.quantity, 0);
  const totalDeltaPriceCents =
    typeof raw.totalDeltaPriceCents === "number"
      ? Math.max(0, raw.totalDeltaPriceCents)
      : items.reduce((sum, item) => sum + item.deltaPriceCents * item.quantity, 0);
  return { items, totalDeltaMinutes, totalDeltaPriceCents };
}

function parsePackageSnapshot(raw: unknown): BookingPackageSnapshot | null {
  if (!isRecord(raw)) return null;
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  if (!label) return null;
  return {
    packageId: typeof raw.packageId === "number" ? raw.packageId : null,
    label,
    durationMinutes: clampNonNegative(raw.durationMinutes),
    priceCents: clampNonNegative(raw.priceCents),
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
  const addonsSnapshot = parseAddonsSnapshot(raw.addonsSnapshot);
  const packageSnapshot = parsePackageSnapshot(raw.packageSnapshot);

  return {
    version,
    createdAt,
    currency: currencyRaw.toUpperCase(),
    policySnapshot,
    pricingSnapshot,
    packageSnapshot,
    addonsSnapshot,
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

export function getSnapshotRescheduleWindowMinutes(raw: unknown): number | null {
  const policy = getPolicySnapshot(raw);
  if (!policy) return null;
  return policy.rescheduleWindowMinutes ?? policy.cancellationWindowMinutes ?? null;
}

export function getSnapshotCancellationPenaltyBps(raw: unknown): number {
  return getPolicySnapshot(raw)?.cancellationPenaltyBps ?? 0;
}

export function getSnapshotAllowCancellation(raw: unknown): boolean {
  return getPolicySnapshot(raw)?.allowCancellation ?? true;
}

export function getSnapshotAllowReschedule(raw: unknown): boolean {
  return getPolicySnapshot(raw)?.allowReschedule ?? true;
}

export function getSnapshotTotalCents(raw: unknown): number | null {
  const pricing = getPricingSnapshot(raw);
  if (!pricing) return null;
  return pricing.totalCents;
}

export type SnapshotRefundRule =
  | "FULL_REFUND"
  | "CLIENT_CANCEL_KEEP_FEES"
  | "NO_SHOW_FEE"
  | "FULL_FORFEIT";

export type SnapshotRefundComputation = {
  currency: string;
  totalCents: number;
  penaltyCents: number;
  refundCents: number;
  rule: SnapshotRefundRule;
  feesRetainedCents?: number;
};

export function computeCancellationRefundFromSnapshot(
  raw: unknown,
  params?: { actor?: "CLIENT" | "ORG"; stripeFeeCentsActual?: number | null },
): SnapshotRefundComputation | null {
  const snapshot = parseBookingConfirmationSnapshot(raw);
  if (!snapshot) return null;
  const totalCents = snapshot.pricingSnapshot.totalCents;
  const actor = params?.actor ?? "CLIENT";
  if (actor === "ORG") {
    return {
      currency: snapshot.currency,
      totalCents,
      penaltyCents: 0,
      refundCents: totalCents,
      rule: "FULL_REFUND",
      feesRetainedCents: 0,
    };
  }

  const baseCents = snapshot.pricingSnapshot.baseCents;
  const cardPlatformFeeCents = snapshot.pricingSnapshot.cardPlatformFeeCents;
  const stripeFeeCentsEstimate = snapshot.pricingSnapshot.stripeFeeEstimateCents;
  const oryaFeeEstimateCents = Math.max(
    0,
    snapshot.pricingSnapshot.combinedFeeEstimateCents - stripeFeeCentsEstimate - cardPlatformFeeCents,
  );
  const stripeFeeCents = Math.max(0, params?.stripeFeeCentsActual ?? stripeFeeCentsEstimate);
  const feesRetainedCents = Math.max(0, oryaFeeEstimateCents + stripeFeeCents + cardPlatformFeeCents);
  const penaltyBps = Math.max(0, Math.min(10_000, snapshot.policySnapshot.cancellationPenaltyBps ?? 0));
  const penaltyCents = Math.max(0, Math.round((Math.max(0, baseCents) * penaltyBps) / 10_000));

  const refundCents = Math.max(0, totalCents - feesRetainedCents - penaltyCents);

  return {
    currency: snapshot.currency,
    totalCents,
    penaltyCents,
    refundCents,
    rule: "CLIENT_CANCEL_KEEP_FEES",
    feesRetainedCents,
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
