import { prisma } from "@/lib/prisma";
import { normalizeOfficialEmail } from "@/lib/organizationOfficialEmailUtils";

export type PlatformFeeConfig = {
  feeBps: number;
  feeFixedCents: number;
};

type FeeKeys =
  | "platform_fee_bps"
  | "platform_fee_fixed_cents"
  | "stripe_fee_bps_eu"
  | "stripe_fee_fixed_cents_eu";

type PlatformSettingKey = FeeKeys | "org_transfer_enabled" | "platform.officialEmail";

const envPlatformFeeBps = process.env.PLATFORM_FEE_BPS ?? process.env.NEXT_PUBLIC_PLATFORM_FEE_BPS;
const envPlatformFeePercent = process.env.PLATFORM_FEE_PERCENT ?? process.env.NEXT_PUBLIC_PLATFORM_FEE_PERCENT;
const envPlatformFeeFixedCents =
  process.env.PLATFORM_FEE_FIXED_CENTS ?? process.env.NEXT_PUBLIC_PLATFORM_FEE_FIXED_CENTS;
const envPlatformFeeFixedEur =
  process.env.PLATFORM_FEE_FIXED_EUR ?? process.env.NEXT_PUBLIC_PLATFORM_FEE_FIXED_EUR;
const envPlatformOfficialEmail =
  process.env.PLATFORM_OFFICIAL_EMAIL ?? process.env.NEXT_PUBLIC_PLATFORM_OFFICIAL_EMAIL;

const DEFAULT_PLATFORM_FEE_BPS = Number.isFinite(Number(envPlatformFeeBps))
  ? Number(envPlatformFeeBps)
  : Math.round(Number(envPlatformFeePercent ?? 0.08) * 10_000) || 800; // 8%
const DEFAULT_PLATFORM_FEE_FIXED_CENTS = Number.isFinite(Number(envPlatformFeeFixedCents))
  ? Number(envPlatformFeeFixedCents)
  : Math.round(Number(envPlatformFeeFixedEur ?? 0.3) * 100) || 30; // €0.30

const DEFAULT_STRIPE_FEE_BPS_EU = Number.isFinite(Number(process.env.STRIPE_FEE_BPS_EU))
  ? Number(process.env.STRIPE_FEE_BPS_EU)
  : Math.round(Number(process.env.STRIPE_FEE_PERCENT_EU ?? 0.014) * 10_000) || 140; // 1.4%
const DEFAULT_STRIPE_FEE_FIXED_CENTS_EU = Number.isFinite(Number(process.env.STRIPE_FEE_FIXED_CENTS_EU))
  ? Number(process.env.STRIPE_FEE_FIXED_CENTS_EU)
  : Math.round(Number(process.env.STRIPE_FEE_FIXED_EUR_EU ?? 0.25) * 100) || 25; // €0.25

const PLATFORM_OFFICIAL_EMAIL_KEY: PlatformSettingKey = "platform.officialEmail";
const DEFAULT_PLATFORM_OFFICIAL_EMAIL = "admin@orya.pt";

function parseNumber(raw: unknown, fallback: number) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function parseBoolean(raw: unknown, fallback: boolean) {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

async function getSettingsMap(keys: PlatformSettingKey[]): Promise<Record<string, string>> {
  const rows = await prisma.platformSetting.findMany({
    where: {
      key: {
        in: keys,
      },
    },
  });

  return rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

async function upsertSettings(values: { key: PlatformSettingKey; value: string }[]) {
  const tasks = values.map(({ key, value }) =>
    prisma.platformSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    }),
  );
  await Promise.all(tasks);
}

/**
 * Lê platform_settings (DB). Se não houver valores guardados, aplica defaults/env.
 */
export async function getPlatformFees(): Promise<PlatformFeeConfig> {
  const map = await getSettingsMap(["platform_fee_bps", "platform_fee_fixed_cents"]);

  return {
    feeBps: parseNumber(map["platform_fee_bps"], DEFAULT_PLATFORM_FEE_BPS),
    feeFixedCents: parseNumber(map["platform_fee_fixed_cents"], DEFAULT_PLATFORM_FEE_FIXED_CENTS),
  };
}

export async function setPlatformFees(config: Partial<PlatformFeeConfig>) {
  const updates: { key: FeeKeys; value: string }[] = [];

  if (config.feeBps !== undefined) {
    updates.push({ key: "platform_fee_bps", value: String(Math.max(0, Math.round(config.feeBps))) });
  }
  if (config.feeFixedCents !== undefined) {
    updates.push({
      key: "platform_fee_fixed_cents",
      value: String(Math.max(0, Math.round(config.feeFixedCents))),
    });
  }

  if (updates.length > 0) {
    await upsertSettings(updates);
  }

  return getPlatformFees();
}

export async function getStripeBaseFees() {
  const map = await getSettingsMap(["stripe_fee_bps_eu", "stripe_fee_fixed_cents_eu"]);

  return {
    feeBps: parseNumber(map["stripe_fee_bps_eu"], DEFAULT_STRIPE_FEE_BPS_EU),
    feeFixedCents: parseNumber(map["stripe_fee_fixed_cents_eu"], DEFAULT_STRIPE_FEE_FIXED_CENTS_EU),
    region: "UE",
  };
}

export async function setStripeBaseFees(config: Partial<PlatformFeeConfig>) {
  const updates: { key: FeeKeys; value: string }[] = [];

  if (config.feeBps !== undefined) {
    updates.push({ key: "stripe_fee_bps_eu", value: String(Math.max(0, Math.round(config.feeBps))) });
  }
  if (config.feeFixedCents !== undefined) {
    updates.push({
      key: "stripe_fee_fixed_cents_eu",
      value: String(Math.max(0, Math.round(config.feeFixedCents))),
    });
  }

  if (updates.length > 0) {
    await upsertSettings(updates);
  }

  return getStripeBaseFees();
}

export async function getPlatformAndStripeFees() {
  const [orya, stripe] = await Promise.all([getPlatformFees(), getStripeBaseFees()]);
  return { orya, stripe };
}

export async function getOrgTransferEnabled(): Promise<boolean> {
  const map = await getSettingsMap(["org_transfer_enabled"]);
  return parseBoolean(map["org_transfer_enabled"], false);
}

export async function getPlatformOfficialEmail(): Promise<string> {
  const map = await getSettingsMap([PLATFORM_OFFICIAL_EMAIL_KEY]);
  const stored = normalizeOfficialEmail(map[PLATFORM_OFFICIAL_EMAIL_KEY] ?? null);
  if (stored) return stored;
  const envEmail = normalizeOfficialEmail(envPlatformOfficialEmail ?? null);
  if (envEmail) return envEmail;
  console.warn("[platformSettings] PLATFORM_OFFICIAL_EMAIL not set; using default admin@orya.pt");
  return DEFAULT_PLATFORM_OFFICIAL_EMAIL;
}

export async function setPlatformOfficialEmail(email: string): Promise<string> {
  const normalized = normalizeOfficialEmail(email);
  if (!normalized) {
    throw new Error("INVALID_EMAIL");
  }
  await upsertSettings([{ key: PLATFORM_OFFICIAL_EMAIL_KEY, value: normalized }]);
  return normalized;
}
