import fs from "node:fs";
import path from "node:path";
import {
  ConsentStatus,
  ConsentType,
  CrmCampaignApprovalState,
  CrmCampaignStatus,
  CrmContactType,
  CrmInteractionSource,
  CrmInteractionType,
  CrmJourneyRunStatus,
  CrmJourneyStatus,
  CrmJourneyStepType,
  LoyaltyProgramStatus,
  LoyaltyRewardType,
  LoyaltyRuleTrigger,
  OrganizationModule,
  OrganizationStatus,
  PadelPreferredSide,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const loadEnvFile = (file: string) => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
};

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Falta DATABASE_URL ou DIRECT_URL.");
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

const requestedUsername = (process.env.TOP_PADEL_USERNAME ?? "top_padel").trim().toLowerCase();
const candidateUsernames = Array.from(new Set([requestedUsername, "top_padel", "top-padel", "toppadel"]));
const supportEmail = (process.env.TOP_PADEL_SUPPORT_EMAIL ?? "crm@top-padel.test").trim().toLowerCase();
const seedActorUserIdFromEnv = (process.env.TOP_PADEL_SEED_ACTOR_USER_ID ?? "").trim() || null;

const DEMO_SEGMENT_PREFIX = "[DEMO] ";
const DEMO_CAMPAIGN_PREFIX = "[DEMO] ";
const DEMO_JOURNEY_PREFIX = "[DEMO] ";
const DEMO_NOTE_PREFIX = "[DEMO TOP PADEL]";
const DEMO_EXTERNAL_PREFIX = "seed-top-padel:";
const DEMO_CONTACT_SOURCE = "SEED_TOP_PADEL";
const now = new Date();

const daysAgo = (days: number, hour = 10) => {
  const date = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  date.setHours(hour, (days * 7) % 60, 0, 0);
  return date;
};

type DemoContactSeed = {
  key: string;
  name: string;
  email: string;
  phone: string;
  type: CrmContactType;
  marketingGranted: boolean;
  emailGranted: boolean;
  smsGranted: boolean;
  tags: string[];
  padel?: {
    level: string;
    preferredSide: PadelPreferredSide;
    clubName: string;
    tournamentsCount: number;
    noShowCount: number;
  };
};

const buildDemoContacts = (): DemoContactSeed[] => {
  const firstNames = [
    "Andre",
    "Beatriz",
    "Carlos",
    "Diana",
    "Eduardo",
    "Filipa",
    "Goncalo",
    "Helena",
    "Igor",
    "Joana",
    "Luis",
    "Marta",
    "Nuno",
    "Olga",
    "Paulo",
    "Rita",
    "Sergio",
    "Teresa",
    "Vasco",
    "Xana",
    "Yara",
    "Ze",
    "Bruno",
    "Catarina",
    "Diogo",
    "Eva",
    "Fabio",
    "Grazi",
    "Hugo",
    "Ines",
  ];

  const contacts: DemoContactSeed[] = [];

  for (let i = 0; i < firstNames.length; i += 1) {
    const idx = i + 1;
    const isCustomer = idx <= 18;
    const isLead = idx > 18 && idx <= 24;
    const isFollower = idx > 24 && idx <= 28;
    const type = isCustomer ? CrmContactType.CUSTOMER : isLead ? CrmContactType.LEAD : isFollower ? CrmContactType.FOLLOWER : CrmContactType.GUEST;

    const baseTags = isCustomer
      ? ["padel", "cliente"]
      : isLead
        ? ["lead", "form"]
        : isFollower
          ? ["social"]
          : ["guest"];

    if (idx <= 4) baseTags.push("vip");
    if (idx % 3 === 0) baseTags.push("torneio");
    if (idx % 5 === 0) baseTags.push("loja");
    if (idx % 7 === 0) baseTags.push("no_show_risk");

    const withPadel = isCustomer || isLead;
    const levels = ["M2", "M3", "M4", "M5", "F3", "F4"];
    const sides = [PadelPreferredSide.ESQUERDA, PadelPreferredSide.DIREITA, PadelPreferredSide.QUALQUER];

    contacts.push({
      key: `contact-${idx}`,
      name: `${firstNames[i]} Demo`,
      email: `top.padel.demo.${String(idx).padStart(2, "0")}@example.com`,
      phone: `+3519${String(10000000 + idx).slice(-8)}`,
      type,
      marketingGranted: isCustomer ? idx % 6 !== 0 : idx % 2 === 0,
      emailGranted: idx % 8 !== 0,
      smsGranted: idx % 9 !== 0,
      tags: Array.from(new Set(baseTags)),
      ...(withPadel
        ? {
            padel: {
              level: levels[i % levels.length],
              preferredSide: sides[i % sides.length],
              clubName: idx % 2 === 0 ? "Top Padel" : "Top Padel Norte",
              tournamentsCount: isCustomer ? 2 + (idx % 6) : idx % 3,
              noShowCount: idx % 7 === 0 ? 2 : idx % 11 === 0 ? 1 : 0,
            },
          }
        : {}),
    });
  }

  return contacts;
};

async function ensureOrganization() {
  const whereOr = candidateUsernames.map((username) => ({
    username: { equals: username, mode: "insensitive" as const },
  }));

  const existing = await prisma.organization.findFirst({
    where: { OR: whereOr },
    select: {
      id: true,
      groupId: true,
      username: true,
      publicName: true,
      officialEmail: true,
      officialEmailVerifiedAt: true,
    },
  });

  if (existing) {
    const updated = await prisma.organization.update({
      where: { id: existing.id },
      data: {
        status: OrganizationStatus.ACTIVE,
        username: existing.username ?? requestedUsername,
        publicName: existing.publicName || "Top Padel",
        businessName: "Top Padel",
        timezone: "Europe/Lisbon",
        officialEmail: existing.officialEmail ?? supportEmail,
        officialEmailVerifiedAt: existing.officialEmailVerifiedAt ?? now,
      },
      select: { id: true, groupId: true, username: true, publicName: true, status: true },
    });
    return updated;
  }

  const ownerFromEnv =
    seedActorUserIdFromEnv &&
    (await prisma.profile.findUnique({
      where: { id: seedActorUserIdFromEnv },
      select: { id: true },
    }));
  const fallbackOwner =
    ownerFromEnv ??
    (await prisma.profile.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }));
  if (!fallbackOwner) {
    throw new Error("Nao existe profile para owner do group.");
  }

  const group = await prisma.organizationGroup.create({
    data: { ownerUserId: fallbackOwner.id },
  });
  const created = await prisma.organization.create({
    data: {
      groupId: group.id,
      status: OrganizationStatus.ACTIVE,
      username: requestedUsername,
      publicName: "Top Padel",
      businessName: "Top Padel",
      timezone: "Europe/Lisbon",
      officialEmail: supportEmail,
      officialEmailVerifiedAt: now,
    },
    select: { id: true, groupId: true, username: true, publicName: true, status: true },
  });

  return created;
}

async function ensureModules(organizationId: number) {
  const modules: OrganizationModule[] = [
    OrganizationModule.CRM,
    OrganizationModule.TORNEIOS,
    OrganizationModule.LOJA,
    OrganizationModule.EVENTOS,
    OrganizationModule.RESERVAS,
  ];

  for (const moduleKey of modules) {
    await prisma.organizationModuleEntry.upsert({
      where: {
        organizationId_moduleKey: {
          organizationId,
          moduleKey,
        },
      },
      update: { enabled: true },
      create: {
        organizationId,
        moduleKey,
        enabled: true,
      },
    });
  }

  return modules;
}

async function ensureCrmPolicy(organizationId: number) {
  return prisma.crmOrganizationPolicy.upsert({
    where: { organizationId },
    update: {
      timezone: "Europe/Lisbon",
      quietHoursStartMinute: 22 * 60,
      quietHoursEndMinute: 8 * 60,
      capPerDay: 2,
      capPerWeek: 6,
      capPerMonth: 14,
      approvalEscalationHours: 24,
      approvalExpireHours: 48,
    },
    create: {
      organizationId,
      timezone: "Europe/Lisbon",
      quietHoursStartMinute: 22 * 60,
      quietHoursEndMinute: 8 * 60,
      capPerDay: 2,
      capPerWeek: 6,
      capPerMonth: 14,
      approvalEscalationHours: 24,
      approvalExpireHours: 48,
    },
  });
}

async function resolveSeedActorUserId(groupId: number): Promise<string | null> {
  if (seedActorUserIdFromEnv) {
    const exists = await prisma.profile.findUnique({
      where: { id: seedActorUserIdFromEnv },
      select: { id: true },
    });
    if (exists) return exists.id;
  }

  const member = await prisma.organizationGroupMember.findFirst({
    where: { groupId },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  if (member?.userId) return member.userId;

  const profile = await prisma.profile.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return profile?.id ?? null;
}

async function upsertContacts(organizationId: number, contactSeeds: DemoContactSeed[]) {
  const contacts: Array<{
    id: string;
    key: string;
    type: CrmContactType;
    marketingGranted: boolean;
    emailGranted: boolean;
    smsGranted: boolean;
    padel: DemoContactSeed["padel"];
  }> = [];

  for (const seed of contactSeeds) {
    const existing = await prisma.crmContact.findFirst({
      where: {
        organizationId,
        sourceType: DEMO_CONTACT_SOURCE,
        sourceId: seed.key,
      },
      select: { id: true },
    });

    const data: Prisma.CrmContactUncheckedCreateInput = {
      organizationId,
      status: "ACTIVE",
      contactType: seed.type,
      displayName: seed.name,
      contactEmail: seed.email,
      contactPhone: seed.phone,
      legalBasis: "CONSENT",
      marketingEmailOptIn: seed.marketingGranted,
      marketingPushOptIn: seed.marketingGranted,
      tags: seed.tags,
      sourceType: DEMO_CONTACT_SOURCE,
      sourceId: seed.key,
      customFields: {
        demo: true,
        origin: "seed_top_padel_demo",
      } as Prisma.InputJsonValue,
    };

    const contact = existing
      ? await prisma.crmContact.update({
          where: { id: existing.id },
          data,
          select: { id: true },
        })
      : await prisma.crmContact.create({
          data,
          select: { id: true },
        });

    contacts.push({
      id: contact.id,
      key: seed.key,
      type: seed.type,
      marketingGranted: seed.marketingGranted,
      emailGranted: seed.emailGranted,
      smsGranted: seed.smsGranted,
      padel: seed.padel,
    });
  }

  return contacts;
}

async function upsertContactConsents(organizationId: number, contacts: Array<{
  id: string;
  marketingGranted: boolean;
  emailGranted: boolean;
  smsGranted: boolean;
}>) {
  for (const contact of contacts) {
    const consentRows: Array<{ type: ConsentType; granted: boolean }> = [
      { type: ConsentType.MARKETING, granted: contact.marketingGranted },
      { type: ConsentType.CONTACT_EMAIL, granted: contact.emailGranted },
      { type: ConsentType.CONTACT_SMS, granted: contact.smsGranted },
    ];

    for (const row of consentRows) {
      const status = row.granted ? ConsentStatus.GRANTED : ConsentStatus.REVOKED;
      await prisma.crmContactConsent.upsert({
        where: {
          organizationId_contactId_type: {
            organizationId,
            contactId: contact.id,
            type: row.type,
          },
        },
        update: {
          status,
          source: "SEED_TOP_PADEL",
          grantedAt: row.granted ? daysAgo(45) : null,
          revokedAt: row.granted ? null : daysAgo(10),
        },
        create: {
          organizationId,
          contactId: contact.id,
          type: row.type,
          status,
          source: "SEED_TOP_PADEL",
          grantedAt: row.granted ? daysAgo(45) : null,
          revokedAt: row.granted ? null : daysAgo(10),
        },
      });
    }

    await prisma.crmContact.update({
      where: { id: contact.id },
      data: {
        marketingEmailOptIn: contact.marketingGranted,
        marketingPushOptIn: contact.marketingGranted,
      },
    });
  }
}

async function upsertPadelContactData(organizationId: number, contacts: Array<{
  id: string;
  padel: DemoContactSeed["padel"];
}>) {
  for (const contact of contacts) {
    if (!contact.padel) continue;

    await prisma.crmContactPadel.upsert({
      where: { contactId: contact.id },
      update: {
        organizationId,
        level: contact.padel.level,
        preferredSide: contact.padel.preferredSide,
        clubName: contact.padel.clubName,
        tournamentsCount: contact.padel.tournamentsCount,
        noShowCount: contact.padel.noShowCount,
      },
      create: {
        organizationId,
        contactId: contact.id,
        level: contact.padel.level,
        preferredSide: contact.padel.preferredSide,
        clubName: contact.padel.clubName,
        tournamentsCount: contact.padel.tournamentsCount,
        noShowCount: contact.padel.noShowCount,
      },
    });
  }
}

type SeededInteraction = {
  organizationId: number;
  contactId: string;
  externalId: string;
  type: CrmInteractionType;
  sourceType: CrmInteractionSource;
  sourceId: string;
  occurredAt: Date;
  amountCents: number | null;
  currency: string;
  metadata: Prisma.InputJsonValue;
};

function buildInteractions(organizationId: number, contacts: Array<{
  id: string;
  key: string;
  type: CrmContactType;
}>) {
  const interactions: SeededInteraction[] = [];

  contacts.forEach((contact, idx) => {
    const contactNum = idx + 1;
    const base = 3 + (idx % 20);

    interactions.push({
      organizationId,
      contactId: contact.id,
      externalId: `${DEMO_EXTERNAL_PREFIX}${contact.key}:profile_view`,
      type: CrmInteractionType.PROFILE_VIEWED,
      sourceType: CrmInteractionSource.PROFILE,
      sourceId: `${contact.key}:profile`,
      occurredAt: daysAgo(base + 28, 11),
      amountCents: null,
      currency: "EUR",
      metadata: { seed: true, contactKey: contact.key } as Prisma.InputJsonValue,
    });

    if (contact.type === CrmContactType.CUSTOMER) {
      const bookings = 2 + (idx % 4);
      for (let i = 0; i < bookings; i += 1) {
        interactions.push({
          organizationId,
          contactId: contact.id,
          externalId: `${DEMO_EXTERNAL_PREFIX}${contact.key}:booking:${i}`,
          type: CrmInteractionType.BOOKING_CONFIRMED,
          sourceType: CrmInteractionSource.BOOKING,
          sourceId: `${contact.key}:booking:${i}`,
          occurredAt: daysAgo(base + 20 - i * 3, 18),
          amountCents: 1800 + ((contactNum * 130 + i * 90) % 2200),
          currency: "EUR",
          metadata: { channel: "app", seed: true } as Prisma.InputJsonValue,
        });
      }

      interactions.push({
        organizationId,
        contactId: contact.id,
        externalId: `${DEMO_EXTERNAL_PREFIX}${contact.key}:checkin`,
        type: CrmInteractionType.EVENT_CHECKIN,
        sourceType: CrmInteractionSource.CHECKIN,
        sourceId: `${contact.key}:checkin`,
        occurredAt: daysAgo(base + 9, 19),
        amountCents: null,
        currency: "EUR",
        metadata: { seed: true } as Prisma.InputJsonValue,
      });

      if (idx % 2 === 0) {
        interactions.push({
          organizationId,
          contactId: contact.id,
          externalId: `${DEMO_EXTERNAL_PREFIX}${contact.key}:tournament_entry`,
          type: CrmInteractionType.PADEL_TOURNAMENT_ENTRY,
          sourceType: CrmInteractionSource.TOURNAMENT_ENTRY,
          sourceId: `${contact.key}:tournament`,
          occurredAt: daysAgo(base + 6, 20),
          amountCents: null,
          currency: "EUR",
          metadata: { bracket: "M3", seed: true } as Prisma.InputJsonValue,
        });

        interactions.push({
          organizationId,
          contactId: contact.id,
          externalId: `${DEMO_EXTERNAL_PREFIX}${contact.key}:match_payment`,
          type: CrmInteractionType.PADEL_MATCH_PAYMENT,
          sourceType: CrmInteractionSource.TRANSACTION,
          sourceId: `${contact.key}:match-payment`,
          occurredAt: daysAgo(base + 5, 20),
          amountCents: 1200 + (contactNum % 4) * 300,
          currency: "EUR",
          metadata: { seed: true } as Prisma.InputJsonValue,
        });
      }

      if (idx % 3 === 0) {
        interactions.push({
          organizationId,
          contactId: contact.id,
          externalId: `${DEMO_EXTERNAL_PREFIX}${contact.key}:store`,
          type: CrmInteractionType.STORE_ORDER_PAID,
          sourceType: CrmInteractionSource.STORE_ORDER,
          sourceId: `${contact.key}:store-order`,
          occurredAt: daysAgo(base + 3, 14),
          amountCents: 1490 + (contactNum % 5) * 700,
          currency: "EUR",
          metadata: { cartType: "pro-shop", seed: true } as Prisma.InputJsonValue,
        });
      }

      if (idx % 5 === 0) {
        interactions.push({
          organizationId,
          contactId: contact.id,
          externalId: `${DEMO_EXTERNAL_PREFIX}${contact.key}:membership_renewed`,
          type: CrmInteractionType.MEMBERSHIP_RENEWED,
          sourceType: CrmInteractionSource.MEMBERSHIP,
          sourceId: `${contact.key}:membership`,
          occurredAt: daysAgo(base + 1, 9),
          amountCents: null,
          currency: "EUR",
          metadata: { plan: "gold", seed: true } as Prisma.InputJsonValue,
        });
      }
    } else if (contact.type === CrmContactType.LEAD) {
      interactions.push({
        organizationId,
        contactId: contact.id,
        externalId: `${DEMO_EXTERNAL_PREFIX}${contact.key}:form`,
        type: CrmInteractionType.FORM_SUBMITTED,
        sourceType: CrmInteractionSource.FORM,
        sourceId: `${contact.key}:lead-form`,
        occurredAt: daysAgo(base + 12, 16),
        amountCents: null,
        currency: "EUR",
        metadata: { source: "landing", seed: true } as Prisma.InputJsonValue,
      });

      if (idx % 2 === 1) {
        interactions.push({
          organizationId,
          contactId: contact.id,
          externalId: `${DEMO_EXTERNAL_PREFIX}${contact.key}:event_view`,
          type: CrmInteractionType.EVENT_VIEWED,
          sourceType: CrmInteractionSource.EVENT,
          sourceId: `${contact.key}:event-view`,
          occurredAt: daysAgo(base + 4, 18),
          amountCents: null,
          currency: "EUR",
          metadata: { seed: true } as Prisma.InputJsonValue,
        });
      }
    } else if (contact.type === CrmContactType.FOLLOWER) {
      interactions.push({
        organizationId,
        contactId: contact.id,
        externalId: `${DEMO_EXTERNAL_PREFIX}${contact.key}:followed`,
        type: CrmInteractionType.ORG_FOLLOWED,
        sourceType: CrmInteractionSource.SOCIAL,
        sourceId: `${contact.key}:follow`,
        occurredAt: daysAgo(base + 15, 13),
        amountCents: null,
        currency: "EUR",
        metadata: { seed: true } as Prisma.InputJsonValue,
      });
    } else {
      interactions.push({
        organizationId,
        contactId: contact.id,
        externalId: `${DEMO_EXTERNAL_PREFIX}${contact.key}:event_saved`,
        type: CrmInteractionType.EVENT_SAVED,
        sourceType: CrmInteractionSource.EVENT,
        sourceId: `${contact.key}:event-saved`,
        occurredAt: daysAgo(base + 7, 12),
        amountCents: null,
        currency: "EUR",
        metadata: { seed: true } as Prisma.InputJsonValue,
      });
    }
  });

  return interactions;
}

const PURCHASE_TYPES = new Set<CrmInteractionType>([
  CrmInteractionType.STORE_ORDER_PAID,
  CrmInteractionType.EVENT_TICKET,
  CrmInteractionType.BOOKING_CONFIRMED,
  CrmInteractionType.PADEL_MATCH_PAYMENT,
]);

const SPEND_TYPES = PURCHASE_TYPES;

async function reseedInteractions(organizationId: number, interactions: SeededInteraction[]) {
  await prisma.crmInteraction.deleteMany({
    where: {
      organizationId,
      externalId: { startsWith: DEMO_EXTERNAL_PREFIX },
    },
  });

  if (!interactions.length) return;

  await prisma.crmInteraction.createMany({
    data: interactions.map((interaction) => ({
      organizationId: interaction.organizationId,
      contactId: interaction.contactId,
      externalId: interaction.externalId,
      type: interaction.type,
      sourceType: interaction.sourceType,
      sourceId: interaction.sourceId,
      occurredAt: interaction.occurredAt,
      amountCents: interaction.amountCents ?? undefined,
      currency: interaction.currency,
      metadata: interaction.metadata,
    })),
  });
}

async function syncContactAggregates(organizationId: number, contacts: Array<{
  id: string;
  marketingGranted: boolean;
  emailGranted: boolean;
  smsGranted: boolean;
}>) {
  const contactIds = contacts.map((contact) => contact.id);
  const interactions = await prisma.crmInteraction.findMany({
    where: {
      organizationId,
      contactId: { in: contactIds },
      externalId: { startsWith: DEMO_EXTERNAL_PREFIX },
    },
    select: {
      contactId: true,
      type: true,
      occurredAt: true,
      amountCents: true,
    },
  });

  const grouped = new Map<string, typeof interactions>();
  for (const interaction of interactions) {
    const list = grouped.get(interaction.contactId) ?? [];
    list.push(interaction);
    grouped.set(interaction.contactId, list);
  }

  for (const contact of contacts) {
    const rows = grouped.get(contact.id) ?? [];
    rows.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    let totalSpentCents = 0;
    let totalOrders = 0;
    let totalBookings = 0;
    let totalAttendances = 0;
    let totalTournaments = 0;
    let totalStoreOrders = 0;
    let firstInteractionAt: Date | null = null;
    let lastActivityAt: Date | null = null;
    let lastPurchaseAt: Date | null = null;

    for (const row of rows) {
      if (!firstInteractionAt || row.occurredAt < firstInteractionAt) firstInteractionAt = row.occurredAt;
      if (!lastActivityAt || row.occurredAt > lastActivityAt) lastActivityAt = row.occurredAt;

      if (SPEND_TYPES.has(row.type) && typeof row.amountCents === "number") {
        totalSpentCents += row.amountCents;
      }

      if (row.type === CrmInteractionType.EVENT_TICKET) totalOrders += 1;
      if (row.type === CrmInteractionType.BOOKING_CONFIRMED) totalBookings += 1;
      if (row.type === CrmInteractionType.EVENT_CHECKIN) totalAttendances += 1;
      if (row.type === CrmInteractionType.PADEL_TOURNAMENT_ENTRY) totalTournaments += 1;
      if (row.type === CrmInteractionType.STORE_ORDER_PAID) totalStoreOrders += 1;

      if (PURCHASE_TYPES.has(row.type)) {
        if (!lastPurchaseAt || row.occurredAt > lastPurchaseAt) lastPurchaseAt = row.occurredAt;
      }
    }

    const contactRecord = await prisma.crmContact.findUnique({
      where: { id: contact.id },
      select: { contactEmail: true, contactPhone: true },
    });

    await prisma.crmContact.update({
      where: { id: contact.id },
      data: {
        firstInteractionAt,
        lastActivityAt,
        lastPurchaseAt,
        totalSpentCents,
        totalOrders,
        totalBookings,
        totalAttendances,
        totalTournaments,
        totalStoreOrders,
        marketingEmailOptIn: contact.marketingGranted,
        marketingPushOptIn: contact.marketingGranted,
        contactEmail: contact.emailGranted ? contactRecord?.contactEmail ?? null : null,
        contactPhone: contact.smsGranted ? contactRecord?.contactPhone ?? null : null,
      },
    });
  }
}

async function reseedNotes(organizationId: number, actorUserId: string | null, contactIds: string[]) {
  await prisma.crmContactNote.deleteMany({
    where: {
      organizationId,
      body: { startsWith: DEMO_NOTE_PREFIX },
    },
  });

  if (!actorUserId) {
    await prisma.crmContact.updateMany({
      where: { id: { in: contactIds } },
      data: { notesCount: 0 },
    });
    return { created: 0, actorUserId: null as string | null };
  }

  const noteBodies = [
    "Ligou para pedir mais horarios ao fim de semana.",
    "Prefere jogos nivel M3-M4 e resposta rapida por app.",
    "Interessado em mensalidade familiar a partir do proximo mes.",
    "Valoriza torneios curtos ao final da tarde.",
  ];

  let created = 0;
  for (let i = 0; i < Math.min(10, contactIds.length); i += 1) {
    const contactId = contactIds[i];
    const body = `${DEMO_NOTE_PREFIX} ${noteBodies[i % noteBodies.length]}`;
    await prisma.crmContactNote.create({
      data: {
        organizationId,
        contactId,
        authorUserId: actorUserId,
        body,
      },
    });
    created += 1;
  }

  const counts = await prisma.crmContactNote.groupBy({
    by: ["contactId"],
    where: {
      organizationId,
      contactId: { in: contactIds },
    },
    _count: { _all: true },
  });

  const countMap = new Map(counts.map((row) => [row.contactId, row._count._all]));
  for (const contactId of contactIds) {
    await prisma.crmContact.update({
      where: { id: contactId },
      data: { notesCount: countMap.get(contactId) ?? 0 },
    });
  }

  return { created, actorUserId };
}

async function reseedSegments(organizationId: number, contacts: Array<{
  id: string;
  type: CrmContactType;
  tags: string[];
  totalSpentCents: number;
  lastActivityAt: Date | null;
  padelNoShowCount: number;
}>, actorUserId: string | null) {
  await prisma.crmSegment.deleteMany({
    where: {
      organizationId,
      name: { startsWith: DEMO_SEGMENT_PREFIX },
    },
  });

  const active30dCount = contacts.filter(
    (contact) => contact.type === CrmContactType.CUSTOMER && contact.lastActivityAt && contact.lastActivityAt >= daysAgo(30, 0),
  ).length;

  const vipCount = contacts.filter(
    (contact) => contact.totalSpentCents >= 20000 || contact.tags.includes("vip"),
  ).length;

  const noShowRiskCount = contacts.filter((contact) => contact.padelNoShowCount >= 2).length;

  const segmentA = await prisma.crmSegment.create({
    data: {
      organizationId,
      name: `${DEMO_SEGMENT_PREFIX}Jogadores Ativos 30d`,
      description: "Clientes com atividade recente e perfil de jogo.",
      createdByUserId: actorUserId ?? undefined,
      status: "ACTIVE",
      rules: {
        version: 2,
        root: {
          kind: "group",
          id: "root",
          logic: "AND",
          children: [
            { kind: "rule", id: "rule_1", field: "contactType", op: "eq", value: "CUSTOMER" },
            { kind: "rule", id: "rule_2", field: "lastActivityAt", op: "gte", value: "30d" },
          ],
        },
      } as Prisma.InputJsonValue,
      sizeCache: active30dCount,
      lastComputedAt: now,
    },
    select: { id: true, name: true },
  });

  const segmentB = await prisma.crmSegment.create({
    data: {
      organizationId,
      name: `${DEMO_SEGMENT_PREFIX}VIP >= 200EUR`,
      description: "Clientes com maior gasto e potencial de fidelizacao.",
      createdByUserId: actorUserId ?? undefined,
      status: "ACTIVE",
      rules: {
        version: 2,
        root: {
          kind: "group",
          id: "root",
          logic: "OR",
          children: [
            { kind: "rule", id: "rule_1", field: "totalSpentCents", op: "gte", value: 20000 },
            { kind: "rule", id: "rule_2", field: "tag", op: "has", value: "vip" },
          ],
        },
      } as Prisma.InputJsonValue,
      sizeCache: vipCount,
      lastComputedAt: now,
    },
    select: { id: true, name: true },
  });

  const segmentC = await prisma.crmSegment.create({
    data: {
      organizationId,
      name: `${DEMO_SEGMENT_PREFIX}Risco No-Show`,
      description: "Jogadores com historico de no-show para reativacao guiada.",
      createdByUserId: actorUserId ?? undefined,
      status: "ACTIVE",
      rules: {
        version: 2,
        root: {
          kind: "group",
          id: "root",
          logic: "AND",
          children: [
            { kind: "rule", id: "rule_1", field: "padel.noShowCount", op: "gte", value: 2 },
          ],
        },
      } as Prisma.InputJsonValue,
      sizeCache: noShowRiskCount,
      lastComputedAt: now,
    },
    select: { id: true, name: true },
  });

  return [segmentA, segmentB, segmentC];
}

async function reseedJourneys(organizationId: number, actorUserId: string | null, contactIds: string[]) {
  await prisma.crmJourney.deleteMany({
    where: {
      organizationId,
      name: { startsWith: DEMO_JOURNEY_PREFIX },
    },
  });

  const journey1 = await prisma.crmJourney.create({
    data: {
      organizationId,
      name: `${DEMO_JOURNEY_PREFIX}Onboarding Jogador`,
      description: "Recebe lead, espera, envia incentivo e CTA.",
      status: CrmJourneyStatus.PUBLISHED,
      createdByUserId: actorUserId ?? undefined,
      publishedAt: daysAgo(5, 9),
      definition: {
        trigger: "FORM_SUBMITTED",
        goal: "primeira reserva",
      } as Prisma.InputJsonValue,
    },
    select: { id: true, name: true },
  });

  const journey1Steps = await prisma.crmJourneyStep.createManyAndReturn({
    data: [
      {
        organizationId,
        journeyId: journey1.id,
        stepKey: "trigger_form",
        position: 0,
        stepType: CrmJourneyStepType.TRIGGER,
        config: { event: "FORM_SUBMITTED" } as Prisma.InputJsonValue,
      },
      {
        organizationId,
        journeyId: journey1.id,
        stepKey: "delay_48h",
        position: 1,
        stepType: CrmJourneyStepType.DELAY,
        config: { hours: 48 } as Prisma.InputJsonValue,
      },
      {
        organizationId,
        journeyId: journey1.id,
        stepKey: "action_push",
        position: 2,
        stepType: CrmJourneyStepType.ACTION,
        config: {
          channel: "IN_APP",
          title: "Volta ao campo",
          body: "Temos vaga para o teu nivel esta semana.",
        } as Prisma.InputJsonValue,
      },
    ],
  });

  const actionStep = journey1Steps.find((step) => step.stepKey === "action_push") ?? journey1Steps[2];

  const enrollments = [] as Array<{ id: string; contactId: string }>;
  for (const contactId of contactIds.slice(0, 6)) {
    const enrollment = await prisma.crmJourneyEnrollment.create({
      data: {
        organizationId,
        journeyId: journey1.id,
        contactId,
        dedupeKey: `${DEMO_EXTERNAL_PREFIX}journey:${journey1.id}:${contactId}`,
        status: "ACTIVE",
        currentStep: 2,
        lastEvaluatedAt: daysAgo(1, 11),
      },
      select: { id: true, contactId: true },
    });
    enrollments.push(enrollment);
  }

  if (actionStep) {
    for (const enrollment of enrollments) {
      await prisma.crmJourneyRun.create({
        data: {
          organizationId,
          journeyId: journey1.id,
          enrollmentId: enrollment.id,
          stepId: actionStep.id,
          status: CrmJourneyRunStatus.SENT,
          scheduledFor: daysAgo(1, 10),
          executedAt: daysAgo(1, 11),
        },
      });
    }
  }

  const journey2 = await prisma.crmJourney.create({
    data: {
      organizationId,
      name: `${DEMO_JOURNEY_PREFIX}Recuperacao No-Show`,
      description: "Fluxo para recuperar jogadores inativos.",
      status: CrmJourneyStatus.PAUSED,
      createdByUserId: actorUserId ?? undefined,
      publishedAt: daysAgo(9, 9),
      pausedAt: daysAgo(2, 9),
      definition: {
        trigger: "NO_SHOW",
        goal: "nova inscricao",
      } as Prisma.InputJsonValue,
    },
    select: { id: true, name: true },
  });

  await prisma.crmJourneyStep.createMany({
    data: [
      {
        organizationId,
        journeyId: journey2.id,
        stepKey: "condition_no_show",
        position: 0,
        stepType: CrmJourneyStepType.CONDITION,
        config: { field: "padel.noShowCount", op: "gte", value: 2 } as Prisma.InputJsonValue,
      },
      {
        organizationId,
        journeyId: journey2.id,
        stepKey: "action_offer",
        position: 1,
        stepType: CrmJourneyStepType.ACTION,
        config: {
          channel: "IN_APP",
          title: "Volta com desconto",
          body: "Tens 15% na proxima reserva de court.",
        } as Prisma.InputJsonValue,
      },
    ],
  });

  return [journey1, journey2];
}

async function reseedCampaigns(
  organizationId: number,
  actorUserId: string | null,
  contacts: Array<{ id: string; userId: string | null }>,
  segments: Array<{ id: string; name: string }>,
) {
  await prisma.crmCampaign.deleteMany({
    where: {
      organizationId,
      name: { startsWith: DEMO_CAMPAIGN_PREFIX },
    },
  });

  const sentCampaign = await prisma.crmCampaign.create({
    data: {
      organizationId,
      segmentId: segments[0]?.id,
      name: `${DEMO_CAMPAIGN_PREFIX}Reativacao 30d`,
      description: "Campanha demo para reativar clientes com atividade recente.",
      channel: "IN_APP",
      channels: { inApp: true, email: true } as Prisma.InputJsonValue,
      status: CrmCampaignStatus.SENT,
      approvalState: CrmCampaignApprovalState.APPROVED,
      approvalSubmittedAt: daysAgo(4, 9),
      approvalExpiresAt: daysAgo(2, 9),
      approvedByUserId: actorUserId ?? undefined,
      approvedAt: daysAgo(3, 10),
      payload: {
        title: "Volta ao Top Padel",
        body: "Temos slots livres no teu nivel esta semana.",
        ctaLabel: "Reservar agora",
        ctaUrl: `/org/${organizationId}/bookings`,
        channels: { inApp: true, email: true },
      } as Prisma.InputJsonValue,
      audienceSnapshot: {
        total: 16,
        segmentName: segments[0]?.name ?? null,
      } as Prisma.InputJsonValue,
      sentAt: daysAgo(2, 11),
      createdByUserId: actorUserId ?? undefined,
    },
    select: { id: true, name: true },
  });

  await prisma.crmCampaignApproval.createMany({
    data: [
      {
        organizationId,
        campaignId: sentCampaign.id,
        state: CrmCampaignApprovalState.SUBMITTED,
        action: "SUBMITTED",
        actorUserId: actorUserId ?? undefined,
        metadata: { seed: true } as Prisma.InputJsonValue,
      },
      {
        organizationId,
        campaignId: sentCampaign.id,
        state: CrmCampaignApprovalState.APPROVED,
        action: "APPROVED",
        actorUserId: actorUserId ?? undefined,
        metadata: { seed: true } as Prisma.InputJsonValue,
      },
    ],
  });

  const deliveryRows: Array<Prisma.CrmCampaignDeliveryCreateManyInput> = [];
  let sentCount = 0;
  let openedCount = 0;
  let clickedCount = 0;
  let failedCount = 0;
  const sentAt = daysAgo(2, 11);

  contacts.slice(0, 10).forEach((contact, idx) => {
    const inAppStatus = idx % 6 === 0 ? "FAILED" : idx % 4 === 0 ? "CLICKED" : idx % 3 === 0 ? "OPENED" : "SENT";

    const openedAt = inAppStatus === "OPENED" || inAppStatus === "CLICKED" ? daysAgo(2, 12) : null;
    const clickedAt = inAppStatus === "CLICKED" ? daysAgo(2, 13) : null;

    deliveryRows.push({
      organizationId,
      campaignId: sentCampaign.id,
      contactId: contact.id,
      channel: "IN_APP",
      userId: contact.userId ?? undefined,
      status: inAppStatus,
      sentAt,
      openedAt: openedAt ?? undefined,
      clickedAt: clickedAt ?? undefined,
      ...(inAppStatus === "FAILED" ? { errorCode: "SEED_FAIL", errorMessage: "Falha simulada" } : {}),
    });

    if (inAppStatus === "FAILED") failedCount += 1;
    else sentCount += 1;
    if (openedAt) openedCount += 1;
    if (clickedAt) clickedCount += 1;

    if (idx < 6) {
      const emailStatus = idx % 5 === 0 ? "FAILED" : idx % 2 === 0 ? "OPENED" : "SENT";
      const emailOpenedAt = emailStatus === "OPENED" ? daysAgo(2, 14) : null;

      deliveryRows.push({
        organizationId,
        campaignId: sentCampaign.id,
        contactId: contact.id,
        channel: "EMAIL",
        userId: contact.userId ?? undefined,
        status: emailStatus,
        sentAt,
        openedAt: emailOpenedAt ?? undefined,
        ...(emailStatus === "FAILED" ? { errorCode: "EMAIL_FAIL", errorMessage: "Falha SMTP simulada" } : {}),
      });

      if (emailStatus === "FAILED") failedCount += 1;
      else sentCount += 1;
      if (emailOpenedAt) openedCount += 1;
    }
  });

  if (deliveryRows.length) {
    await prisma.crmCampaignDelivery.createMany({ data: deliveryRows });
  }

  await prisma.crmCampaign.update({
    where: { id: sentCampaign.id },
    data: {
      sentCount,
      openedCount,
      clickedCount,
      failedCount,
    },
  });

  const submittedCampaign = await prisma.crmCampaign.create({
    data: {
      organizationId,
      segmentId: segments[1]?.id,
      name: `${DEMO_CAMPAIGN_PREFIX}Upsell VIP Fevereiro`,
      description: "Campanha pronta para aprovacao interna.",
      channel: "IN_APP",
      channels: { inApp: true, email: false } as Prisma.InputJsonValue,
      status: CrmCampaignStatus.DRAFT,
      approvalState: CrmCampaignApprovalState.SUBMITTED,
      approvalSubmittedAt: daysAgo(1, 9),
      approvalExpiresAt: daysAgo(-1, 9),
      payload: {
        title: "Torneio Premium",
        body: "Acesso antecipado para jogadores VIP.",
        channels: { inApp: true, email: false },
      } as Prisma.InputJsonValue,
      audienceSnapshot: {
        total: 8,
        segmentName: segments[1]?.name ?? null,
      } as Prisma.InputJsonValue,
      createdByUserId: actorUserId ?? undefined,
    },
    select: { id: true, name: true },
  });

  await prisma.crmCampaignApproval.create({
    data: {
      organizationId,
      campaignId: submittedCampaign.id,
      state: CrmCampaignApprovalState.SUBMITTED,
      action: "SUBMITTED",
      actorUserId: actorUserId ?? undefined,
      metadata: { seed: true } as Prisma.InputJsonValue,
    },
  });

  const rejectedCampaign = await prisma.crmCampaign.create({
    data: {
      organizationId,
      segmentId: segments[2]?.id,
      name: `${DEMO_CAMPAIGN_PREFIX}Recuperacao No-Show`,
      description: "Exemplo de campanha rejeitada para revisao.",
      channel: "IN_APP",
      channels: { inApp: true, email: true } as Prisma.InputJsonValue,
      status: CrmCampaignStatus.PAUSED,
      approvalState: CrmCampaignApprovalState.REJECTED,
      approvalSubmittedAt: daysAgo(6, 9),
      rejectedAt: daysAgo(5, 16),
      rejectedByUserId: actorUserId ?? undefined,
      payload: {
        title: "Volta ao jogo",
        body: "Campanha para reduzir no-shows.",
        channels: { inApp: true, email: true },
      } as Prisma.InputJsonValue,
      audienceSnapshot: {
        total: 5,
        segmentName: segments[2]?.name ?? null,
      } as Prisma.InputJsonValue,
      createdByUserId: actorUserId ?? undefined,
    },
    select: { id: true, name: true },
  });

  await prisma.crmCampaignApproval.createMany({
    data: [
      {
        organizationId,
        campaignId: rejectedCampaign.id,
        state: CrmCampaignApprovalState.SUBMITTED,
        action: "SUBMITTED",
        actorUserId: actorUserId ?? undefined,
        metadata: { seed: true } as Prisma.InputJsonValue,
      },
      {
        organizationId,
        campaignId: rejectedCampaign.id,
        state: CrmCampaignApprovalState.REJECTED,
        action: "REJECTED",
        actorUserId: actorUserId ?? undefined,
        reason: "Mensagem demasiado ampla para o publico alvo.",
        metadata: { seed: true } as Prisma.InputJsonValue,
      },
    ],
  });

  return [sentCampaign, submittedCampaign, rejectedCampaign];
}

async function reseedLoyalty(organizationId: number) {
  const program = await prisma.loyaltyProgram.upsert({
    where: { organizationId },
    update: {
      status: LoyaltyProgramStatus.ACTIVE,
      name: "Top Padel Points",
      pointsName: "Pontos Top",
      pointsExpiryDays: 365,
      termsUrl: "https://top-padel.test/termos-fidelizacao",
    },
    create: {
      organizationId,
      status: LoyaltyProgramStatus.ACTIVE,
      name: "Top Padel Points",
      pointsName: "Pontos Top",
      pointsExpiryDays: 365,
      termsUrl: "https://top-padel.test/termos-fidelizacao",
    },
    select: { id: true, name: true },
  });

  await prisma.loyaltyRule.deleteMany({
    where: {
      programId: program.id,
      name: { startsWith: DEMO_SEGMENT_PREFIX },
    },
  });

  await prisma.loyaltyReward.deleteMany({
    where: {
      programId: program.id,
      name: { startsWith: DEMO_SEGMENT_PREFIX },
    },
  });

  await prisma.loyaltyRule.createMany({
    data: [
      {
        programId: program.id,
        name: `${DEMO_SEGMENT_PREFIX}Reserva concluida`,
        trigger: LoyaltyRuleTrigger.BOOKING_COMPLETED,
        points: 45,
        maxPointsPerDay: 90,
        maxPointsPerUser: 1200,
        conditions: { minAmountCents: 1500 } as Prisma.InputJsonValue,
        isActive: true,
      },
      {
        programId: program.id,
        name: `${DEMO_SEGMENT_PREFIX}Check-in evento`,
        trigger: LoyaltyRuleTrigger.EVENT_CHECKIN,
        points: 30,
        maxPointsPerDay: 120,
        maxPointsPerUser: 900,
        conditions: {} as Prisma.InputJsonValue,
        isActive: true,
      },
      {
        programId: program.id,
        name: `${DEMO_SEGMENT_PREFIX}Participacao torneio`,
        trigger: LoyaltyRuleTrigger.TOURNAMENT_PARTICIPATION,
        points: 80,
        maxPointsPerDay: 80,
        maxPointsPerUser: 1600,
        conditions: {} as Prisma.InputJsonValue,
        isActive: true,
      },
    ],
  });

  await prisma.loyaltyReward.createMany({
    data: [
      {
        programId: program.id,
        name: `${DEMO_SEGMENT_PREFIX}Desconto 10% court`,
        type: LoyaltyRewardType.DISCOUNT,
        pointsCost: 250,
        stock: null,
        payload: { discountPercent: 10, couponCode: "TOP10" } as Prisma.InputJsonValue,
        isActive: true,
      },
      {
        programId: program.id,
        name: `${DEMO_SEGMENT_PREFIX}Aula gratuita`,
        type: LoyaltyRewardType.FREE_CLASS,
        pointsCost: 400,
        stock: 30,
        payload: { classRef: "aula-intensiva-60" } as Prisma.InputJsonValue,
        isActive: true,
      },
      {
        programId: program.id,
        name: `${DEMO_SEGMENT_PREFIX}Credito loja 5EUR`,
        type: LoyaltyRewardType.STORE_CREDIT,
        pointsCost: 300,
        stock: null,
        payload: { creditCents: 500 } as Prisma.InputJsonValue,
        isActive: true,
      },
    ],
  });

  return program;
}

async function reseedSavedViews(organizationId: number, actorUserId: string | null) {
  if (!actorUserId) return 0;

  await prisma.crmSavedView.deleteMany({
    where: {
      organizationId,
      userId: actorUserId,
      name: { startsWith: DEMO_SEGMENT_PREFIX },
    },
  });

  await prisma.crmSavedView.createMany({
    data: [
      {
        organizationId,
        userId: actorUserId,
        scope: "CUSTOMERS",
        name: `${DEMO_SEGMENT_PREFIX}Clientes Ativos`,
        isDefault: true,
        definition: {
          filters: {
            query: "",
            tags: "padel",
            minSpentEur: "50",
            maxSpentEur: "",
            lastActivityDays: "30",
            marketingOptIn: "true",
          },
        } as Prisma.InputJsonValue,
      },
      {
        organizationId,
        userId: actorUserId,
        scope: "SEGMENTS",
        name: `${DEMO_SEGMENT_PREFIX}Segmentos Quentes`,
        isDefault: true,
        definition: {
          filters: {
            query: "",
            status: "ACTIVE",
            minSize: "5",
            updatedDays: "30",
            sortBy: "size_desc",
          },
        } as Prisma.InputJsonValue,
      },
    ],
  });

  return 2;
}

async function main() {
  const organization = await ensureOrganization();
  const enabledModules = await ensureModules(organization.id);
  await ensureCrmPolicy(organization.id);

  const actorUserId = await resolveSeedActorUserId(organization.groupId);

  const contactSeeds = buildDemoContacts();
  const contacts = await upsertContacts(organization.id, contactSeeds);
  await upsertContactConsents(organization.id, contacts);
  await upsertPadelContactData(organization.id, contacts);

  const interactions = buildInteractions(
    organization.id,
    contacts.map((contact) => ({ id: contact.id, key: contact.key, type: contact.type })),
  );
  await reseedInteractions(organization.id, interactions);
  await syncContactAggregates(organization.id, contacts);

  const contactsSnapshot = await prisma.crmContact.findMany({
    where: {
      organizationId: organization.id,
      sourceType: DEMO_CONTACT_SOURCE,
    },
    select: {
      id: true,
      userId: true,
      contactType: true,
      tags: true,
      totalSpentCents: true,
      lastActivityAt: true,
      padelProfile: { select: { noShowCount: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const notes = await reseedNotes(
    organization.id,
    actorUserId,
    contactsSnapshot.map((contact) => contact.id),
  );

  const segments = await reseedSegments(
    organization.id,
    contactsSnapshot.map((contact) => ({
      id: contact.id,
      type: contact.contactType,
      tags: contact.tags,
      totalSpentCents: contact.totalSpentCents,
      lastActivityAt: contact.lastActivityAt,
      padelNoShowCount: contact.padelProfile?.noShowCount ?? 0,
    })),
    actorUserId,
  );

  const journeys = await reseedJourneys(
    organization.id,
    actorUserId,
    contactsSnapshot.map((contact) => contact.id),
  );

  const campaigns = await reseedCampaigns(
    organization.id,
    actorUserId,
    contactsSnapshot.map((contact) => ({ id: contact.id, userId: contact.userId ?? null })),
    segments,
  );

  const loyaltyProgram = await reseedLoyalty(organization.id);
  const savedViewsCount = await reseedSavedViews(organization.id, actorUserId);

  const summary = {
    organization: {
      id: organization.id,
      username: organization.username,
      publicName: organization.publicName,
      actorUserId,
      enabledModules,
    },
    seeded: {
      contacts: contactsSnapshot.length,
      interactions: interactions.length,
      notes: notes.created,
      segments: segments.length,
      campaigns: campaigns.length,
      journeys: journeys.length,
      loyaltyProgram: loyaltyProgram.name,
      savedViews: savedViewsCount,
    },
    urls: {
      crmClientes: `/org/${organization.id}/crm/customers`,
      crmSegmentos: `/org/${organization.id}/crm/segments`,
      crmCampanhas: `/org/${organization.id}/crm/campaigns`,
      crmJourneys: `/org/${organization.id}/crm/journeys`,
      crmRelatorios: `/org/${organization.id}/crm/reports`,
      crmLoyalty: `/org/${organization.id}/crm/loyalty`,
    },
  };

  console.log("[seed-top-padel-demo] OK");
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error("[seed-top-padel-demo] error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
