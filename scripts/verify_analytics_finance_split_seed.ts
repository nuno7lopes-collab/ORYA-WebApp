import "./load-env.js";
import {
  AnalyticsDimensionKey,
  AnalyticsMetricKey,
  OrganizationModule,
  PaymentStatus,
  SaleSummaryStatus,
  TicketStatus,
  PrismaClient,
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
    if (parsed.searchParams.has("options")) {
      parsed.searchParams.delete("options");
      return parsed.toString();
    }
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

function assertCondition(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const seedTag = slugifyTag(process.env.ANALYTICS_FINANCE_SEED_TAG ?? "split_perfect_v1");
const prefix = `seed_${seedTag}`;
const eventSlugPrefix = `${prefix}_evt_`;
const ticketPrefix = `${prefix}_tkt_`;
const purchasePrefix = `${prefix}_pay_`;
const orgUsername = (process.env.ANALYTICS_FINANCE_ORG_USERNAME ?? "analytics-finance-split-demo").trim().toLowerCase();

const pg = resolvePgSsl(connectionString);
const pool = new Pool({
  connectionString: pg.connectionString,
  ssl: pg.ssl,
});
pool.on("connect", (client) => {
  client.query("select set_config('app.env', $1, true)", [APP_ENV]).catch(() => {});
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });

async function main() {
  const organization = await prisma.organization.findFirst({
    where: { username: { equals: orgUsername, mode: "insensitive" } },
    select: { id: true, username: true, publicName: true },
  });
  assertCondition(organization, `Organization not found for username=${orgUsername}`);

  const orgId = organization!.id;

  const [modules, events, payments, saleSummaries, tickets, refunds, rollups, entitlements, feedItems] = await Promise.all([
    prisma.organizationModuleEntry.findMany({
      where: { organizationId: orgId, enabled: true },
      select: { moduleKey: true },
    }),
    prisma.event.findMany({
      where: { organizationId: orgId, slug: { startsWith: eventSlugPrefix } },
      select: { id: true, slug: true },
    }),
    prisma.payment.groupBy({
      by: ["status"],
      where: { organizationId: orgId, id: { startsWith: purchasePrefix } },
      _count: { _all: true },
    }),
    prisma.saleSummary.groupBy({
      by: ["status"],
      where: { purchaseId: { startsWith: purchasePrefix } },
      _count: { _all: true },
    }),
    prisma.ticket.groupBy({
      by: ["status"],
      where: { id: { startsWith: ticketPrefix } },
      _count: { _all: true },
    }),
    prisma.refund.count({
      where: { dedupeKey: { startsWith: `${prefix}_refund_` } },
    }),
    prisma.analyticsRollup.groupBy({
      by: ["metricKey", "dimensionKey", "dimensionValue"],
      where: {
        organizationId: orgId,
        dimensionKey: { in: [AnalyticsDimensionKey.MODULE, AnalyticsDimensionKey.CURRENCY, AnalyticsDimensionKey.SOURCE_TYPE] },
      },
      _sum: { value: true },
    }),
    prisma.entitlement.count({
      where: { purchaseId: { startsWith: purchasePrefix } },
    }),
    prisma.activityFeedItem.count({
      where: { organizationId: orgId, eventType: { startsWith: `${prefix}.` } },
    }),
  ]);

  const enabledModules = new Set(modules.map((row) => row.moduleKey));
  assertCondition(enabledModules.has(OrganizationModule.ANALYTICS), "ANALYTICS module not enabled");
  assertCondition(enabledModules.has(OrganizationModule.FINANCEIRO), "FINANCEIRO module not enabled");

  assertCondition(events.length >= 3, "Expected at least 3 seeded events");

  const paymentByStatus = new Map(payments.map((row) => [row.status, row._count._all]));
  assertCondition((paymentByStatus.get(PaymentStatus.SUCCEEDED) ?? 0) >= 6, "Expected >= 6 SUCCEEDED payments");
  assertCondition((paymentByStatus.get(PaymentStatus.FAILED) ?? 0) >= 1, "Expected FAILED payment");
  assertCondition((paymentByStatus.get(PaymentStatus.CANCELLED) ?? 0) >= 1, "Expected CANCELLED payment");
  assertCondition((paymentByStatus.get(PaymentStatus.PARTIAL_REFUND) ?? 0) >= 1, "Expected PARTIAL_REFUND payment");
  assertCondition((paymentByStatus.get(PaymentStatus.REFUNDED) ?? 0) >= 1, "Expected REFUNDED payment");
  assertCondition((paymentByStatus.get(PaymentStatus.DISPUTED) ?? 0) >= 1, "Expected DISPUTED payment");
  assertCondition((paymentByStatus.get(PaymentStatus.CHARGEBACK_LOST) ?? 0) >= 1, "Expected CHARGEBACK_LOST payment");

  const salesByStatus = new Map(saleSummaries.map((row) => [row.status, row._count._all]));
  assertCondition((salesByStatus.get(SaleSummaryStatus.PAID) ?? 0) >= 6, "Expected >= 6 PAID sale summaries");
  assertCondition((salesByStatus.get(SaleSummaryStatus.REFUNDED) ?? 0) >= 1, "Expected REFUNDED sale summary");

  const paidPurchases = await prisma.saleSummary.findMany({
    where: {
      status: SaleSummaryStatus.PAID,
      purchaseId: { startsWith: purchasePrefix },
    },
    select: { purchaseId: true },
  });
  const paidPurchaseIds = paidPurchases
    .map((row) => row.purchaseId)
    .filter((value): value is string => Boolean(value));
  const paidStatuses = await prisma.payment.findMany({
    where: { id: { in: paidPurchaseIds } },
    select: { id: true, status: true },
  });
  assertCondition(
    paidStatuses.every((row) => row.status === PaymentStatus.SUCCEEDED),
    "Finance precondition failed: PAID sale summary mapped to non-SUCCEEDED payment",
  );

  const ticketsByStatus = new Map(tickets.map((row) => [row.status, row._count._all]));
  assertCondition((ticketsByStatus.get(TicketStatus.ACTIVE) ?? 0) >= 1, "Expected ACTIVE ticket");
  assertCondition((ticketsByStatus.get(TicketStatus.REFUNDED) ?? 0) >= 1, "Expected REFUNDED ticket");
  assertCondition((ticketsByStatus.get(TicketStatus.TRANSFERRED) ?? 0) >= 1, "Expected TRANSFERRED ticket");
  assertCondition((ticketsByStatus.get(TicketStatus.RESALE_LISTED) ?? 0) >= 1, "Expected RESALE_LISTED ticket");

  assertCondition(refunds >= 2, "Expected at least 2 refunds");
  assertCondition(entitlements >= 8, "Expected at least 8 entitlements");
  assertCondition(feedItems >= 6, "Expected at least 6 ops feed items");

  const hasModuleRollups = rollups.some(
    (row) =>
      row.dimensionKey === AnalyticsDimensionKey.MODULE &&
      (row.dimensionValue === "EVENTOS" || row.dimensionValue === "TORNEIOS"),
  );
  const hasCurrencyRollups = rollups.some(
    (row) => row.dimensionKey === AnalyticsDimensionKey.CURRENCY && row.dimensionValue === "EUR",
  );
  const hasGrossMetric = rollups.some((row) => row.metricKey === AnalyticsMetricKey.GROSS);
  const hasNetMetric = rollups.some((row) => row.metricKey === AnalyticsMetricKey.NET_TO_ORG);
  assertCondition(hasModuleRollups, "Missing MODULE rollups for EVENTOS/TORNEIOS");
  assertCondition(hasCurrencyRollups, "Missing CURRENCY rollups for EUR");
  assertCondition(hasGrossMetric, "Missing GROSS rollup metric");
  assertCondition(hasNetMetric, "Missing NET_TO_ORG rollup metric");

  const permissions = await prisma.organizationMemberPermission.findMany({
    where: {
      organizationId: orgId,
      scopeType: null,
      scopeId: null,
      moduleKey: { in: [OrganizationModule.ANALYTICS, OrganizationModule.FINANCEIRO] },
    },
    select: { userId: true, moduleKey: true, accessLevel: true },
  });
  const permissionsByUser = new Map<
    string,
    Partial<Record<"ANALYTICS" | "FINANCEIRO", string>>
  >();
  for (const row of permissions) {
    const current = permissionsByUser.get(row.userId) ?? {};
    if (row.moduleKey === OrganizationModule.ANALYTICS || row.moduleKey === OrganizationModule.FINANCEIRO) {
      current[row.moduleKey] = row.accessLevel;
      permissionsByUser.set(row.userId, current);
    }
  }
  const hasAnalyticsOnly = Array.from(permissionsByUser.values()).some(
    (entry) => entry.ANALYTICS === "VIEW" && entry.FINANCEIRO === "NONE",
  );
  const hasFinanceOnly = Array.from(permissionsByUser.values()).some(
    (entry) => entry.ANALYTICS === "NONE" && entry.FINANCEIRO === "VIEW",
  );

  console.log("=== Verify OK: Analytics x Finance Split Seed ===");
  console.log(
    JSON.stringify(
      {
        seedTag,
        organization: {
          id: organization!.id,
          username: organization!.username,
          publicName: organization!.publicName,
        },
        checks: {
          modules: {
            analyticsEnabled: enabledModules.has(OrganizationModule.ANALYTICS),
            financeEnabled: enabledModules.has(OrganizationModule.FINANCEIRO),
          },
          coverage: {
            events: events.length,
            paymentStatuses: Object.fromEntries(paymentByStatus),
            saleStatuses: Object.fromEntries(salesByStatus),
            ticketStatuses: Object.fromEntries(ticketsByStatus),
            refunds,
            entitlements,
            opsFeedItems: feedItems,
          },
          guardrails: {
            paidSummariesBackedBySucceededPayments: true,
            analyticsOnlyPersonaPresent: hasAnalyticsOnly,
            financeOnlyPersonaPresent: hasFinanceOnly,
          },
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("verify_analytics_finance_split_seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end().catch(() => {});
  });
