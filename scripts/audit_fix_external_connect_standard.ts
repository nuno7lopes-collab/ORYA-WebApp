import fs from "node:fs";
import path from "node:path";
import Stripe from "stripe";
import { OrgType, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

type RuntimeEnv = "test" | "prod";

type OrgSnapshot = {
  id: number;
  username: string | null;
  publicName: string | null;
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean | null;
  stripePayoutsEnabled: boolean | null;
};

type AuditRow = {
  organizationId: number;
  username: string | null;
  publicName: string | null;
  accountId: string | null;
  accountType: string | null;
  action: "UNCHANGED" | "RESET_TO_RECONNECT" | "ERROR";
  reason: string;
  updated: boolean;
};

type AuditReport = {
  script: string;
  timestamp: string;
  runtimeEnv: RuntimeEnv;
  mode: "dry-run" | "apply";
  organizationsScanned: number;
  organizationsUpdated: number;
  accountsAlreadyStandard: number;
  accountsResetForReconnect: number;
  rows: AuditRow[];
};

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith("\"") && val.endsWith("\"")) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

function resolveRuntimeEnv(): RuntimeEnv {
  const raw = (
    process.env.STRIPE_MODE ??
    process.env.STRIPE_ENV ??
    process.env.APP_ENV ??
    process.env.NODE_ENV ??
    ""
  )
    .trim()
    .toLowerCase();
  if (raw === "prod" || raw === "production" || raw === "live") return "prod";
  return "test";
}

function resolveStripeSecret(runtimeEnv: RuntimeEnv) {
  const fromEnv =
    runtimeEnv === "test"
      ? process.env.STRIPE_SECRET_KEY_TEST ?? process.env.STRIPE_SECRET_KEY
      : process.env.STRIPE_SECRET_KEY_LIVE ?? process.env.STRIPE_SECRET_KEY;
  const key = fromEnv?.trim() ?? "";
  if (!key) {
    throw new Error(
      runtimeEnv === "test"
        ? "Missing STRIPE_SECRET_KEY_TEST/STRIPE_SECRET_KEY."
        : "Missing STRIPE_SECRET_KEY_LIVE/STRIPE_SECRET_KEY.",
    );
  }
  if (runtimeEnv === "test" && key.startsWith("sk_live")) {
    throw new Error("Stripe key mismatch: runtime=test but key is live.");
  }
  if (runtimeEnv === "prod" && key.startsWith("sk_test")) {
    throw new Error("Stripe key mismatch: runtime=prod but key is test.");
  }
  return key;
}

function parseArgs() {
  const apply = process.argv.includes("--apply");
  const noReport = process.argv.includes("--no-report");
  return { apply, noReport };
}

function isResourceMissing(err: unknown) {
  const anyErr = err as { code?: string; statusCode?: number };
  return anyErr?.code === "resource_missing" || anyErr?.statusCode === 404;
}

function isAccountInaccessible(err: unknown) {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return message.includes("does not have access to account");
}

function reportFilePath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(process.cwd(), "reports", `external_connect_standard_audit_${stamp}.json`);
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  throw new Error("Missing DATABASE_URL or DIRECT_URL.");
}

const runtimeEnv = resolveRuntimeEnv();
const stripeSecret = resolveStripeSecret(runtimeEnv);
const stripe = new Stripe(stripeSecret, {
  maxNetworkRetries: 2,
  timeout: 20000,
});

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;
const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

async function main() {
  const args = parseArgs();
  const organizations = await prisma.organization.findMany({
    where: {
      orgType: OrgType.EXTERNAL,
      stripeAccountId: { not: null },
    },
    select: {
      id: true,
      username: true,
      publicName: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
    },
    orderBy: { id: "asc" },
  });

  const rows: AuditRow[] = [];
  let organizationsUpdated = 0;
  let accountsAlreadyStandard = 0;
  let accountsResetForReconnect = 0;

  for (const organization of organizations as OrgSnapshot[]) {
    const accountId = organization.stripeAccountId?.trim() ?? null;
    if (!accountId) {
      rows.push({
        organizationId: organization.id,
        username: organization.username,
        publicName: organization.publicName,
        accountId: null,
        accountType: null,
        action: "RESET_TO_RECONNECT",
        reason: "EMPTY_ACCOUNT_ID",
        updated: false,
      });
      continue;
    }

    try {
      const account = await stripe.accounts.retrieve(accountId);
      if ("deleted" in account && account.deleted) {
        if (args.apply) {
          await prisma.organization.update({
            where: { id: organization.id },
            data: {
              stripeAccountId: null,
              stripeChargesEnabled: false,
              stripePayoutsEnabled: false,
            },
          });
        }
        organizationsUpdated += args.apply ? 1 : 0;
        accountsResetForReconnect += 1;
        rows.push({
          organizationId: organization.id,
          username: organization.username,
          publicName: organization.publicName,
          accountId,
          accountType: "deleted",
          action: "RESET_TO_RECONNECT",
          reason: "ACCOUNT_DELETED",
          updated: args.apply,
        });
        continue;
      }

      const accountType = account.type ?? null;
      if (accountType === "standard") {
        accountsAlreadyStandard += 1;
        rows.push({
          organizationId: organization.id,
          username: organization.username,
          publicName: organization.publicName,
          accountId,
          accountType,
          action: "UNCHANGED",
          reason: "ALREADY_STANDARD",
          updated: false,
        });
        continue;
      }

      if (args.apply) {
        await prisma.organization.update({
          where: { id: organization.id },
          data: {
            stripeAccountId: null,
            stripeChargesEnabled: false,
            stripePayoutsEnabled: false,
          },
        });
      }
      organizationsUpdated += args.apply ? 1 : 0;
      accountsResetForReconnect += 1;
      rows.push({
        organizationId: organization.id,
        username: organization.username,
        publicName: organization.publicName,
        accountId,
        accountType,
        action: "RESET_TO_RECONNECT",
        reason: "NON_STANDARD_ACCOUNT",
        updated: args.apply,
      });
    } catch (err) {
      if (isResourceMissing(err) || isAccountInaccessible(err)) {
        if (args.apply) {
          await prisma.organization.update({
            where: { id: organization.id },
            data: {
              stripeAccountId: null,
              stripeChargesEnabled: false,
              stripePayoutsEnabled: false,
            },
          });
        }
        organizationsUpdated += args.apply ? 1 : 0;
        accountsResetForReconnect += 1;
        rows.push({
          organizationId: organization.id,
          username: organization.username,
          publicName: organization.publicName,
          accountId,
          accountType: null,
          action: "RESET_TO_RECONNECT",
          reason: isAccountInaccessible(err) ? "ACCOUNT_INACCESSIBLE" : "ACCOUNT_NOT_FOUND",
          updated: args.apply,
        });
        continue;
      }

      rows.push({
        organizationId: organization.id,
        username: organization.username,
        publicName: organization.publicName,
        accountId,
        accountType: null,
        action: "ERROR",
        reason: err instanceof Error ? err.message : "UNKNOWN_ERROR",
        updated: false,
      });
    }
  }

  const report: AuditReport = {
    script: "audit_fix_external_connect_standard.ts",
    timestamp: new Date().toISOString(),
    runtimeEnv,
    mode: args.apply ? "apply" : "dry-run",
    organizationsScanned: organizations.length,
    organizationsUpdated,
    accountsAlreadyStandard,
    accountsResetForReconnect,
    rows,
  };

  if (!args.noReport) {
    const filePath = reportFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), "utf8");
    console.log(`Report written: ${filePath}`);
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((err) => {
    console.error("Audit failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
    await pool.end().catch(() => undefined);
  });
