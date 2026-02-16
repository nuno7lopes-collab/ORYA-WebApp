import "./load-env.js";
import crypto from "node:crypto";
import {
  AnalyticsDimensionKey,
  AnalyticsMetricKey,
  EntitlementStatus,
  EntitlementType,
  EventPricingMode,
  EventStatus,
  EventTemplateType,
  FeeMode,
  InvoicingMode,
  LedgerEntryType,
  OrganizationModule,
  OrganizationMemberRole,
  OrganizationPermissionLevel,
  OrganizationStatus,
  PaymentStatus,
  PrismaClient,
  ProcessorFeesStatus,
  SaleSummaryStatus,
  SourceType,
  TicketStatus,
  TicketTypeStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const APP_ENV_RAW = process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV ?? "prod";
const APP_ENV = APP_ENV_RAW.toLowerCase() === "test" ? "test" : "prod";
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing DATABASE_URL or DIRECT_URL.");
}

function stripUnsupportedParams(raw: string) {
  try {
    const parsed = new URL(raw);
    const keys = ["options"];
    let changed = false;
    for (const key of keys) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) return parsed.toString();
  } catch {
    // ignore parse failures and keep raw
  }
  return raw;
}

function stripSslOptions(raw: string) {
  try {
    const parsed = new URL(raw);
    const keys = ["sslmode", "ssl", "sslrootcert", "sslcert", "sslkey"];
    let changed = false;
    for (const key of keys) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) return parsed.toString();
  } catch {
    // ignore parse failures and keep raw
  }
  return raw;
}

function resolvePgSsl(url: string): { ssl: false | { rejectUnauthorized: false } | undefined; connectionString: string } {
  const sanitized = stripUnsupportedParams(url);
  let sslMode: string | null = null;
  let host = "";
  try {
    const parsed = new URL(sanitized);
    sslMode = parsed.searchParams.get("sslmode");
    host = parsed.hostname;
  } catch {
    // ignore parse failures
  }

  const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const forceDisable =
    process.env.PGSSL_DISABLE === "true" ||
    process.env.PGSSLMODE === "disable" ||
    sslMode === "disable" ||
    isLocalHost;
  if (forceDisable) {
    return { ssl: false, connectionString: stripSslOptions(sanitized) };
  }

  const allowSelfSigned =
    process.env.PGSSL_ALLOW_SELF_SIGNED === "true" ||
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0";
  if (process.env.NODE_ENV !== "production" || allowSelfSigned) {
    return { ssl: { rejectUnauthorized: false }, connectionString: stripSslOptions(sanitized) };
  }

  return { ssl: undefined, connectionString: sanitized };
}

function slugifyTag(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function stableUuid(seed: string) {
  const hex = crypto.createHash("sha256").update(seed).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function startOfUtcDay(input: Date) {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

function daysAgo(days: number, hour = 12) {
  const date = new Date();
  date.setUTCHours(hour, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

const seedTag = slugifyTag(process.env.ANALYTICS_FINANCE_SEED_TAG ?? "split_perfect_v1");
const prefix = `seed_${seedTag}`;
const eventSlugPrefix = `${prefix}_evt_`;
const ticketPrefix = `${prefix}_tkt_`;
const purchasePrefix = `${prefix}_pay_`;
const orgUsername = (process.env.ANALYTICS_FINANCE_ORG_USERNAME ?? "analytics-finance-split-demo").trim().toLowerCase();
const orgPublicName = process.env.ANALYTICS_FINANCE_ORG_PUBLIC_NAME ?? "Analytics Finance Split Demo";
const ownerUserIdFromEnv = (process.env.ANALYTICS_FINANCE_OWNER_USER_ID ?? "").trim() || null;
const supportEmail = `${orgUsername.replace(/[^a-z0-9.-]/g, "")}@example.test`;
const now = new Date();

const pg = resolvePgSsl(connectionString);
const pool = new Pool({
  connectionString: pg.connectionString,
  ssl: pg.ssl,
});
pool.on("connect", (client) => {
  client.query("select set_config('app.env', $1, true)", [APP_ENV]).catch(() => {});
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });

type SeedEventRef = "main" | "growth" | "padel";

type SeedScenario = {
  key: string;
  daysAgo: number;
  eventRef: SeedEventRef;
  sourceType: SourceType;
  paymentStatus: PaymentStatus;
  saleStatus: SaleSummaryStatus | null;
  grossCents: number;
  platformFeeCents: number;
  cardPlatformFeeCents: number;
  processorFeeCents: number;
  ticketQty: number;
  ticketStatuses: TicketStatus[];
  buyerIndex: number;
  moduleValue: "EVENTOS" | "TORNEIOS";
  refundBaseCents?: number;
};

const scenarios: SeedScenario[] = [
  {
    key: "s01",
    daysAgo: 160,
    eventRef: "main",
    sourceType: SourceType.TICKET_ORDER,
    paymentStatus: PaymentStatus.SUCCEEDED,
    saleStatus: SaleSummaryStatus.PAID,
    grossCents: 28000,
    platformFeeCents: 2800,
    cardPlatformFeeCents: 300,
    processorFeeCents: 900,
    ticketQty: 2,
    ticketStatuses: [TicketStatus.ACTIVE, TicketStatus.TRANSFERRED],
    buyerIndex: 0,
    moduleValue: "EVENTOS",
  },
  {
    key: "s02",
    daysAgo: 128,
    eventRef: "growth",
    sourceType: SourceType.BOOKING,
    paymentStatus: PaymentStatus.SUCCEEDED,
    saleStatus: SaleSummaryStatus.PAID,
    grossCents: 17000,
    platformFeeCents: 1700,
    cardPlatformFeeCents: 200,
    processorFeeCents: 600,
    ticketQty: 1,
    ticketStatuses: [TicketStatus.ACTIVE],
    buyerIndex: 1,
    moduleValue: "EVENTOS",
    refundBaseCents: 2000,
  },
  {
    key: "s03",
    daysAgo: 96,
    eventRef: "main",
    sourceType: SourceType.TICKET_ORDER,
    paymentStatus: PaymentStatus.SUCCEEDED,
    saleStatus: SaleSummaryStatus.PAID,
    grossCents: 22000,
    platformFeeCents: 2200,
    cardPlatformFeeCents: 250,
    processorFeeCents: 750,
    ticketQty: 2,
    ticketStatuses: [TicketStatus.ACTIVE, TicketStatus.RESALE_LISTED],
    buyerIndex: 0,
    moduleValue: "EVENTOS",
  },
  {
    key: "s04",
    daysAgo: 76,
    eventRef: "padel",
    sourceType: SourceType.PADEL_REGISTRATION,
    paymentStatus: PaymentStatus.SUCCEEDED,
    saleStatus: SaleSummaryStatus.PAID,
    grossCents: 20000,
    platformFeeCents: 1800,
    cardPlatformFeeCents: 200,
    processorFeeCents: 700,
    ticketQty: 1,
    ticketStatuses: [TicketStatus.ACTIVE],
    buyerIndex: 2,
    moduleValue: "TORNEIOS",
  },
  {
    key: "s05",
    daysAgo: 53,
    eventRef: "growth",
    sourceType: SourceType.TICKET_ORDER,
    paymentStatus: PaymentStatus.SUCCEEDED,
    saleStatus: SaleSummaryStatus.PAID,
    grossCents: 25000,
    platformFeeCents: 2100,
    cardPlatformFeeCents: 300,
    processorFeeCents: 850,
    ticketQty: 2,
    ticketStatuses: [TicketStatus.ACTIVE, TicketStatus.ACTIVE],
    buyerIndex: 3,
    moduleValue: "EVENTOS",
  },
  {
    key: "s06",
    daysAgo: 36,
    eventRef: "main",
    sourceType: SourceType.BOOKING,
    paymentStatus: PaymentStatus.SUCCEEDED,
    saleStatus: SaleSummaryStatus.PAID,
    grossCents: 21000,
    platformFeeCents: 1900,
    cardPlatformFeeCents: 250,
    processorFeeCents: 700,
    ticketQty: 1,
    ticketStatuses: [TicketStatus.ACTIVE],
    buyerIndex: 1,
    moduleValue: "EVENTOS",
  },
  {
    key: "s07",
    daysAgo: 25,
    eventRef: "main",
    sourceType: SourceType.TICKET_ORDER,
    paymentStatus: PaymentStatus.SUCCEEDED,
    saleStatus: SaleSummaryStatus.PAID,
    grossCents: 26000,
    platformFeeCents: 2200,
    cardPlatformFeeCents: 300,
    processorFeeCents: 900,
    ticketQty: 2,
    ticketStatuses: [TicketStatus.ACTIVE, TicketStatus.REFUNDED],
    buyerIndex: 4,
    moduleValue: "EVENTOS",
    refundBaseCents: 3500,
  },
  {
    key: "s08",
    daysAgo: 15,
    eventRef: "growth",
    sourceType: SourceType.TICKET_ORDER,
    paymentStatus: PaymentStatus.SUCCEEDED,
    saleStatus: SaleSummaryStatus.PAID,
    grossCents: 23000,
    platformFeeCents: 2100,
    cardPlatformFeeCents: 250,
    processorFeeCents: 800,
    ticketQty: 2,
    ticketStatuses: [TicketStatus.ACTIVE, TicketStatus.TRANSFERRED],
    buyerIndex: 0,
    moduleValue: "EVENTOS",
  },
  {
    key: "s09",
    daysAgo: 10,
    eventRef: "main",
    sourceType: SourceType.TICKET_ORDER,
    paymentStatus: PaymentStatus.PARTIAL_REFUND,
    saleStatus: SaleSummaryStatus.REFUNDED,
    grossCents: 14000,
    platformFeeCents: 1200,
    cardPlatformFeeCents: 150,
    processorFeeCents: 500,
    ticketQty: 1,
    ticketStatuses: [TicketStatus.REFUNDED],
    buyerIndex: 5,
    moduleValue: "EVENTOS",
  },
  {
    key: "s10",
    daysAgo: 8,
    eventRef: "main",
    sourceType: SourceType.BOOKING,
    paymentStatus: PaymentStatus.REFUNDED,
    saleStatus: SaleSummaryStatus.REFUNDED,
    grossCents: 13000,
    platformFeeCents: 1100,
    cardPlatformFeeCents: 150,
    processorFeeCents: 450,
    ticketQty: 1,
    ticketStatuses: [TicketStatus.REFUNDED],
    buyerIndex: 5,
    moduleValue: "EVENTOS",
  },
  {
    key: "s11",
    daysAgo: 5,
    eventRef: "padel",
    sourceType: SourceType.PADEL_REGISTRATION,
    paymentStatus: PaymentStatus.DISPUTED,
    saleStatus: SaleSummaryStatus.REFUNDED,
    grossCents: 16500,
    platformFeeCents: 1450,
    cardPlatformFeeCents: 150,
    processorFeeCents: 550,
    ticketQty: 1,
    ticketStatuses: [TicketStatus.CHARGEBACK_LOST],
    buyerIndex: 6,
    moduleValue: "TORNEIOS",
  },
  {
    key: "s12",
    daysAgo: 3,
    eventRef: "growth",
    sourceType: SourceType.TICKET_ORDER,
    paymentStatus: PaymentStatus.CHARGEBACK_LOST,
    saleStatus: SaleSummaryStatus.REFUNDED,
    grossCents: 19000,
    platformFeeCents: 1600,
    cardPlatformFeeCents: 200,
    processorFeeCents: 650,
    ticketQty: 1,
    ticketStatuses: [TicketStatus.CHARGEBACK_LOST],
    buyerIndex: 7,
    moduleValue: "EVENTOS",
  },
  {
    key: "c01",
    daysAgo: 12,
    eventRef: "main",
    sourceType: SourceType.BOOKING,
    paymentStatus: PaymentStatus.FAILED,
    saleStatus: null,
    grossCents: 12000,
    platformFeeCents: 0,
    cardPlatformFeeCents: 0,
    processorFeeCents: 0,
    ticketQty: 0,
    ticketStatuses: [],
    buyerIndex: 0,
    moduleValue: "EVENTOS",
  },
  {
    key: "c02",
    daysAgo: 9,
    eventRef: "main",
    sourceType: SourceType.TICKET_ORDER,
    paymentStatus: PaymentStatus.CANCELLED,
    saleStatus: null,
    grossCents: 15000,
    platformFeeCents: 0,
    cardPlatformFeeCents: 0,
    processorFeeCents: 0,
    ticketQty: 0,
    ticketStatuses: [],
    buyerIndex: 1,
    moduleValue: "EVENTOS",
  },
  {
    key: "c03",
    daysAgo: 6,
    eventRef: "padel",
    sourceType: SourceType.PADEL_REGISTRATION,
    paymentStatus: PaymentStatus.CREATED,
    saleStatus: null,
    grossCents: 11000,
    platformFeeCents: 0,
    cardPlatformFeeCents: 0,
    processorFeeCents: 0,
    ticketQty: 0,
    ticketStatuses: [],
    buyerIndex: 2,
    moduleValue: "TORNEIOS",
  },
  {
    key: "c04",
    daysAgo: 2,
    eventRef: "growth",
    sourceType: SourceType.BOOKING,
    paymentStatus: PaymentStatus.REQUIRES_ACTION,
    saleStatus: null,
    grossCents: 18000,
    platformFeeCents: 0,
    cardPlatformFeeCents: 0,
    processorFeeCents: 0,
    ticketQty: 0,
    ticketStatuses: [],
    buyerIndex: 3,
    moduleValue: "EVENTOS",
  },
];

function shouldWriteFinancialLedger(status: PaymentStatus) {
  return (
    status === PaymentStatus.SUCCEEDED ||
    status === PaymentStatus.PARTIAL_REFUND ||
    status === PaymentStatus.REFUNDED ||
    status === PaymentStatus.DISPUTED ||
    status === PaymentStatus.CHARGEBACK_WON ||
    status === PaymentStatus.CHARGEBACK_LOST
  );
}

function computeNetCentsForSale(params: {
  status: SaleSummaryStatus;
  grossCents: number;
  platformFeeCents: number;
  cardPlatformFeeCents: number;
  processorFeeCents: number;
}) {
  const netBase =
    params.grossCents -
    params.platformFeeCents -
    params.cardPlatformFeeCents -
    params.processorFeeCents;

  if (params.status === SaleSummaryStatus.PAID) return Math.max(0, netBase);
  if (params.status === SaleSummaryStatus.PARTIAL_REFUND) return Math.max(0, Math.floor(netBase * 0.5));
  return 0;
}

function computeNetForAnalytics(params: {
  status: PaymentStatus;
  grossCents: number;
  platformFeeCents: number;
  cardPlatformFeeCents: number;
  processorFeeCents: number;
}) {
  const totalPlatform = params.platformFeeCents + params.cardPlatformFeeCents;
  const netBase = params.grossCents - totalPlatform - params.processorFeeCents;
  switch (params.status) {
    case PaymentStatus.SUCCEEDED:
      return Math.max(0, netBase);
    case PaymentStatus.PARTIAL_REFUND:
      return Math.max(0, Math.floor(netBase * 0.5));
    case PaymentStatus.REFUNDED:
      return 0;
    case PaymentStatus.DISPUTED:
    case PaymentStatus.CHARGEBACK_LOST:
      return -Math.max(250, params.processorFeeCents);
    case PaymentStatus.CHARGEBACK_WON:
      return Math.max(0, netBase);
    default:
      return 0;
  }
}

async function resolveOwnerProfile() {
  if (ownerUserIdFromEnv) {
    const explicit = await prisma.profile.findUnique({
      where: { id: ownerUserIdFromEnv },
      select: { id: true, username: true, fullName: true },
    });
    if (!explicit) {
      throw new Error(`ANALYTICS_FINANCE_OWNER_USER_ID not found: ${ownerUserIdFromEnv}`);
    }
    return explicit;
  }

  const fallback = await prisma.profile.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true, fullName: true },
  });
  if (!fallback) {
    throw new Error("No profile available to assign as organization owner.");
  }
  return fallback;
}

async function ensureOrganization(ownerUserId: string) {
  const existing = await prisma.organization.findFirst({
    where: { username: { equals: orgUsername, mode: "insensitive" } },
    select: { id: true, groupId: true, username: true, publicName: true },
  });

  if (existing) {
    return prisma.organization.update({
      where: { id: existing.id },
      data: {
        status: OrganizationStatus.ACTIVE,
        username: existing.username ?? orgUsername,
        publicName: existing.publicName || orgPublicName,
        businessName: orgPublicName,
        timezone: "Europe/Lisbon",
        officialEmail: supportEmail,
        officialEmailVerifiedAt: now,
        stripeAccountId: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
      },
      select: { id: true, groupId: true, username: true, publicName: true },
    });
  }

  const group = await prisma.organizationGroup.create({
    data: { ownerUserId },
    select: { id: true },
  });

  return prisma.organization.create({
    data: {
      groupId: group.id,
      username: orgUsername,
      publicName: orgPublicName,
      businessName: orgPublicName,
      status: OrganizationStatus.ACTIVE,
      timezone: "Europe/Lisbon",
      primaryModule: OrganizationModule.EVENTOS,
      officialEmail: supportEmail,
      officialEmailVerifiedAt: now,
    },
    select: { id: true, groupId: true, username: true, publicName: true },
  });
}

async function ensureOwnerMembership(params: { groupId: number; organizationId: number; userId: string }) {
  const { groupId, organizationId, userId } = params;
  await prisma.organizationGroupMember.upsert({
    where: {
      groupId_userId: {
        groupId,
        userId,
      },
    },
    update: {
      role: OrganizationMemberRole.OWNER,
      scopeAllOrgs: true,
      scopeOrgIds: [],
    },
    create: {
      groupId,
      userId,
      role: OrganizationMemberRole.OWNER,
      scopeAllOrgs: true,
      scopeOrgIds: [organizationId],
    },
  });
}

async function ensureOrganizationModules(organizationId: number) {
  const modules: OrganizationModule[] = [
    OrganizationModule.ANALYTICS,
    OrganizationModule.FINANCEIRO,
    OrganizationModule.EVENTOS,
    OrganizationModule.TORNEIOS,
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
      create: { organizationId, moduleKey, enabled: true },
    });
  }
}

async function ensureInvoicingSettings(organizationId: number) {
  await prisma.organizationSettings.upsert({
    where: { organizationId },
    update: {
      invoicingMode: InvoicingMode.EXTERNAL_SOFTWARE,
      invoicingSoftwareName: "Seed Invoice Pro",
      invoicingNotes: "Seed QA split analytics/finance",
      invoicingAcknowledgedAt: now,
    },
    create: {
      organizationId,
      invoicingMode: InvoicingMode.EXTERNAL_SOFTWARE,
      invoicingSoftwareName: "Seed Invoice Pro",
      invoicingNotes: "Seed QA split analytics/finance",
      invoicingAcknowledgedAt: now,
    },
  });
}

async function seedPermissionPersonas(params: { groupId: number; organizationId: number; ownerId: string }) {
  const { groupId, organizationId, ownerId } = params;
  const extraProfiles = await prisma.profile.findMany({
    where: { id: { not: ownerId } },
    orderBy: { createdAt: "asc" },
    take: 2,
    select: { id: true, username: true },
  });

  if (extraProfiles.length === 0) {
    return { analyticsOnlyUserId: null as string | null, financeOnlyUserId: null as string | null };
  }

  const analyticsOnly = extraProfiles[0];
  await prisma.organizationGroupMember.upsert({
    where: {
      groupId_userId: {
        groupId,
        userId: analyticsOnly.id,
      },
    },
    update: {
      role: OrganizationMemberRole.STAFF,
      scopeAllOrgs: false,
      scopeOrgIds: [organizationId],
    },
    create: {
      groupId,
      userId: analyticsOnly.id,
      role: OrganizationMemberRole.STAFF,
      scopeAllOrgs: false,
      scopeOrgIds: [organizationId],
    },
  });
  await prisma.organizationMemberPermission.deleteMany({
    where: {
      organizationId,
      userId: analyticsOnly.id,
      moduleKey: { in: [OrganizationModule.ANALYTICS, OrganizationModule.FINANCEIRO] },
      scopeType: null,
      scopeId: null,
    },
  });
  await prisma.organizationMemberPermission.createMany({
    data: [
      {
        organizationId,
        userId: analyticsOnly.id,
        moduleKey: OrganizationModule.ANALYTICS,
        accessLevel: OrganizationPermissionLevel.VIEW,
        scopeType: null,
        scopeId: null,
      },
      {
        organizationId,
        userId: analyticsOnly.id,
        moduleKey: OrganizationModule.FINANCEIRO,
        accessLevel: OrganizationPermissionLevel.NONE,
        scopeType: null,
        scopeId: null,
      },
    ],
  });

  const financeOnly = extraProfiles[1] ?? null;
  if (!financeOnly) {
    return { analyticsOnlyUserId: analyticsOnly.id, financeOnlyUserId: null as string | null };
  }

  await prisma.organizationGroupMember.upsert({
    where: {
      groupId_userId: {
        groupId,
        userId: financeOnly.id,
      },
    },
    update: {
      role: OrganizationMemberRole.STAFF,
      scopeAllOrgs: false,
      scopeOrgIds: [organizationId],
    },
    create: {
      groupId,
      userId: financeOnly.id,
      role: OrganizationMemberRole.STAFF,
      scopeAllOrgs: false,
      scopeOrgIds: [organizationId],
    },
  });
  await prisma.organizationMemberPermission.deleteMany({
    where: {
      organizationId,
      userId: financeOnly.id,
      moduleKey: { in: [OrganizationModule.ANALYTICS, OrganizationModule.FINANCEIRO] },
      scopeType: null,
      scopeId: null,
    },
  });
  await prisma.organizationMemberPermission.createMany({
    data: [
      {
        organizationId,
        userId: financeOnly.id,
        moduleKey: OrganizationModule.ANALYTICS,
        accessLevel: OrganizationPermissionLevel.NONE,
        scopeType: null,
        scopeId: null,
      },
      {
        organizationId,
        userId: financeOnly.id,
        moduleKey: OrganizationModule.FINANCEIRO,
        accessLevel: OrganizationPermissionLevel.VIEW,
        scopeType: null,
        scopeId: null,
      },
    ],
  });

  return { analyticsOnlyUserId: analyticsOnly.id, financeOnlyUserId: financeOnly.id };
}

async function cleanupSeedData(organizationId: number) {
  const events = await prisma.event.findMany({
    where: {
      organizationId,
      slug: { startsWith: eventSlugPrefix },
    },
    select: { id: true },
  });
  const eventIds = events.map((item) => item.id);
  const saleSummaries = await prisma.saleSummary.findMany({
    where: {
      purchaseId: { startsWith: purchasePrefix },
    },
    select: { id: true },
  });
  const saleSummaryIds = saleSummaries.map((item) => item.id);

  await prisma.activityFeedItem.deleteMany({
    where: { organizationId, eventType: { startsWith: `${prefix}.` } },
  });
  await prisma.eventLog.deleteMany({
    where: { organizationId, eventType: { startsWith: `${prefix}.` } },
  });
  await prisma.entitlement.deleteMany({
    where: {
      OR: [
        { purchaseId: { startsWith: purchasePrefix } },
        { ownerKey: { startsWith: `${prefix}:` } },
      ],
    },
  });
  await prisma.guestTicketLink.deleteMany({
    where: { ticketId: { startsWith: ticketPrefix } },
  });
  await prisma.ticket.deleteMany({
    where: {
      OR: [{ id: { startsWith: ticketPrefix } }, { purchaseId: { startsWith: purchasePrefix } }],
    },
  });
  if (saleSummaryIds.length) {
    await prisma.saleLine.deleteMany({
      where: { saleSummaryId: { in: saleSummaryIds } },
    });
  }
  await prisma.saleSummary.deleteMany({
    where: { purchaseId: { startsWith: purchasePrefix } },
  });
  await prisma.refund.deleteMany({
    where: {
      OR: [{ dedupeKey: { startsWith: `${prefix}_refund_` } }, { purchaseId: { startsWith: purchasePrefix } }],
    },
  });
  await prisma.ledgerEntry.deleteMany({
    where: { paymentId: { startsWith: purchasePrefix } },
  });
  await prisma.paymentSnapshot.deleteMany({
    where: { paymentId: { startsWith: purchasePrefix } },
  });
  await prisma.payment.deleteMany({
    where: { id: { startsWith: purchasePrefix } },
  });
  await prisma.analyticsRollup.deleteMany({
    where: {
      organizationId,
      bucketDate: {
        gte: startOfUtcDay(daysAgo(220)),
        lte: startOfUtcDay(now),
      },
      dimensionKey: { in: [AnalyticsDimensionKey.MODULE, AnalyticsDimensionKey.CURRENCY, AnalyticsDimensionKey.SOURCE_TYPE] },
    },
  });
  if (eventIds.length) {
    await prisma.ticketType.deleteMany({
      where: {
        eventId: { in: eventIds },
        name: { startsWith: prefix },
      },
    });
  }
}

async function ensureEvents(params: { organizationId: number; ownerUserId: string }) {
  const { organizationId, ownerUserId } = params;

  const definitions: Array<{
    ref: SeedEventRef;
    slug: string;
    title: string;
    templateType: EventTemplateType;
    startsAt: Date;
    endsAt: Date;
  }> = [
    {
      ref: "main",
      slug: `${eventSlugPrefix}main_open`,
      title: `${prefix} Main Open`,
      templateType: EventTemplateType.PARTY,
      startsAt: daysAgo(40, 18),
      endsAt: daysAgo(40, 22),
    },
    {
      ref: "growth",
      slug: `${eventSlugPrefix}growth_week`,
      title: `${prefix} Growth Week`,
      templateType: EventTemplateType.TALK,
      startsAt: daysAgo(8, 16),
      endsAt: daysAgo(8, 20),
    },
    {
      ref: "padel",
      slug: `${eventSlugPrefix}padel_cup`,
      title: `${prefix} Padel Cup`,
      templateType: EventTemplateType.PADEL,
      startsAt: daysAgo(2, 11),
      endsAt: daysAgo(2, 17),
    },
  ];

  const result = {} as Record<SeedEventRef, { id: number; title: string; startsAt: Date; timezone: string }>;
  for (const eventDef of definitions) {
    const event = await prisma.event.upsert({
      where: { slug: eventDef.slug },
      update: {
        organizationId,
        ownerUserId,
        title: eventDef.title,
        description: `Dataset ${prefix} for analytics/finance split QA.`,
        status: EventStatus.PUBLISHED,
        templateType: eventDef.templateType,
        startsAt: eventDef.startsAt,
        endsAt: eventDef.endsAt,
        timezone: "Europe/Lisbon",
        pricingMode: EventPricingMode.STANDARD,
      },
      create: {
        slug: eventDef.slug,
        organizationId,
        ownerUserId,
        title: eventDef.title,
        description: `Dataset ${prefix} for analytics/finance split QA.`,
        status: EventStatus.PUBLISHED,
        templateType: eventDef.templateType,
        startsAt: eventDef.startsAt,
        endsAt: eventDef.endsAt,
        timezone: "Europe/Lisbon",
        pricingMode: EventPricingMode.STANDARD,
      },
      select: { id: true, title: true, startsAt: true, timezone: true },
    });
    result[eventDef.ref] = event;
  }

  return result;
}

async function ensureTicketTypes(eventMap: Record<SeedEventRef, { id: number }>) {
  const defs: Array<{ ref: SeedEventRef; name: string; price: number }> = [
    { ref: "main", name: `${prefix} Standard`, price: 14000 },
    { ref: "growth", name: `${prefix} Premium`, price: 17000 },
    { ref: "padel", name: `${prefix} Padel Entry`, price: 16000 },
  ];

  const output = {} as Record<SeedEventRef, { id: number; price: number }>;
  for (const def of defs) {
    const existing = await prisma.ticketType.findFirst({
      where: { eventId: eventMap[def.ref].id, name: def.name },
      select: { id: true },
    });
    if (existing) {
      const updated = await prisma.ticketType.update({
        where: { id: existing.id },
        data: {
          description: "Seeded test ticket type",
          price: def.price,
          currency: "EUR",
          totalQuantity: 300,
          soldQuantity: 0,
          status: TicketTypeStatus.ON_SALE,
          sortOrder: 1,
        },
        select: { id: true, price: true },
      });
      output[def.ref] = updated;
      continue;
    }
    const created = await prisma.ticketType.create({
      data: {
        eventId: eventMap[def.ref].id,
        name: def.name,
        description: "Seeded test ticket type",
        price: def.price,
        currency: "EUR",
        totalQuantity: 300,
        soldQuantity: 0,
        status: TicketTypeStatus.ON_SALE,
        sortOrder: 1,
      },
      select: { id: true, price: true },
    });
    output[def.ref] = created;
  }
  return output;
}

async function seedOpsFeed(params: { organizationId: number; actorUserId: string }) {
  const { organizationId, actorUserId } = params;
  const opsTypes = [
    `${prefix}.finance.invoicing.updated`,
    `${prefix}.finance.payouts.connect.requested`,
    `${prefix}.finance.refund.created`,
    `${prefix}.finance.reconciliation.closed`,
    `${prefix}.analytics.rollup.materialized`,
    `${prefix}.finance.export.generated`,
    `${prefix}.finance.ledger.snapshot`,
    `${prefix}.analytics.conversion.recomputed`,
  ];
  const rows = opsTypes.map((eventType, index) => {
    const eventId = stableUuid(`${prefix}:op:event:${index}`);
    const createdAt = new Date(Date.now() - index * 60 * 60 * 1000);
    return {
      eventType,
      eventId,
      createdAt,
      sourceType: index % 2 === 0 ? SourceType.TICKET_ORDER : SourceType.BOOKING,
      sourceId: `${prefix}:ops:${index}`,
      idempotencyKey: `${prefix}:ops:idempotency:${index}`,
    };
  });

  for (const row of rows) {
    await prisma.eventLog.upsert({
      where: {
        organizationId_eventType_idempotencyKey: {
          organizationId,
          eventType: row.eventType,
          idempotencyKey: row.idempotencyKey,
        },
      },
      update: {
        payload: { seedTag, sourceId: row.sourceId },
        actorUserId,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        correlationId: row.eventId,
        causationId: `${row.eventId}:cause`,
        createdAt: row.createdAt,
      },
      create: {
        id: row.eventId,
        organizationId,
        eventType: row.eventType,
        eventVersion: "1.0.0",
        idempotencyKey: row.idempotencyKey,
        payload: { seedTag, sourceId: row.sourceId },
        actorUserId,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        subjectType: "SEED_OPS",
        subjectId: row.sourceId,
        correlationId: row.eventId,
        causationId: `${row.eventId}:cause`,
        createdAt: row.createdAt,
      },
    });

    await prisma.activityFeedItem.upsert({
      where: { eventId: row.eventId },
      update: {
        organizationId,
        eventType: row.eventType,
        actorUserId,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        correlationId: row.eventId,
        createdAt: row.createdAt,
      },
      create: {
        id: stableUuid(`${prefix}:op:item:${row.eventId}`),
        organizationId,
        eventId: row.eventId,
        eventType: row.eventType,
        actorUserId,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        correlationId: row.eventId,
        createdAt: row.createdAt,
      },
    });
  }
}

async function main() {
  const owner = await resolveOwnerProfile();
  const organization = await ensureOrganization(owner.id);
  await ensureOwnerMembership({
    groupId: organization.groupId,
    organizationId: organization.id,
    userId: owner.id,
  });
  await ensureOrganizationModules(organization.id);
  await ensureInvoicingSettings(organization.id);

  const personas = await seedPermissionPersonas({
    groupId: organization.groupId,
    organizationId: organization.id,
    ownerId: owner.id,
  });

  await cleanupSeedData(organization.id);

  const eventMap = await ensureEvents({
    organizationId: organization.id,
    ownerUserId: owner.id,
  });
  const ticketTypeMap = await ensureTicketTypes(eventMap);

  const buyerIdentityIds = Array.from({ length: 8 }).map((_, idx) =>
    stableUuid(`${prefix}:buyer:${idx + 1}`),
  );
  const candidateTicketUsers = [
    owner.id,
    personas.analyticsOnlyUserId,
    personas.financeOnlyUserId,
  ].filter((value): value is string => Boolean(value));

  const rollups = new Map<string, number>();
  const rollupRows: Array<{
    bucketDate: Date;
    metricKey: AnalyticsMetricKey;
    dimensionKey: AnalyticsDimensionKey;
    dimensionValue: string;
    value: number;
  }> = [];
  const addRollup = (params: {
    bucketDate: Date;
    metricKey: AnalyticsMetricKey;
    dimensionKey: AnalyticsDimensionKey;
    dimensionValue: string;
    value: number;
  }) => {
    const key = [
      params.bucketDate.toISOString().slice(0, 10),
      params.metricKey,
      params.dimensionKey,
      params.dimensionValue,
    ].join("|");
    rollups.set(key, (rollups.get(key) ?? 0) + params.value);
  };

  for (const scenario of scenarios) {
    const event = eventMap[scenario.eventRef];
    const ticketType = ticketTypeMap[scenario.eventRef];
    const createdAt = daysAgo(scenario.daysAgo, 12);
    const paymentId = `${purchasePrefix}${scenario.key}`;
    const paymentIntentId = `${paymentId}_intent`;
    const totalPlatform = scenario.platformFeeCents + scenario.cardPlatformFeeCents;

    await prisma.payment.upsert({
      where: { id: paymentId },
      update: {
        organizationId: organization.id,
        sourceType: scenario.sourceType,
        sourceId: String(event.id),
        customerIdentityId: buyerIdentityIds[scenario.buyerIndex],
        status: scenario.paymentStatus,
        feePolicyVersion: "seed.split.v1",
        pricingSnapshotJson: {
          seedTag,
          grossCents: scenario.grossCents,
          platformFeeCents: scenario.platformFeeCents,
          cardPlatformFeeCents: scenario.cardPlatformFeeCents,
          processorFeeCents: scenario.processorFeeCents,
        },
        pricingSnapshotHash: crypto
          .createHash("sha256")
          .update(JSON.stringify([seedTag, paymentId, scenario.grossCents]))
          .digest("hex"),
        processorFeesStatus: ProcessorFeesStatus.FINAL,
        processorFeesActual: scenario.processorFeeCents,
        idempotencyKey: `${paymentId}:idem`,
        createdAt,
      },
      create: {
        id: paymentId,
        organizationId: organization.id,
        sourceType: scenario.sourceType,
        sourceId: String(event.id),
        customerIdentityId: buyerIdentityIds[scenario.buyerIndex],
        status: scenario.paymentStatus,
        feePolicyVersion: "seed.split.v1",
        pricingSnapshotJson: {
          seedTag,
          grossCents: scenario.grossCents,
          platformFeeCents: scenario.platformFeeCents,
          cardPlatformFeeCents: scenario.cardPlatformFeeCents,
          processorFeeCents: scenario.processorFeeCents,
        },
        pricingSnapshotHash: crypto
          .createHash("sha256")
          .update(JSON.stringify([seedTag, paymentId, scenario.grossCents]))
          .digest("hex"),
        processorFeesStatus: ProcessorFeesStatus.FINAL,
        processorFeesActual: scenario.processorFeeCents,
        idempotencyKey: `${paymentId}:idem`,
        createdAt,
      },
    });

    await prisma.paymentSnapshot.upsert({
      where: { paymentId },
      update: {
        organizationId: organization.id,
        sourceType: scenario.sourceType,
        sourceId: String(event.id),
        status: scenario.paymentStatus,
        currency: "EUR",
        grossCents: scenario.grossCents,
        platformFeeCents: totalPlatform,
        processorFeesCents: scenario.processorFeeCents,
        netToOrgCents: computeNetForAnalytics({
          status: scenario.paymentStatus,
          grossCents: scenario.grossCents,
          platformFeeCents: scenario.platformFeeCents,
          cardPlatformFeeCents: scenario.cardPlatformFeeCents,
          processorFeeCents: scenario.processorFeeCents,
        }),
        lastEventId: stableUuid(`${prefix}:snapshot:event:${scenario.key}`),
      },
      create: {
        paymentId,
        organizationId: organization.id,
        sourceType: scenario.sourceType,
        sourceId: String(event.id),
        status: scenario.paymentStatus,
        currency: "EUR",
        grossCents: scenario.grossCents,
        platformFeeCents: totalPlatform,
        processorFeesCents: scenario.processorFeeCents,
        netToOrgCents: computeNetForAnalytics({
          status: scenario.paymentStatus,
          grossCents: scenario.grossCents,
          platformFeeCents: scenario.platformFeeCents,
          cardPlatformFeeCents: scenario.cardPlatformFeeCents,
          processorFeeCents: scenario.processorFeeCents,
        }),
        lastEventId: stableUuid(`${prefix}:snapshot:event:${scenario.key}`),
      },
    });

    await prisma.ledgerEntry.deleteMany({
      where: { paymentId },
    });

    if (shouldWriteFinancialLedger(scenario.paymentStatus)) {
      const ledgerBaseDate = new Date(createdAt.getTime() + 5 * 60 * 1000);
      const ledgerRows: Array<{
        entryType: LedgerEntryType;
        amount: number;
        causationId: string;
      }> = [
        {
          entryType: LedgerEntryType.GROSS,
          amount: scenario.grossCents,
          causationId: `${paymentId}:gross`,
        },
        {
          entryType: LedgerEntryType.PLATFORM_FEE,
          amount: -totalPlatform,
          causationId: `${paymentId}:platform`,
        },
        {
          entryType: LedgerEntryType.PROCESSOR_FEES_FINAL,
          amount: -scenario.processorFeeCents,
          causationId: `${paymentId}:processor`,
        },
      ];

      if (
        scenario.paymentStatus === PaymentStatus.PARTIAL_REFUND ||
        scenario.paymentStatus === PaymentStatus.REFUNDED
      ) {
        const factor = scenario.paymentStatus === PaymentStatus.PARTIAL_REFUND ? 0.5 : 1;
        ledgerRows.push(
          {
            entryType: LedgerEntryType.REFUND_GROSS,
            amount: -Math.floor(scenario.grossCents * factor),
            causationId: `${paymentId}:refund:gross`,
          },
          {
            entryType: LedgerEntryType.REFUND_PLATFORM_FEE_REVERSAL,
            amount: Math.floor(totalPlatform * factor),
            causationId: `${paymentId}:refund:platform`,
          },
          {
            entryType: LedgerEntryType.REFUND_PROCESSOR_FEES_REVERSAL,
            amount: Math.floor(scenario.processorFeeCents * factor),
            causationId: `${paymentId}:refund:processor`,
          },
        );
      }

      if (
        scenario.paymentStatus === PaymentStatus.DISPUTED ||
        scenario.paymentStatus === PaymentStatus.CHARGEBACK_LOST
      ) {
        ledgerRows.push(
          {
            entryType: LedgerEntryType.CHARGEBACK_GROSS,
            amount: -scenario.grossCents,
            causationId: `${paymentId}:chargeback:gross`,
          },
          {
            entryType: LedgerEntryType.CHARGEBACK_PLATFORM_FEE_REVERSAL,
            amount: totalPlatform,
            causationId: `${paymentId}:chargeback:platform`,
          },
          {
            entryType: LedgerEntryType.DISPUTE_FEE,
            amount: -250,
            causationId: `${paymentId}:chargeback:fee`,
          },
        );
      }

      await prisma.ledgerEntry.createMany({
        data: ledgerRows.map((row, idx) => ({
          paymentId,
          entryType: row.entryType,
          amount: row.amount,
          currency: "EUR",
          sourceType: scenario.sourceType,
          sourceId: String(event.id),
          causationId: row.causationId,
          correlationId: paymentId,
          createdAt: new Date(ledgerBaseDate.getTime() + idx * 60 * 1000),
        })),
      });
    }

    if (scenario.saleStatus) {
      const netCents = computeNetCentsForSale({
        status: scenario.saleStatus,
        grossCents: scenario.grossCents,
        platformFeeCents: scenario.platformFeeCents,
        cardPlatformFeeCents: scenario.cardPlatformFeeCents,
        processorFeeCents: scenario.processorFeeCents,
      });

      const summary = await prisma.saleSummary.upsert({
        where: { purchaseId: paymentId },
        update: {
          eventId: event.id,
          userId: candidateTicketUsers.length ? candidateTicketUsers[scenario.buyerIndex % candidateTicketUsers.length] : null,
          ownerUserId: candidateTicketUsers.length ? candidateTicketUsers[scenario.buyerIndex % candidateTicketUsers.length] : null,
          ownerIdentityId: buyerIdentityIds[scenario.buyerIndex],
          paymentIntentId,
          subtotalCents: scenario.grossCents,
          discountCents: 0,
          platformFeeCents: scenario.platformFeeCents,
          cardPlatformFeeCents: scenario.cardPlatformFeeCents,
          stripeFeeCents: scenario.processorFeeCents,
          totalCents: scenario.grossCents,
          netCents,
          feeMode: FeeMode.INCLUDED,
          paymentMethod: "card",
          currency: "EUR",
          status: scenario.saleStatus,
          createdAt,
        },
        create: {
          eventId: event.id,
          userId: candidateTicketUsers.length ? candidateTicketUsers[scenario.buyerIndex % candidateTicketUsers.length] : null,
          ownerUserId: candidateTicketUsers.length ? candidateTicketUsers[scenario.buyerIndex % candidateTicketUsers.length] : null,
          ownerIdentityId: buyerIdentityIds[scenario.buyerIndex],
          purchaseId: paymentId,
          paymentIntentId,
          subtotalCents: scenario.grossCents,
          discountCents: 0,
          platformFeeCents: scenario.platformFeeCents,
          cardPlatformFeeCents: scenario.cardPlatformFeeCents,
          stripeFeeCents: scenario.processorFeeCents,
          totalCents: scenario.grossCents,
          netCents,
          feeMode: FeeMode.INCLUDED,
          paymentMethod: "card",
          currency: "EUR",
          status: scenario.saleStatus,
          createdAt,
        },
        select: { id: true },
      });

      await prisma.saleLine.deleteMany({
        where: { saleSummaryId: summary.id },
      });
      const saleLine = await prisma.saleLine.create({
        data: {
          saleSummaryId: summary.id,
          eventId: event.id,
          ticketTypeId: ticketType.id,
          quantity: Math.max(1, scenario.ticketQty),
          unitPriceCents: Math.floor(scenario.grossCents / Math.max(1, scenario.ticketQty)),
          discountPerUnitCents: 0,
          grossCents: scenario.grossCents,
          netCents,
          platformFeeCents: totalPlatform,
          createdAt,
        },
        select: { id: true },
      });

      for (let idx = 0; idx < scenario.ticketQty; idx += 1) {
        const ticketId = `${ticketPrefix}${scenario.key}_${idx + 1}`;
        const selectedStatus = scenario.ticketStatuses[idx] ?? TicketStatus.ACTIVE;
        const assignedUser =
          candidateTicketUsers.length > 0 && idx % 2 === 0
            ? candidateTicketUsers[(scenario.buyerIndex + idx) % candidateTicketUsers.length]
            : null;
        const unitPaid = Math.floor(scenario.grossCents / Math.max(1, scenario.ticketQty));
        const unitFee = Math.floor(totalPlatform / Math.max(1, scenario.ticketQty));

        await prisma.ticket.upsert({
          where: { id: ticketId },
          update: {
            eventId: event.id,
            ticketTypeId: ticketType.id,
            purchasedAt: createdAt,
            status: selectedStatus,
            qrSecret: `${ticketId}_qr`,
            pricePaid: unitPaid,
            totalPaidCents: unitPaid,
            platformFeeCents: unitFee,
            purchaseId: paymentId,
            stripePaymentIntentId: paymentIntentId,
            emissionIndex: idx,
            saleSummaryId: summary.id,
            userId: assignedUser,
            ownerUserId: assignedUser,
            ownerIdentityId: assignedUser ? null : buyerIdentityIds[scenario.buyerIndex],
            currency: "EUR",
          },
          create: {
            id: ticketId,
            eventId: event.id,
            ticketTypeId: ticketType.id,
            purchasedAt: createdAt,
            status: selectedStatus,
            qrSecret: `${ticketId}_qr`,
            pricePaid: unitPaid,
            totalPaidCents: unitPaid,
            platformFeeCents: unitFee,
            purchaseId: paymentId,
            stripePaymentIntentId: paymentIntentId,
            emissionIndex: idx,
            saleSummaryId: summary.id,
            userId: assignedUser,
            ownerUserId: assignedUser,
            ownerIdentityId: assignedUser ? null : buyerIdentityIds[scenario.buyerIndex],
            currency: "EUR",
          },
        });

        if (!assignedUser) {
          await prisma.guestTicketLink.upsert({
            where: { ticketId },
            update: {
              guestEmail: `${scenario.key}.${idx + 1}@seed-demo.test`,
              guestName: `Seed Guest ${scenario.key.toUpperCase()}-${idx + 1}`,
              guestPhone: "+351900000000",
            },
            create: {
              ticketId,
              guestEmail: `${scenario.key}.${idx + 1}@seed-demo.test`,
              guestName: `Seed Guest ${scenario.key.toUpperCase()}-${idx + 1}`,
              guestPhone: "+351900000000",
            },
          });
        }

        await prisma.entitlement.upsert({
          where: { id: stableUuid(`${prefix}:entitlement:${scenario.key}:${idx}`) },
          update: {
            type: EntitlementType.EVENT_TICKET,
            status: EntitlementStatus.ACTIVE,
            ownerUserId: assignedUser,
            ownerIdentityId: assignedUser ? null : buyerIdentityIds[scenario.buyerIndex],
            ownerKey: `${prefix}:owner:${scenario.buyerIndex}:${idx}`,
            purchaseId: paymentId,
            saleLineId: saleLine.id,
            ticketId,
            lineItemIndex: idx,
            eventId: event.id,
            snapshotTitle: event.title,
            snapshotCoverUrl: null,
            snapshotVenueName: `Venue ${scenario.eventRef}`,
            snapshotStartAt: event.startsAt,
            snapshotTimezone: event.timezone,
            policyVersionApplied: 1,
            createdAt,
          },
          create: {
            id: stableUuid(`${prefix}:entitlement:${scenario.key}:${idx}`),
            type: EntitlementType.EVENT_TICKET,
            status: EntitlementStatus.ACTIVE,
            ownerUserId: assignedUser,
            ownerIdentityId: assignedUser ? null : buyerIdentityIds[scenario.buyerIndex],
            ownerKey: `${prefix}:owner:${scenario.buyerIndex}:${idx}`,
            purchaseId: paymentId,
            saleLineId: saleLine.id,
            ticketId,
            lineItemIndex: idx,
            eventId: event.id,
            snapshotTitle: event.title,
            snapshotCoverUrl: null,
            snapshotVenueName: `Venue ${scenario.eventRef}`,
            snapshotStartAt: event.startsAt,
            snapshotTimezone: event.timezone,
            policyVersionApplied: 1,
            createdAt,
          },
        });
      }
    }

    if (scenario.refundBaseCents && scenario.saleStatus === SaleSummaryStatus.PAID) {
      await prisma.refund.upsert({
        where: { dedupeKey: `${prefix}_refund_${scenario.key}` },
        update: {
          purchaseId: paymentId,
          paymentIntentId,
          eventId: event.id,
          baseAmountCents: scenario.refundBaseCents,
          feesExcludedCents: totalPlatform + scenario.processorFeeCents,
          reason: "CANCELLED",
          refundedBy: "seed-script",
          refundedAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
          auditPayload: { seedTag, scenario: scenario.key },
        },
        create: {
          dedupeKey: `${prefix}_refund_${scenario.key}`,
          purchaseId: paymentId,
          paymentIntentId,
          eventId: event.id,
          baseAmountCents: scenario.refundBaseCents,
          feesExcludedCents: totalPlatform + scenario.processorFeeCents,
          reason: "CANCELLED",
          refundedBy: "seed-script",
          refundedAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
          auditPayload: { seedTag, scenario: scenario.key },
        },
      });
    }

    const bucketDate = startOfUtcDay(createdAt);
    const grossForAnalytics =
      scenario.paymentStatus === PaymentStatus.SUCCEEDED ||
      scenario.paymentStatus === PaymentStatus.PARTIAL_REFUND ||
      scenario.paymentStatus === PaymentStatus.REFUNDED ||
      scenario.paymentStatus === PaymentStatus.DISPUTED ||
      scenario.paymentStatus === PaymentStatus.CHARGEBACK_WON ||
      scenario.paymentStatus === PaymentStatus.CHARGEBACK_LOST
        ? scenario.grossCents
        : 0;
    const platformForAnalytics = grossForAnalytics > 0 ? totalPlatform : 0;
    const processorForAnalytics = grossForAnalytics > 0 ? scenario.processorFeeCents : 0;
    const netForAnalytics = computeNetForAnalytics({
      status: scenario.paymentStatus,
      grossCents: scenario.grossCents,
      platformFeeCents: scenario.platformFeeCents,
      cardPlatformFeeCents: scenario.cardPlatformFeeCents,
      processorFeeCents: scenario.processorFeeCents,
    });

    addRollup({
      bucketDate,
      dimensionKey: AnalyticsDimensionKey.MODULE,
      dimensionValue: scenario.moduleValue,
      metricKey: AnalyticsMetricKey.GROSS,
      value: grossForAnalytics,
    });
    addRollup({
      bucketDate,
      dimensionKey: AnalyticsDimensionKey.MODULE,
      dimensionValue: scenario.moduleValue,
      metricKey: AnalyticsMetricKey.PLATFORM_FEES,
      value: platformForAnalytics,
    });
    addRollup({
      bucketDate,
      dimensionKey: AnalyticsDimensionKey.MODULE,
      dimensionValue: scenario.moduleValue,
      metricKey: AnalyticsMetricKey.PROCESSOR_FEES,
      value: processorForAnalytics,
    });
    addRollup({
      bucketDate,
      dimensionKey: AnalyticsDimensionKey.MODULE,
      dimensionValue: scenario.moduleValue,
      metricKey: AnalyticsMetricKey.NET_TO_ORG,
      value: netForAnalytics,
    });
    addRollup({
      bucketDate,
      dimensionKey: AnalyticsDimensionKey.SOURCE_TYPE,
      dimensionValue: scenario.sourceType,
      metricKey: AnalyticsMetricKey.GROSS,
      value: grossForAnalytics,
    });
    addRollup({
      bucketDate,
      dimensionKey: AnalyticsDimensionKey.CURRENCY,
      dimensionValue: "EUR",
      metricKey: AnalyticsMetricKey.GROSS,
      value: grossForAnalytics,
    });
  }

  const todayBucket = startOfUtcDay(now);
  addRollup({
    bucketDate: todayBucket,
    dimensionKey: AnalyticsDimensionKey.MODULE,
    dimensionValue: "EVENTOS",
    metricKey: AnalyticsMetricKey.GROSS,
    value: 22000,
  });
  addRollup({
    bucketDate: todayBucket,
    dimensionKey: AnalyticsDimensionKey.MODULE,
    dimensionValue: "EVENTOS",
    metricKey: AnalyticsMetricKey.PLATFORM_FEES,
    value: 2200,
  });
  addRollup({
    bucketDate: todayBucket,
    dimensionKey: AnalyticsDimensionKey.MODULE,
    dimensionValue: "EVENTOS",
    metricKey: AnalyticsMetricKey.PROCESSOR_FEES,
    value: 700,
  });
  addRollup({
    bucketDate: todayBucket,
    dimensionKey: AnalyticsDimensionKey.MODULE,
    dimensionValue: "EVENTOS",
    metricKey: AnalyticsMetricKey.NET_TO_ORG,
    value: 19100,
  });
  addRollup({
    bucketDate: todayBucket,
    dimensionKey: AnalyticsDimensionKey.MODULE,
    dimensionValue: "TORNEIOS",
    metricKey: AnalyticsMetricKey.GROSS,
    value: 9000,
  });
  addRollup({
    bucketDate: todayBucket,
    dimensionKey: AnalyticsDimensionKey.MODULE,
    dimensionValue: "TORNEIOS",
    metricKey: AnalyticsMetricKey.PLATFORM_FEES,
    value: 900,
  });
  addRollup({
    bucketDate: todayBucket,
    dimensionKey: AnalyticsDimensionKey.MODULE,
    dimensionValue: "TORNEIOS",
    metricKey: AnalyticsMetricKey.PROCESSOR_FEES,
    value: 300,
  });
  addRollup({
    bucketDate: todayBucket,
    dimensionKey: AnalyticsDimensionKey.MODULE,
    dimensionValue: "TORNEIOS",
    metricKey: AnalyticsMetricKey.NET_TO_ORG,
    value: 7800,
  });
  addRollup({
    bucketDate: todayBucket,
    dimensionKey: AnalyticsDimensionKey.CURRENCY,
    dimensionValue: "EUR",
    metricKey: AnalyticsMetricKey.GROSS,
    value: 31000,
  });

  for (const [key, value] of rollups.entries()) {
    const [bucketDateIso, metricKey, dimensionKey, dimensionValue] = key.split("|");
    rollupRows.push({
      bucketDate: new Date(`${bucketDateIso}T00:00:00.000Z`),
      metricKey: metricKey as AnalyticsMetricKey,
      dimensionKey: dimensionKey as AnalyticsDimensionKey,
      dimensionValue,
      value,
    });
  }

  for (const row of rollupRows) {
    await prisma.analyticsRollup.upsert({
      where: {
        organizationId_bucketDate_metricKey_dimensionKey_dimensionValue: {
          organizationId: organization.id,
          bucketDate: row.bucketDate,
          metricKey: row.metricKey,
          dimensionKey: row.dimensionKey,
          dimensionValue: row.dimensionValue,
        },
      },
      update: { value: row.value },
      create: {
        organizationId: organization.id,
        bucketDate: row.bucketDate,
        metricKey: row.metricKey,
        dimensionKey: row.dimensionKey,
        dimensionValue: row.dimensionValue,
        value: row.value,
      },
    });
  }

  await seedOpsFeed({ organizationId: organization.id, actorUserId: owner.id });

  const [paymentStats, saleStats, ticketStats, refundCount, rollupCount, opsCount] = await Promise.all([
    prisma.payment.groupBy({
      by: ["status"],
      where: { organizationId: organization.id, id: { startsWith: purchasePrefix } },
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
    prisma.saleSummary.groupBy({
      by: ["status"],
      where: { purchaseId: { startsWith: purchasePrefix } },
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
    prisma.ticket.groupBy({
      by: ["status"],
      where: { id: { startsWith: ticketPrefix } },
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
    prisma.refund.count({ where: { dedupeKey: { startsWith: `${prefix}_refund_` } } }),
    prisma.analyticsRollup.count({ where: { organizationId: organization.id } }),
    prisma.activityFeedItem.count({
      where: { organizationId: organization.id, eventType: { startsWith: `${prefix}.` } },
    }),
  ]);

  console.log("=== Seed Completed: Analytics x Finance Split ===");
  console.log(
    JSON.stringify(
      {
        seedTag,
        organization: {
          id: organization.id,
          username: organization.username,
          publicName: organization.publicName,
        },
        owner: {
          id: owner.id,
          username: owner.username,
          fullName: owner.fullName,
        },
        personas,
        metrics: {
          paymentStatuses: paymentStats.map((row) => ({ status: row.status, count: row._count._all })),
          saleStatuses: saleStats.map((row) => ({ status: row.status, count: row._count._all })),
          ticketStatuses: ticketStats.map((row) => ({ status: row.status, count: row._count._all })),
          refundCount,
          analyticsRollupRows: rollupCount,
          opsFeedItems: opsCount,
        },
        quickLinks: {
          analytics: `/org/${organization.id}/analytics?view=overview`,
          finance: `/org/${organization.id}/finance?view=overview`,
          buyersHint: `/org/${organization.id}/analytics?view=buyers&eventId=${eventMap.main.id}`,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("seed_analytics_finance_split failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end().catch(() => {});
  });
