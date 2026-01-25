import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { computePricing } from "@/lib/pricing";
import { getPlatformFees } from "@/lib/platformSettings";
import { getLatestPolicyForEvent } from "@/lib/checkin/accessPolicy";
import { consumeInviteToken } from "@/lib/invites/inviteTokens";
import { evaluateEventAccess } from "@/domain/access/evaluateAccess";
import { FeeMode, LedgerEntryType, PaymentStatus, ProcessorFeesStatus, SourceType } from "@prisma/client";

export type CreateCheckoutInput = {
  sourceType: SourceType;
  sourceId: string;
  buyerIdentityRef?: string | null;
  inviteToken?: string | null;
  pricingSnapshotHash?: string | null;
  idempotencyKey: string;
};

export type CreateCheckoutOutput = {
  paymentId: string;
  status: PaymentStatus;
  clientSecret?: string | null;
  pricingSnapshotHash?: string | null;
};

type PricingSnapshot = {
  currency: string;
  gross: number;
  discounts: number;
  taxes: number;
  platformFee: number;
  total: number;
  netToOrgPending: number;
  processorFeesStatus: ProcessorFeesStatus;
  processorFeesActual: number | null;
  feeMode: FeeMode;
  feeBps: number;
  feeFixed: number;
  feePolicyVersion: string;
  promoPolicyVersion: string | null;
  sourceType: SourceType;
  sourceId: string;
  lineItems: Array<{
    quantity: number;
    unitPriceCents: number;
    totalAmountCents?: number;
    currency: string;
    sourceLineId?: string;
    label?: string;
    ticketTypeId?: number;
  }>;
};

type ResolvedSnapshot = {
  organizationId: number;
  buyerIdentityId: string | null;
  snapshot: PricingSnapshot;
  eventId?: number;
  ticketTypeIds?: number[];
};

const MVP_ALLOWED_SOURCE_TYPES = new Set<SourceType>([
  SourceType.TICKET_ORDER,
  SourceType.BOOKING,
  SourceType.PADEL_REGISTRATION,
  SourceType.STORE_ORDER,
]);

function ensureMvpSourceType(sourceType: SourceType) {
  if (sourceType === SourceType.SUBSCRIPTION || sourceType === SourceType.MEMBERSHIP) {
    throw new Error("SOURCE_TYPE_NOT_ALLOWED_IN_MVP");
  }
  if (!MVP_ALLOWED_SOURCE_TYPES.has(sourceType)) {
    throw new Error("SOURCE_TYPE_NOT_SUPPORTED");
  }
}

function hashFeePolicyVersion(input: { feeMode: FeeMode; feeBps: number; feeFixed: number }) {
  const payload = JSON.stringify(input);
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sortedKeys = Object.keys(record).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      result[key] = canonicalize(record[key]);
    }
    return result;
  }
  return value;
}

function hashPricingSnapshot(snapshot: PricingSnapshot) {
  const canonical = canonicalize(snapshot);
  const payload = JSON.stringify(canonical);
  return crypto.createHash("sha256").update(payload).digest("hex");
}

async function resolveBookingSnapshot(sourceId: string): Promise<ResolvedSnapshot> {
  const bookingId = Number(sourceId);
  if (!Number.isFinite(bookingId)) {
    throw new Error("INVALID_SOURCE_ID");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { organization: true },
  });
  if (!booking) {
    throw new Error("SOURCE_NOT_FOUND");
  }

  const platformFees = await getPlatformFees();
  const pricing = computePricing(booking.price, 0, {
    organizationFeeMode: booking.organization.feeMode ?? null,
    organizationPlatformFeeBps: booking.organization.platformFeeBps ?? null,
    organizationPlatformFeeFixedCents: booking.organization.platformFeeFixedCents ?? null,
    platformDefaultFeeMode: FeeMode.ADDED,
    platformDefaultFeeBps: platformFees.feeBps,
    platformDefaultFeeFixedCents: platformFees.feeFixedCents,
  });

  const feePolicyVersion = hashFeePolicyVersion({
    feeMode: pricing.feeMode,
    feeBps: pricing.feeBpsApplied,
    feeFixed: pricing.feeFixedApplied,
  });

  const gross = pricing.subtotalCents;
  const discounts = pricing.discountCents;
  const taxes = 0;
  const total = pricing.totalCents;
  const netToOrgPending = Math.max(0, gross - pricing.platformFeeCents);

  return {
    organizationId: booking.organizationId,
    buyerIdentityId: booking.userId ?? null,
    snapshot: {
      currency: booking.currency,
      gross,
      discounts,
      taxes,
      platformFee: pricing.platformFeeCents,
      total,
      netToOrgPending,
      processorFeesStatus: ProcessorFeesStatus.PENDING,
      processorFeesActual: null,
      feeMode: pricing.feeMode,
      feeBps: pricing.feeBpsApplied,
      feeFixed: pricing.feeFixedApplied,
      feePolicyVersion,
      promoPolicyVersion: null,
      sourceType: SourceType.BOOKING,
      sourceId: String(booking.id),
      lineItems: [
        {
          quantity: 1,
          unitPriceCents: booking.price,
          totalAmountCents: booking.price,
          currency: booking.currency,
          sourceLineId: String(booking.id),
        },
      ],
    },
  };
}

async function resolveStoreOrderSnapshot(sourceId: string): Promise<ResolvedSnapshot> {
  const orderId = Number(sourceId);
  if (!Number.isFinite(orderId)) {
    throw new Error("INVALID_SOURCE_ID");
  }

  const order = await prisma.storeOrder.findUnique({
    where: { id: orderId },
    include: {
      store: { include: { organization: true } },
      lines: true,
    },
  });
  if (!order) {
    throw new Error("SOURCE_NOT_FOUND");
  }
  if (!order.store?.ownerOrganizationId || !order.store.organization) {
    throw new Error("STORE_ORG_NOT_FOUND");
  }

  const platformFees = await getPlatformFees();
  const subtotal = order.subtotalCents + (order.shippingCents ?? 0);
  const pricing = computePricing(subtotal, order.discountCents ?? 0, {
    organizationFeeMode: order.store.organization.feeMode ?? null,
    organizationPlatformFeeBps: order.store.organization.platformFeeBps ?? null,
    organizationPlatformFeeFixedCents: order.store.organization.platformFeeFixedCents ?? null,
    platformDefaultFeeMode: FeeMode.ADDED,
    platformDefaultFeeBps: platformFees.feeBps,
    platformDefaultFeeFixedCents: platformFees.feeFixedCents,
  });

  const feePolicyVersion = hashFeePolicyVersion({
    feeMode: pricing.feeMode,
    feeBps: pricing.feeBpsApplied,
    feeFixed: pricing.feeFixedApplied,
  });

  const gross = pricing.subtotalCents;
  const discounts = pricing.discountCents;
  const taxes = 0;
  const total = pricing.totalCents;
  const netToOrgPending = Math.max(0, gross - pricing.platformFeeCents);

  return {
    organizationId: order.store.ownerOrganizationId,
    buyerIdentityId: order.userId ?? null,
    snapshot: {
      currency: order.currency,
      gross,
      discounts,
      taxes,
      platformFee: pricing.platformFeeCents,
      total,
      netToOrgPending,
      processorFeesStatus: ProcessorFeesStatus.PENDING,
      processorFeesActual: null,
      feeMode: pricing.feeMode,
      feeBps: pricing.feeBpsApplied,
      feeFixed: pricing.feeFixedApplied,
      feePolicyVersion,
      promoPolicyVersion: null,
      sourceType: SourceType.STORE_ORDER,
      sourceId: String(order.id),
      lineItems: order.lines.map((line) => ({
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        totalAmountCents: line.unitPriceCents * line.quantity,
        currency: order.currency,
        sourceLineId: String(line.id),
      })),
    },
  };
}

async function resolveTicketOrderSnapshot(sourceId: string): Promise<ResolvedSnapshot> {
  const order = await prisma.ticketOrder.findUnique({
    where: { id: sourceId },
    include: { lines: true },
  });
  if (!order) {
    throw new Error("SOURCE_NOT_FOUND");
  }
  if (!order.lines.length) {
    throw new Error("SOURCE_LINES_EMPTY");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: order.organizationId },
  });
  if (!organization) {
    throw new Error("ORGANIZATION_NOT_FOUND");
  }

  const gross = order.lines.reduce((sum, line) => sum + Math.max(0, line.totalAmount), 0);
  const discounts = 0;
  const taxes = 0;

  const platformFees = await getPlatformFees();
  const pricing = computePricing(gross, discounts, {
    organizationFeeMode: organization.feeMode ?? null,
    organizationPlatformFeeBps: organization.platformFeeBps ?? null,
    organizationPlatformFeeFixedCents: organization.platformFeeFixedCents ?? null,
    platformDefaultFeeMode: FeeMode.ADDED,
    platformDefaultFeeBps: platformFees.feeBps,
    platformDefaultFeeFixedCents: platformFees.feeFixedCents,
    isPlatformOrg: organization.orgType === "PLATFORM",
  });

  const feePolicyVersion = hashFeePolicyVersion({
    feeMode: pricing.feeMode,
    feeBps: pricing.feeBpsApplied,
    feeFixed: pricing.feeFixedApplied,
  });

  const netToOrgPending = Math.max(0, gross - pricing.platformFeeCents);

  const ticketTypeIds = order.lines.map((line) => line.ticketTypeId);

  return {
    organizationId: order.organizationId,
    buyerIdentityId: order.buyerIdentityId ?? null,
    eventId: order.eventId,
    ticketTypeIds,
    snapshot: {
      currency: order.currency,
      gross,
      discounts,
      taxes,
      platformFee: pricing.platformFeeCents,
      total: pricing.totalCents,
      netToOrgPending,
      processorFeesStatus: ProcessorFeesStatus.PENDING,
      processorFeesActual: null,
      feeMode: pricing.feeMode,
      feeBps: pricing.feeBpsApplied,
      feeFixed: pricing.feeFixedApplied,
      feePolicyVersion,
      promoPolicyVersion: null,
      sourceType: SourceType.TICKET_ORDER,
      sourceId: order.id,
      lineItems: order.lines.map((line) => ({
        quantity: line.qty,
        unitPriceCents: line.unitAmount,
        totalAmountCents: line.totalAmount,
        currency: order.currency,
        ticketTypeId: line.ticketTypeId,
        sourceLineId: String(line.id),
      })),
    },
  };
}

async function resolvePadelRegistrationSnapshot(sourceId: string): Promise<ResolvedSnapshot> {
  const registration = await prisma.padelRegistration.findUnique({
    where: { id: sourceId },
    include: { lines: true },
  });
  if (!registration) {
    throw new Error("SOURCE_NOT_FOUND");
  }
  if (!registration.lines.length) {
    throw new Error("SOURCE_LINES_EMPTY");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: registration.organizationId },
  });
  if (!organization) {
    throw new Error("ORGANIZATION_NOT_FOUND");
  }

  const gross = registration.lines.reduce((sum, line) => sum + Math.max(0, line.totalAmount), 0);
  const discounts = 0;
  const taxes = 0;

  const platformFees = await getPlatformFees();
  const pricing = computePricing(gross, discounts, {
    organizationFeeMode: organization.feeMode ?? null,
    organizationPlatformFeeBps: organization.platformFeeBps ?? null,
    organizationPlatformFeeFixedCents: organization.platformFeeFixedCents ?? null,
    platformDefaultFeeMode: FeeMode.ADDED,
    platformDefaultFeeBps: platformFees.feeBps,
    platformDefaultFeeFixedCents: platformFees.feeFixedCents,
    isPlatformOrg: organization.orgType === "PLATFORM",
  });

  const feePolicyVersion = hashFeePolicyVersion({
    feeMode: pricing.feeMode,
    feeBps: pricing.feeBpsApplied,
    feeFixed: pricing.feeFixedApplied,
  });

  const netToOrgPending = Math.max(0, gross - pricing.platformFeeCents);

  return {
    organizationId: registration.organizationId,
    buyerIdentityId: registration.buyerIdentityId ?? null,
    eventId: registration.eventId,
    snapshot: {
      currency: registration.currency,
      gross,
      discounts,
      taxes,
      platformFee: pricing.platformFeeCents,
      total: pricing.totalCents,
      netToOrgPending,
      processorFeesStatus: ProcessorFeesStatus.PENDING,
      processorFeesActual: null,
      feeMode: pricing.feeMode,
      feeBps: pricing.feeBpsApplied,
      feeFixed: pricing.feeFixedApplied,
      feePolicyVersion,
      promoPolicyVersion: null,
      sourceType: SourceType.PADEL_REGISTRATION,
      sourceId: registration.id,
      lineItems: registration.lines.map((line) => ({
        quantity: line.qty,
        unitPriceCents: line.unitAmount,
        totalAmountCents: line.totalAmount,
        currency: registration.currency,
        label: line.label,
        sourceLineId: String(line.id),
      })),
    },
  };
}

async function resolvePricingSnapshot(input: CreateCheckoutInput): Promise<ResolvedSnapshot> {
  switch (input.sourceType) {
    case SourceType.BOOKING:
      return resolveBookingSnapshot(input.sourceId);
    case SourceType.STORE_ORDER:
      return resolveStoreOrderSnapshot(input.sourceId);
    case SourceType.TICKET_ORDER:
      return resolveTicketOrderSnapshot(input.sourceId);
    case SourceType.PADEL_REGISTRATION:
      return resolvePadelRegistrationSnapshot(input.sourceId);
    default:
      throw new Error("SOURCE_TYPE_NOT_SUPPORTED");
  }
}

export async function createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutOutput> {
  ensureMvpSourceType(input.sourceType);

  if (!input.idempotencyKey || input.idempotencyKey.trim() === "") {
    throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  }

  const existing = await prisma.payment.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    return {
      paymentId: existing.id,
      status: existing.status,
      clientSecret: null,
      pricingSnapshotHash: existing.pricingSnapshotHash ?? input.pricingSnapshotHash ?? null,
    };
  }

  const resolved = await resolvePricingSnapshot(input);
  const paymentId = crypto.randomUUID();
  const pricingSnapshot = resolved.snapshot;
  const pricingSnapshotHash = hashPricingSnapshot(pricingSnapshot);

  await prisma.$transaction(async (tx) => {
    if (input.sourceType === SourceType.TICKET_ORDER) {
      if (!resolved.eventId) {
        throw new Error("EVENT_ID_REQUIRED");
      }
      const policy = await getLatestPolicyForEvent(resolved.eventId, tx);
      if (policy) {
        if (policy.mode === "INVITE_ONLY" && !input.inviteToken) {
          throw new Error("INVITE_TOKEN_REQUIRED");
        }
        if (input.inviteToken && !policy.inviteTokenAllowed) {
          throw new Error("INVITE_TOKEN_INVALID");
        }
        if (policy.inviteIdentityMatch === "USERNAME") {
          throw new Error("INVITE_TOKEN_INVALID");
        }
        if (!input.buyerIdentityRef && !policy.guestCheckoutAllowed) {
          throw new Error("GUEST_CHECKOUT_NOT_ALLOWED");
        }
        const identity = input.buyerIdentityRef
          ? await tx.emailIdentity.findUnique({
              where: { id: input.buyerIdentityRef },
              select: { emailNormalized: true, userId: true },
            })
          : null;
        const accessDecision = await evaluateEventAccess({
          eventId: resolved.eventId,
          userId: identity?.userId ?? null,
          intent: input.inviteToken ? "INVITE_TOKEN" : "VIEW",
        });
        if (!accessDecision.allowed) {
          const mapped =
            accessDecision.reasonCode === "INVITE_ONLY"
              ? "INVITE_TOKEN_REQUIRED"
              : accessDecision.reasonCode || "ACCESS_DENIED";
          throw new Error(mapped);
        }
        if (input.buyerIdentityRef) {
          if (!identity) {
            throw new Error("INVITE_TOKEN_INVALID");
          }
          const isGuest = !identity.userId;
          if (isGuest && !policy.guestCheckoutAllowed) {
            throw new Error("GUEST_CHECKOUT_NOT_ALLOWED");
          }
          if (input.inviteToken) {
            await consumeInviteToken(
              {
                eventId: resolved.eventId,
                token: input.inviteToken,
                emailNormalized: identity.emailNormalized,
                ticketTypeIds: resolved.ticketTypeIds ?? [],
                usedByIdentityId: input.buyerIdentityRef ?? null,
              },
              tx,
            );
          }
        } else if (input.inviteToken) {
          throw new Error("INVITE_TOKEN_INVALID");
        }
      } else if (input.inviteToken) {
        throw new Error("INVITE_TOKEN_INVALID");
      }
    }

    await tx.payment.create({
      data: {
        id: paymentId,
        organizationId: resolved.organizationId,
        sourceType: pricingSnapshot.sourceType,
        sourceId: pricingSnapshot.sourceId,
        customerIdentityId: input.buyerIdentityRef ?? resolved.buyerIdentityId ?? null,
        status: PaymentStatus.CREATED,
        feePolicyVersion: pricingSnapshot.feePolicyVersion,
        pricingSnapshotJson: pricingSnapshot,
        pricingSnapshotHash,
        processorFeesStatus: ProcessorFeesStatus.PENDING,
        processorFeesActual: null,
        idempotencyKey: input.idempotencyKey,
      },
    });

    const grossEntry = {
      paymentId,
      entryType: LedgerEntryType.GROSS,
      amount: pricingSnapshot.gross,
      currency: pricingSnapshot.currency,
      sourceType: pricingSnapshot.sourceType,
      sourceId: pricingSnapshot.sourceId,
      causationId: `${input.idempotencyKey}:gross`,
      correlationId: input.idempotencyKey,
    };
    const platformFeeEntry = {
      paymentId,
      entryType: LedgerEntryType.PLATFORM_FEE,
      amount: -Math.abs(pricingSnapshot.platformFee),
      currency: pricingSnapshot.currency,
      sourceType: pricingSnapshot.sourceType,
      sourceId: pricingSnapshot.sourceId,
      causationId: `${input.idempotencyKey}:platform_fee`,
      correlationId: input.idempotencyKey,
    };

    await tx.ledgerEntry.createMany({
      data: [grossEntry, platformFeeEntry],
    });
  });

  return {
    paymentId,
    status: PaymentStatus.CREATED,
    clientSecret: null,
    pricingSnapshotHash,
  };
}
