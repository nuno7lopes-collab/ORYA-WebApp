import { prisma } from "@/lib/prisma";
import {
  ConsentStatus,
  ConsentType,
  CrmContactLegalBasis,
  CrmContactType,
  CrmInteractionSource,
  CrmInteractionType,
  Prisma,
} from "@prisma/client";
import { CRM_OUTBOX_EVENTS } from "@/domain/crm/outbox";
import { ensureEmailIdentity, resolveIdentityForUser } from "@/lib/ownership/identity";
import { normalizeEmail } from "@/lib/utils/email";
import { applyLoyaltyForInteraction } from "@/lib/loyalty/engine";

const CRM_EVENT_TYPE_SET = new Set(["crm.interaction", "crm.padel_profile"]);

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

const CUSTOMER_UPGRADE_TYPES = new Set<CrmInteractionType>([
  "STORE_ORDER_PAID",
  "EVENT_TICKET",
  "BOOKING_CONFIRMED",
  "PADEL_MATCH_PAYMENT",
  "PADEL_TOURNAMENT_ENTRY",
]);

type ContactPayload = {
  userId?: string | null;
  emailIdentityId?: string | null;
  email?: string | null;
  phone?: string | null;
  displayName?: string | null;
  contactType?: CrmContactType | string | null;
  legalBasis?: CrmContactLegalBasis | string | null;
  marketingEmailOptIn?: boolean | null;
  marketingPushOptIn?: boolean | null;
  consents?: Array<{
    type?: ConsentType | string | null;
    status?: ConsentStatus | string | null;
    source?: string | null;
    grantedAt?: string | null;
    revokedAt?: string | null;
    expiresAt?: string | null;
  }> | null;
};

type InteractionPayload = {
  type: CrmInteractionType;
  sourceType: CrmInteractionSource;
  sourceId?: string | null;
  externalId?: string | null;
  occurredAt?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ResolvedContact = {
  id: string;
  contactType: CrmContactType;
  emailIdentityId: string | null;
  displayName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
};

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function parseCrmInteractionPayload(raw: Record<string, unknown>) {
  const interactionRaw = (raw.interaction && typeof raw.interaction === "object" ? raw.interaction : raw) as Record<
    string,
    unknown
  >;
  const contactRaw =
    raw.contact && typeof raw.contact === "object" ? (raw.contact as Record<string, unknown>) : {};

  const type =
    typeof interactionRaw.type === "string" && (Object.values(CrmInteractionType) as string[]).includes(interactionRaw.type)
      ? (interactionRaw.type as CrmInteractionType)
      : null;
  const sourceType =
    typeof interactionRaw.sourceType === "string" &&
    (Object.values(CrmInteractionSource) as string[]).includes(interactionRaw.sourceType)
      ? (interactionRaw.sourceType as CrmInteractionSource)
      : null;

  if (!type || !sourceType) return null;

  const interaction: InteractionPayload = {
    type,
    sourceType,
    sourceId: typeof interactionRaw.sourceId === "string" ? interactionRaw.sourceId : null,
    externalId: typeof interactionRaw.externalId === "string" ? interactionRaw.externalId : null,
    occurredAt: typeof interactionRaw.occurredAt === "string" ? interactionRaw.occurredAt : null,
    amountCents: typeof interactionRaw.amountCents === "number" ? interactionRaw.amountCents : null,
    currency: typeof interactionRaw.currency === "string" ? interactionRaw.currency : null,
    metadata:
      interactionRaw.metadata && typeof interactionRaw.metadata === "object" && !Array.isArray(interactionRaw.metadata)
        ? (interactionRaw.metadata as Record<string, unknown>)
        : null,
  };

  const contact: ContactPayload = {
    userId: typeof contactRaw.userId === "string" ? contactRaw.userId : null,
    emailIdentityId: typeof contactRaw.emailIdentityId === "string" ? contactRaw.emailIdentityId : null,
    email: typeof contactRaw.email === "string" ? contactRaw.email : null,
    phone: typeof contactRaw.phone === "string" ? contactRaw.phone : null,
    displayName: typeof contactRaw.displayName === "string" ? contactRaw.displayName : null,
    contactType: typeof contactRaw.contactType === "string" ? contactRaw.contactType : null,
    legalBasis: typeof contactRaw.legalBasis === "string" ? contactRaw.legalBasis : null,
    marketingEmailOptIn: typeof contactRaw.marketingEmailOptIn === "boolean" ? contactRaw.marketingEmailOptIn : null,
    marketingPushOptIn: typeof contactRaw.marketingPushOptIn === "boolean" ? contactRaw.marketingPushOptIn : null,
    consents: Array.isArray(contactRaw.consents)
      ? (contactRaw.consents as ContactPayload["consents"]) ?? null
      : null,
  };

  return { interaction, contact };
}

function resolveContactType(params: {
  existingType?: CrmContactType | null;
  incomingType?: CrmContactType | null;
}): CrmContactType | null {
  const priority: Record<CrmContactType, number> = {
    CUSTOMER: 5,
    STAFF: 4,
    FOLLOWER: 3,
    LEAD: 2,
    GUEST: 1,
  };

  const { existingType, incomingType } = params;
  if (!existingType && incomingType) return incomingType;
  if (!incomingType) return existingType ?? null;
  return priority[incomingType] > priority[existingType ?? incomingType] ? incomingType : existingType ?? incomingType;
}

async function mergeContacts(params: {
  primaryId: string;
  secondaryId: string;
  organizationId: number;
}) {
  const { primaryId, secondaryId, organizationId } = params;

  const secondaryConsents = await prisma.crmContactConsent.findMany({
    where: { contactId: secondaryId },
  });
  for (const consent of secondaryConsents) {
    await prisma.crmContactConsent.upsert({
      where: {
        organizationId_contactId_type: {
          organizationId,
          contactId: primaryId,
          type: consent.type,
        },
      },
      update: {
        status: consent.status,
        source: consent.source ?? undefined,
        grantedAt: consent.grantedAt,
        revokedAt: consent.revokedAt,
        expiresAt: consent.expiresAt,
      },
      create: {
        organizationId,
        contactId: primaryId,
        type: consent.type,
        status: consent.status,
        source: consent.source ?? undefined,
        grantedAt: consent.grantedAt,
        revokedAt: consent.revokedAt,
        expiresAt: consent.expiresAt,
      },
    });
  }

  await prisma.crmContactConsent.deleteMany({ where: { contactId: secondaryId } });
  await prisma.crmContactNote.updateMany({ where: { contactId: secondaryId }, data: { contactId: primaryId } });
  await prisma.crmInteraction.updateMany({ where: { contactId: secondaryId }, data: { contactId: primaryId } });
  await prisma.crmCampaignDelivery.updateMany({ where: { contactId: secondaryId }, data: { contactId: primaryId } });
  await prisma.padelPlayerProfile.updateMany({ where: { crmContactId: secondaryId }, data: { crmContactId: primaryId } });

  const primaryPadel = await prisma.crmContactPadel.findUnique({ where: { contactId: primaryId } });
  const secondaryPadel = await prisma.crmContactPadel.findUnique({ where: { contactId: secondaryId } });
  if (secondaryPadel) {
    if (!primaryPadel) {
      await prisma.crmContactPadel.update({
        where: { id: secondaryPadel.id },
        data: { contactId: primaryId },
      });
    } else {
      await prisma.crmContactPadel.delete({ where: { id: secondaryPadel.id } });
    }
  }

  await prisma.crmContact.delete({ where: { id: secondaryId } });
}

async function resolveContact(params: {
  organizationId: number;
  interactionType: CrmInteractionType;
  contact: ContactPayload;
}): Promise<{
  contact: ResolvedContact;
  emailIdentityId: string | null;
  created: boolean;
}> {
  const { organizationId, interactionType, contact } = params;
  const userId = contact.userId ?? null;
  const contactSelect = {
    id: true,
    contactType: true,
    emailIdentityId: true,
    displayName: true,
    contactEmail: true,
    contactPhone: true,
  } satisfies Prisma.CrmContactSelect;

  let emailIdentityId = contact.emailIdentityId ?? null;
  const normalizedEmail = normalizeEmail(contact.email ?? null);

  if (!emailIdentityId && userId) {
    const resolved = await resolveIdentityForUser({ userId });
    emailIdentityId = resolved.id ?? null;
  } else if (!emailIdentityId && normalizedEmail) {
    const resolved = await ensureEmailIdentity({ email: normalizedEmail });
    emailIdentityId = resolved.id ?? null;
  }

  const contactByUser = userId
    ? await prisma.crmContact.findFirst({
        where: { organizationId, userId },
        select: contactSelect,
      })
    : null;
  const contactByIdentity = emailIdentityId
    ? await prisma.crmContact.findFirst({
        where: { organizationId, emailIdentityId },
        select: contactSelect,
      })
    : null;

  if (contactByUser && contactByIdentity && contactByUser.id !== contactByIdentity.id) {
    await mergeContacts({
      primaryId: contactByUser.id,
      secondaryId: contactByIdentity.id,
      organizationId,
    });
  }

  const existing = contactByUser || contactByIdentity;

  const incomingTypeRaw = contact.contactType;
  const incomingType =
    typeof incomingTypeRaw === "string" && (Object.values(CrmContactType) as string[]).includes(incomingTypeRaw)
      ? (incomingTypeRaw as CrmContactType)
      : null;

  const derivedType =
    incomingType ??
    (userId
      ? CUSTOMER_UPGRADE_TYPES.has(interactionType)
        ? CrmContactType.CUSTOMER
        : CrmContactType.LEAD
      : CrmContactType.GUEST);

  const resolvedType = resolveContactType({
    existingType: existing?.contactType ?? null,
    incomingType: derivedType,
  });

  const legalBasisRaw = contact.legalBasis;
  const legalBasis =
    typeof legalBasisRaw === "string" && (Object.values(CrmContactLegalBasis) as string[]).includes(legalBasisRaw)
      ? (legalBasisRaw as CrmContactLegalBasis)
      : null;

  const displayName = contact.displayName?.trim() || null;

  if (existing) {
    const updates: Prisma.CrmContactUpdateInput = {
      ...(resolvedType ? { contactType: resolvedType } : {}),
      ...(legalBasis ? { legalBasis } : {}),
      ...(emailIdentityId && !existing.emailIdentityId ? { emailIdentityId } : {}),
    };
    if (displayName && (!existing.displayName || existing.displayName.trim() === "")) {
      updates.displayName = displayName;
    }
    const updatedContact = Object.keys(updates).length
      ? await prisma.crmContact.update({ where: { id: existing.id }, data: updates, select: contactSelect })
      : existing;
    return { contact: updatedContact, emailIdentityId, created: false };
  }

  const created = await prisma.crmContact.create({
    select: contactSelect,
    data: {
      organizationId,
      userId: userId ?? undefined,
      emailIdentityId: emailIdentityId ?? undefined,
      status: "ACTIVE",
      contactType: resolvedType ?? CrmContactType.LEAD,
      displayName: displayName || undefined,
      legalBasis: legalBasis ?? undefined,
    },
  });

  return { contact: created, emailIdentityId, created: true };
}

async function resolveContactConsents(params: {
  organizationId: number;
  contactId: string;
  userId?: string | null;
  providedConsents?: ContactPayload["consents"];
}) {
  const { organizationId, contactId, userId, providedConsents } = params;

  let emailStatus: ConsentStatus | null = null;
  let smsStatus: ConsentStatus | null = null;
  let marketingStatus: ConsentStatus | null = null;

  if (userId) {
    const rows = await prisma.userConsent.findMany({
      where: {
        organizationId,
        userId,
        type: { in: [ConsentType.CONTACT_EMAIL, ConsentType.CONTACT_SMS, ConsentType.MARKETING] },
      },
      select: { type: true, status: true, source: true, grantedAt: true, revokedAt: true, expiresAt: true },
    });
    for (const row of rows) {
      if (row.type === ConsentType.CONTACT_EMAIL) emailStatus = row.status;
      if (row.type === ConsentType.CONTACT_SMS) smsStatus = row.status;
      if (row.type === ConsentType.MARKETING) marketingStatus = row.status;

      await prisma.crmContactConsent.upsert({
        where: {
          organizationId_contactId_type: { organizationId, contactId, type: row.type },
        },
        update: {
          status: row.status,
          source: row.source ?? undefined,
          grantedAt: row.grantedAt,
          revokedAt: row.revokedAt,
          expiresAt: row.expiresAt,
        },
        create: {
          organizationId,
          contactId,
          type: row.type,
          status: row.status,
          source: row.source ?? undefined,
          grantedAt: row.grantedAt,
          revokedAt: row.revokedAt,
          expiresAt: row.expiresAt,
        },
      });
    }
  } else if (providedConsents && providedConsents.length > 0) {
    for (const consent of providedConsents) {
      const type =
        typeof consent.type === "string" && (Object.values(ConsentType) as string[]).includes(consent.type)
          ? (consent.type as ConsentType)
          : null;
      const status =
        typeof consent.status === "string" && (Object.values(ConsentStatus) as string[]).includes(consent.status)
          ? (consent.status as ConsentStatus)
          : null;
      if (!type || !status) continue;

      if (type === ConsentType.CONTACT_EMAIL) emailStatus = status;
      if (type === ConsentType.CONTACT_SMS) smsStatus = status;
      if (type === ConsentType.MARKETING) marketingStatus = status;

      await prisma.crmContactConsent.upsert({
        where: {
          organizationId_contactId_type: { organizationId, contactId, type },
        },
        update: {
          status,
          source: consent.source ?? undefined,
          grantedAt: parseDate(consent.grantedAt),
          revokedAt: parseDate(consent.revokedAt),
          expiresAt: parseDate(consent.expiresAt),
        },
        create: {
          organizationId,
          contactId,
          type,
          status,
          source: consent.source ?? undefined,
          grantedAt: parseDate(consent.grantedAt),
          revokedAt: parseDate(consent.revokedAt),
          expiresAt: parseDate(consent.expiresAt),
        },
      });
    }
  }

  return { emailStatus, smsStatus, marketingStatus };
}

async function updateContactReadModel(params: {
  contactId: string;
  organizationId: number;
  interaction: InteractionPayload;
  occurredAt: Date;
  amountCents: number | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  marketingEmailOptIn?: boolean | null;
  marketingPushOptIn?: boolean | null;
}) {
  const { contactId, organizationId, interaction, occurredAt, amountCents } = params;

  const existing = await prisma.crmContact.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      firstInteractionAt: true,
      lastActivityAt: true,
      lastPurchaseAt: true,
      totalSpentCents: true,
      totalOrders: true,
      totalBookings: true,
      totalAttendances: true,
      totalTournaments: true,
      totalStoreOrders: true,
      sourceType: true,
      sourceId: true,
      externalId: true,
      contactEmail: true,
      contactPhone: true,
    },
  });
  if (!existing) return null;

  const updates: Prisma.CrmContactUpdateInput = {};

  if (!existing.firstInteractionAt || occurredAt < existing.firstInteractionAt) {
    updates.firstInteractionAt = occurredAt;
  }
  if (!existing.lastActivityAt || occurredAt > existing.lastActivityAt) {
    updates.lastActivityAt = occurredAt;
  }
  if (PURCHASE_TYPES.has(interaction.type) && (!existing.lastPurchaseAt || occurredAt > existing.lastPurchaseAt)) {
    updates.lastPurchaseAt = occurredAt;
  }

  if (SPEND_TYPES.has(interaction.type) && typeof amountCents === "number") {
    updates.totalSpentCents = { increment: amountCents };
  }
  if (interaction.type === "STORE_ORDER_PAID") updates.totalStoreOrders = { increment: 1 };
  if (interaction.type === "EVENT_TICKET") updates.totalOrders = { increment: 1 };
  if (interaction.type === "BOOKING_CONFIRMED") updates.totalBookings = { increment: 1 };
  if (interaction.type === "EVENT_CHECKIN") updates.totalAttendances = { increment: 1 };
  if (interaction.type === "PADEL_TOURNAMENT_ENTRY") updates.totalTournaments = { increment: 1 };

  if (params.contactEmail !== undefined) {
    updates.contactEmail = params.contactEmail;
  }
  if (params.contactPhone !== undefined) {
    updates.contactPhone = params.contactPhone;
  }
  if (typeof params.marketingEmailOptIn === "boolean") {
    updates.marketingEmailOptIn = params.marketingEmailOptIn;
  }
  if (typeof params.marketingPushOptIn === "boolean") {
    updates.marketingPushOptIn = params.marketingPushOptIn;
  }
  if (!existing.sourceType) {
    updates.sourceType = interaction.sourceType;
  }
  if (!existing.sourceId && interaction.sourceId) {
    updates.sourceId = interaction.sourceId;
  }
  if (!existing.externalId && interaction.externalId) {
    updates.externalId = interaction.externalId;
  }

  if (Object.keys(updates).length) {
    await prisma.crmContact.update({ where: { id: contactId }, data: updates });
  }

  return {
    totals: {
      totalSpentCents:
        existing.totalSpentCents + (SPEND_TYPES.has(interaction.type) && amountCents ? amountCents : 0),
      totalOrders: existing.totalOrders + (interaction.type === "EVENT_TICKET" ? 1 : 0),
      totalBookings: existing.totalBookings + (interaction.type === "BOOKING_CONFIRMED" ? 1 : 0),
      totalAttendances: existing.totalAttendances + (interaction.type === "EVENT_CHECKIN" ? 1 : 0),
      totalTournaments: existing.totalTournaments + (interaction.type === "PADEL_TOURNAMENT_ENTRY" ? 1 : 0),
      totalStoreOrders: existing.totalStoreOrders + (interaction.type === "STORE_ORDER_PAID" ? 1 : 0),
    },
  };
}

async function computePadelNoShows(pairingIds: number[]) {
  if (!pairingIds.length) return 0;
  const walkovers = await prisma.eventMatchSlot.findMany({
    where: {
      status: "DONE",
      OR: [{ pairingAId: { in: pairingIds } }, { pairingBId: { in: pairingIds } }],
    },
    select: { pairingAId: true, pairingBId: true, score: true },
  });
  let count = 0;
  walkovers.forEach((match) => {
    const score = match.score && typeof match.score === "object" ? (match.score as Record<string, unknown>) : {};
    const resultType = typeof score.resultType === "string" ? score.resultType : null;
    const isWalkover = score.walkover === true || resultType === "WALKOVER";
    if (!isWalkover) return;
    const winnerSide = typeof score.winnerSide === "string" ? score.winnerSide : null;
    if (winnerSide !== "A" && winnerSide !== "B") return;
    const loserPairingId = winnerSide === "A" ? match.pairingBId : match.pairingAId;
    if (loserPairingId && pairingIds.includes(loserPairingId)) count += 1;
  });
  return count;
}

async function handlePadelProfileEvent(log: { id: string; organizationId: number; payload: Prisma.JsonValue }) {
  const payload = (log.payload ?? {}) as Record<string, unknown>;
  const playerProfileId =
    typeof payload.playerProfileId === "number"
      ? payload.playerProfileId
      : typeof payload.playerProfileId === "string"
        ? Number(payload.playerProfileId)
        : null;
  if (!playerProfileId || !Number.isFinite(playerProfileId)) {
    return { ok: false, code: "PADEL_PROFILE_ID_MISSING" } as const;
  }

  const profile = await prisma.padelPlayerProfile.findUnique({
    where: { id: playerProfileId },
    select: {
      id: true,
      organizationId: true,
      userId: true,
      fullName: true,
      email: true,
      phone: true,
      level: true,
      preferredSide: true,
      clubName: true,
    },
  });
  if (!profile) return { ok: false, code: "PADEL_PROFILE_NOT_FOUND" } as const;

  let contactResult:
    | { contact: ResolvedContact; emailIdentityId: string | null; created: boolean }
    | null = null;

  if (!profile.userId) {
    const normalizedEmail = normalizeEmail(profile.email ?? null);
    if (!normalizedEmail) return { ok: true, deduped: true } as const;
    const identity = await prisma.emailIdentity.findUnique({
      where: { emailNormalized: normalizedEmail },
      select: { id: true },
    });
    if (!identity) return { ok: true, deduped: true } as const;
    const existingContact = await prisma.crmContact.findFirst({
      where: { organizationId: profile.organizationId, emailIdentityId: identity.id },
      select: { id: true, displayName: true },
    });
    if (!existingContact) return { ok: true, deduped: true } as const;
    contactResult = {
      contact: {
        id: existingContact.id,
        contactType: CrmContactType.LEAD,
        emailIdentityId: identity.id,
        displayName: existingContact.displayName ?? null,
        contactEmail: null,
        contactPhone: null,
      },
      emailIdentityId: identity.id,
      created: false,
    };
  } else {
    contactResult = await resolveContact({
      organizationId: profile.organizationId,
      interactionType: CrmInteractionType.FORM_SUBMITTED,
      contact: {
        userId: profile.userId ?? null,
        email: profile.email ?? null,
        phone: profile.phone ?? null,
        displayName: profile.fullName ?? null,
        contactType: profile.userId ? CrmContactType.CUSTOMER : CrmContactType.LEAD,
      },
    });
  }

  if (!contactResult || !contactResult.contact?.id) return { ok: true, deduped: true } as const;

  await prisma.padelPlayerProfile.updateMany({
    where: { id: profile.id, crmContactId: { not: contactResult.contact.id } },
    data: { crmContactId: contactResult.contact.id },
  });

  const pairingSlots = await prisma.padelPairingSlot.findMany({
    where: { playerProfileId: profile.id },
    select: { pairingId: true },
  });
  const pairingIds = Array.from(
    new Set(pairingSlots.map((slot) => slot.pairingId).filter((id): id is number => Boolean(id))),
  );
  const tournamentsCount = pairingIds.length;
  const noShowCount = await computePadelNoShows(pairingIds);

  await prisma.crmContactPadel.upsert({
    where: { contactId: contactResult.contact.id },
    update: {
      organizationId: profile.organizationId,
      playerProfileId: profile.id,
      level: profile.level ?? null,
      preferredSide: profile.preferredSide ?? null,
      clubName: profile.clubName ?? null,
      tournamentsCount,
      noShowCount,
    },
    create: {
      organizationId: profile.organizationId,
      contactId: contactResult.contact.id,
      playerProfileId: profile.id,
      level: profile.level ?? null,
      preferredSide: profile.preferredSide ?? null,
      clubName: profile.clubName ?? null,
      tournamentsCount,
      noShowCount,
    },
  });

  return { ok: true } as const;
}

export async function consumeCrmEventLog(eventLogId: string) {
  const log = await prisma.eventLog.findUnique({ where: { id: eventLogId } });
  if (!log) return { ok: false, code: "EVENTLOG_NOT_FOUND" } as const;
  if (!CRM_EVENT_TYPE_SET.has(log.eventType)) return { ok: true, deduped: true } as const;

  if (log.eventType === "crm.padel_profile") {
    return handlePadelProfileEvent({ id: log.id, organizationId: log.organizationId, payload: log.payload });
  }

  const payload = (log.payload ?? {}) as Record<string, unknown>;
  const parsed = parseCrmInteractionPayload(payload);
  if (!parsed) return { ok: false, code: "CRM_PAYLOAD_INVALID" } as const;

  const { interaction, contact } = parsed;
  const resolvedUserId = contact.userId ?? log.actorUserId ?? null;
  const providedConsents = contact.consents ?? [];
  let hasGuestConsent = resolvedUserId
    ? true
    : providedConsents.some((consent) => {
        const type =
          typeof consent?.type === "string" && (Object.values(ConsentType) as string[]).includes(consent.type)
            ? (consent.type as ConsentType)
            : null;
        const status =
          typeof consent?.status === "string" && (Object.values(ConsentStatus) as string[]).includes(consent.status)
            ? (consent.status as ConsentStatus)
            : null;
        return (
          status === ConsentStatus.GRANTED &&
          (type === ConsentType.CONTACT_EMAIL || type === ConsentType.CONTACT_SMS)
        );
      });

  if (!resolvedUserId && !hasGuestConsent) {
    const normalizedEmail = normalizeEmail(contact.email ?? null);
    const identityId =
      contact.emailIdentityId ??
      (normalizedEmail
        ? (await prisma.emailIdentity.findUnique({
            where: { emailNormalized: normalizedEmail },
            select: { id: true },
          }))?.id ?? null
        : null);

    if (identityId) {
      const existingContact = await prisma.crmContact.findFirst({
        where: { organizationId: log.organizationId, emailIdentityId: identityId },
        select: { id: true },
      });
      if (existingContact) {
        const consent = await prisma.crmContactConsent.findFirst({
          where: {
            organizationId: log.organizationId,
            contactId: existingContact.id,
            type: { in: [ConsentType.CONTACT_EMAIL, ConsentType.CONTACT_SMS] },
            status: ConsentStatus.GRANTED,
          },
          select: { id: true },
        });
        if (consent) {
          hasGuestConsent = true;
        }
      }
    }
  }

  if (!resolvedUserId && !hasGuestConsent) {
    return { ok: true, deduped: true } as const;
  }
  const occurredAt = parseDate(interaction.occurredAt) ?? log.createdAt ?? new Date();
  const currency = interaction.currency ? interaction.currency.toUpperCase() : "EUR";
  const amountCents = typeof interaction.amountCents === "number" ? interaction.amountCents : null;

  const contactResult = await resolveContact({
    organizationId: log.organizationId,
    interactionType: interaction.type,
    contact: {
      ...contact,
      userId: resolvedUserId,
    },
  });

  if (!contactResult.contact?.id) {
    return { ok: true, deduped: true } as const;
  }

  const contactId = contactResult.contact.id;

  if (interaction.externalId) {
    const existingByExternal = await prisma.crmInteraction.findFirst({
      where: { organizationId: log.organizationId, externalId: interaction.externalId },
      select: { id: true },
    });
    if (existingByExternal) {
      return { ok: true, deduped: true } as const;
    }
  }

  const existingByEvent = await prisma.crmInteraction.findUnique({
    where: { eventId: log.id },
    select: { id: true },
  });
  if (existingByEvent) {
    return { ok: true, deduped: true } as const;
  }

  const consentSnapshot = await resolveContactConsents({
    organizationId: log.organizationId,
    contactId,
    userId: resolvedUserId,
    providedConsents: contact.consents ?? undefined,
  });

  let contactEmailValue: string | null | undefined = undefined;
  let contactPhoneValue: string | null | undefined = undefined;
  let displayNameValue = contact.displayName?.trim() || null;

  if (!displayNameValue && resolvedUserId) {
    const profile = await prisma.profile.findUnique({
      where: { id: resolvedUserId },
      select: { fullName: true, username: true, contactPhone: true },
    });
    const authUser = await prisma.users.findUnique({
      where: { id: resolvedUserId },
      select: { email: true },
    });
    if (!displayNameValue) {
      displayNameValue = profile?.fullName || profile?.username || null;
    }
    if (!contact.email && authUser?.email) {
      contact.email = authUser.email;
    }
    if (!contact.phone && profile?.contactPhone) {
      contact.phone = profile.contactPhone;
    }
  }

  if (consentSnapshot.emailStatus === ConsentStatus.GRANTED) {
    contactEmailValue = contact.email ?? contactResult.contact.contactEmail ?? null;
  } else if (consentSnapshot.emailStatus === ConsentStatus.REVOKED || consentSnapshot.emailStatus === ConsentStatus.EXPIRED) {
    contactEmailValue = null;
  }

  if (consentSnapshot.smsStatus === ConsentStatus.GRANTED) {
    contactPhoneValue = contact.phone ?? contactResult.contact.contactPhone ?? null;
  } else if (consentSnapshot.smsStatus === ConsentStatus.REVOKED || consentSnapshot.smsStatus === ConsentStatus.EXPIRED) {
    contactPhoneValue = null;
  }

  const marketingOptIn = consentSnapshot.marketingStatus === ConsentStatus.GRANTED ? true : null;

  try {
    await prisma.crmInteraction.create({
      data: {
        organizationId: log.organizationId,
        contactId,
        userId: contact.userId ?? log.actorUserId ?? undefined,
        eventId: log.id,
        externalId: interaction.externalId ?? undefined,
        type: interaction.type,
        sourceType: interaction.sourceType,
        sourceId: interaction.sourceId ?? undefined,
        occurredAt,
        amountCents: amountCents ?? undefined,
        currency,
        metadata: (interaction.metadata ?? {}) as Prisma.JsonObject,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: true, deduped: true } as const;
    }
    throw err;
  }

  const contactTotals = await updateContactReadModel({
    contactId,
    organizationId: log.organizationId,
    interaction,
    occurredAt,
    amountCents,
    contactEmail: contactEmailValue,
    contactPhone: contactPhoneValue,
    marketingEmailOptIn: marketingOptIn ?? contact.marketingEmailOptIn ?? null,
    marketingPushOptIn: contact.marketingPushOptIn ?? null,
  });

  if (displayNameValue && (!contactResult.contact.displayName || contactResult.contact.displayName.trim() === "")) {
    await prisma.crmContact.update({
      where: { id: contactId },
      data: { displayName: displayNameValue },
    });
  }

  if (resolvedUserId) {
    await applyLoyaltyForInteraction({
      organizationId: log.organizationId,
      userId: resolvedUserId,
      interactionType: interaction.type,
      sourceId: interaction.sourceId ?? null,
      occurredAt,
      amountCents: amountCents ?? null,
      customerSnapshot: {
        totalSpentCents: contactTotals?.totals.totalSpentCents ?? 0,
        totalOrders: contactTotals?.totals.totalOrders ?? 0,
        totalBookings: contactTotals?.totals.totalBookings ?? 0,
        totalAttendances: contactTotals?.totals.totalAttendances ?? 0,
        totalTournaments: contactTotals?.totals.totalTournaments ?? 0,
        totalStoreOrders: contactTotals?.totals.totalStoreOrders ?? 0,
        tags: [],
      },
    });
  }

  return { ok: true } as const;
}

export async function handleCrmOutboxEvent(params: { eventType: string; payload: Record<string, unknown> }) {
  if (params.eventType !== CRM_OUTBOX_EVENTS.INGEST_REQUESTED) {
    return { ok: true, deduped: true } as const;
  }
  const eventLogId = typeof params.payload.eventId === "string" ? params.payload.eventId : null;
  if (!eventLogId) return { ok: false, code: "CRM_EVENT_ID_MISSING" } as const;
  return consumeCrmEventLog(eventLogId);
}

export const CRM_EVENT_TYPES = Array.from(CRM_EVENT_TYPE_SET);
