import { prisma } from "@/lib/prisma";
import {
  ConsentStatus,
  ConsentType,
  CrmInteractionSource,
  CrmInteractionType,
  Prisma,
} from "@prisma/client";
import { applyLoyaltyForInteraction } from "@/lib/loyalty/engine";

export type CrmIngestInput = {
  organizationId: number;
  userId: string;
  type: CrmInteractionType;
  sourceType: CrmInteractionSource;
  sourceId?: string | null;
  occurredAt?: Date;
  amountCents?: number | null;
  currency?: string | null;
  metadata?: Record<string, unknown> | null;
  displayName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

const SPEND_TYPES = new Set<CrmInteractionType>([
  "STORE_ORDER_PAID",
  "EVENT_TICKET",
  "BOOKING_CONFIRMED",
  "PADEL_MATCH_PAYMENT",
]);

const PURCHASE_TYPES = new Set<CrmInteractionType>([
  "STORE_ORDER_PAID",
  "EVENT_TICKET",
  "BOOKING_CONFIRMED",
  "PADEL_MATCH_PAYMENT",
]);

export async function ingestCrmInteraction(input: CrmIngestInput): Promise<{ customerId: string; deduped: boolean }> {
  const occurredAt = input.occurredAt ?? new Date();
  const metadata = input.metadata && typeof input.metadata === "object" ? input.metadata : {};
  const currency = input.currency ? input.currency.toUpperCase() : "EUR";

  const existingCustomer = await prisma.crmCustomer.findUnique({
    where: { organizationId_userId: { organizationId: input.organizationId, userId: input.userId } },
    select: {
      id: true,
      displayName: true,
      contactEmail: true,
      contactPhone: true,
      firstInteractionAt: true,
      lastActivityAt: true,
      lastPurchaseAt: true,
      totalSpentCents: true,
      totalOrders: true,
      totalBookings: true,
      totalAttendances: true,
      totalTournaments: true,
      totalStoreOrders: true,
      tags: true,
    },
  });

  let displayName = typeof input.displayName === "string" ? input.displayName.trim() : null;
  let contactEmail = typeof input.contactEmail === "string" ? input.contactEmail.trim() : null;
  let contactPhone = typeof input.contactPhone === "string" ? input.contactPhone.trim() : null;

  if (!displayName || (!contactEmail && !contactPhone)) {
    const profile = await prisma.profile.findUnique({
      where: { id: input.userId },
      select: { fullName: true, username: true, contactPhone: true, users: { select: { email: true } } },
    });
    if (!displayName) {
      displayName = profile?.fullName || profile?.username || null;
    }
    if (!contactEmail) {
      contactEmail = profile?.users?.email ?? null;
    }
    if (!contactPhone) {
      contactPhone = profile?.contactPhone ?? null;
    }
  }

  const needsConsentCheck = Boolean(
    contactEmail ||
      contactPhone ||
      existingCustomer?.contactEmail ||
      existingCustomer?.contactPhone,
  );

  let emailOk: boolean | null = null;
  let phoneOk: boolean | null = null;
  if (needsConsentCheck) {
    const consentEntries = await prisma.userConsent.findMany({
      where: {
        organizationId: input.organizationId,
        userId: input.userId,
        type: { in: [ConsentType.CONTACT_EMAIL, ConsentType.CONTACT_SMS] },
      },
      select: { type: true, status: true },
    });
    const consentMap = new Map<ConsentType, ConsentStatus>();
    for (const consent of consentEntries) {
      consentMap.set(consent.type, consent.status);
    }
    emailOk = consentMap.get(ConsentType.CONTACT_EMAIL) === ConsentStatus.GRANTED;
    phoneOk = consentMap.get(ConsentType.CONTACT_SMS) === ConsentStatus.GRANTED;
  }

  if (emailOk === false) {
    contactEmail = null;
  }
  if (phoneOk === false) {
    contactPhone = null;
  }

  const contactEmailValue =
    emailOk === null
      ? undefined
      : emailOk
        ? existingCustomer?.contactEmail || contactEmail || undefined
        : null;
  const contactPhoneValue =
    phoneOk === null
      ? undefined
      : phoneOk
        ? existingCustomer?.contactPhone || contactPhone || undefined
        : null;

  const customer = existingCustomer
    ? await prisma.crmCustomer.update({
        where: { organizationId_userId: { organizationId: input.organizationId, userId: input.userId } },
        data: {
          displayName: existingCustomer.displayName || displayName || undefined,
          ...(contactEmailValue !== undefined ? { contactEmail: contactEmailValue } : {}),
          ...(contactPhoneValue !== undefined ? { contactPhone: contactPhoneValue } : {}),
        },
      })
    : await prisma.crmCustomer.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId,
          displayName: displayName || undefined,
          contactEmail: emailAllowed ? contactEmail || undefined : undefined,
          contactPhone: phoneAllowed ? contactPhone || undefined : undefined,
          firstInteractionAt: occurredAt,
          lastActivityAt: occurredAt,
          lastPurchaseAt: PURCHASE_TYPES.has(input.type) ? occurredAt : null,
        },
      });

  let createdInteraction = true;
  if (input.sourceId) {
    const existingInteraction = await prisma.crmInteraction.findUnique({
      where: {
        organizationId_sourceType_sourceId_type: {
          organizationId: input.organizationId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          type: input.type,
        },
      },
      select: { id: true },
    });
    if (existingInteraction) {
      createdInteraction = false;
    }
  }

  if (createdInteraction) {
    try {
      await prisma.crmInteraction.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId,
          type: input.type,
          sourceType: input.sourceType,
          sourceId: input.sourceId ?? undefined,
          occurredAt,
          amountCents: input.amountCents ?? undefined,
          currency,
          metadata: metadata as Prisma.JsonObject,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        createdInteraction = false;
      } else {
        throw err;
      }
    }
  }

  if (createdInteraction) {
    const updates: Prisma.CrmCustomerUpdateInput = {};
    const totals = {
      totalSpentCents: existingCustomer?.totalSpentCents ?? 0,
      totalOrders: existingCustomer?.totalOrders ?? 0,
      totalBookings: existingCustomer?.totalBookings ?? 0,
      totalAttendances: existingCustomer?.totalAttendances ?? 0,
      totalTournaments: existingCustomer?.totalTournaments ?? 0,
      totalStoreOrders: existingCustomer?.totalStoreOrders ?? 0,
    };

    if (!existingCustomer?.firstInteractionAt || occurredAt < existingCustomer.firstInteractionAt) {
      updates.firstInteractionAt = occurredAt;
    }
    if (!existingCustomer?.lastActivityAt || occurredAt > existingCustomer.lastActivityAt) {
      updates.lastActivityAt = occurredAt;
    }
    if (PURCHASE_TYPES.has(input.type) && (!existingCustomer?.lastPurchaseAt || occurredAt > existingCustomer.lastPurchaseAt)) {
      updates.lastPurchaseAt = occurredAt;
    }

    if (SPEND_TYPES.has(input.type) && typeof input.amountCents === "number") {
      updates.totalSpentCents = { increment: input.amountCents };
      totals.totalSpentCents += input.amountCents;
    }

    if (input.type === "STORE_ORDER_PAID") {
      updates.totalStoreOrders = { increment: 1 };
      totals.totalStoreOrders += 1;
    }
    if (input.type === "EVENT_TICKET") {
      updates.totalOrders = { increment: 1 };
      totals.totalOrders += 1;
    }
    if (input.type === "BOOKING_CONFIRMED") {
      updates.totalBookings = { increment: 1 };
      totals.totalBookings += 1;
    }
    if (input.type === "EVENT_CHECKIN") {
      updates.totalAttendances = { increment: 1 };
      totals.totalAttendances += 1;
    }
    if (input.type === "PADEL_TOURNAMENT_ENTRY") {
      updates.totalTournaments = { increment: 1 };
      totals.totalTournaments += 1;
    }

    if (Object.keys(updates).length) {
      await prisma.crmCustomer.update({
        where: { organizationId_userId: { organizationId: input.organizationId, userId: input.userId } },
        data: updates,
      });
    }

    await applyLoyaltyForInteraction({
      organizationId: input.organizationId,
      userId: input.userId,
      interactionType: input.type,
      sourceId: input.sourceId ?? null,
      occurredAt,
      amountCents: input.amountCents ?? null,
      customerSnapshot: {
        ...totals,
        tags: existingCustomer?.tags ?? [],
      },
    });
  }

  return { customerId: customer.id, deduped: !createdInteraction };
}
