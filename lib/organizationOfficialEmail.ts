import { prisma } from "@/lib/prisma";

const PLATFORM_EMAIL_KEY = "platform.officialEmail";
const FALLBACK_PLATFORM_EMAIL = "admin@orya.pt";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function normalizeOfficialEmail(input?: string | null) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalized = trimmed.normalize("NFKC").toLowerCase();
  return normalized || null;
}

export function isValidOfficialEmail(input?: string | null) {
  const normalized = normalizeOfficialEmail(input);
  if (!normalized) return false;
  return EMAIL_REGEX.test(normalized);
}

export function maskEmailForLog(input?: string | null) {
  const normalized = normalizeOfficialEmail(input);
  if (!normalized) return null;
  const [local, domain] = normalized.split("@");
  if (!domain) return null;
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export async function getPlatformOfficialEmail(): Promise<{ email: string; source: "db" | "env" | "fallback" }> {
  const row = await prisma.platformSetting.findUnique({
    where: { key: PLATFORM_EMAIL_KEY },
    select: { value: true },
  });

  const dbEmail = normalizeOfficialEmail(row?.value ?? null);
  if (dbEmail) {
    return { email: dbEmail, source: "db" };
  }

  const envEmail = normalizeOfficialEmail(process.env.PLATFORM_OFFICIAL_EMAIL ?? null);
  if (envEmail) {
    return { email: envEmail, source: "env" };
  }

  console.warn("[platform-email] fallback email in use", { key: PLATFORM_EMAIL_KEY });
  return { email: FALLBACK_PLATFORM_EMAIL, source: "fallback" };
}

export async function setPlatformOfficialEmail(rawEmail: string) {
  const normalized = normalizeOfficialEmail(rawEmail);
  if (!normalized || !isValidOfficialEmail(normalized)) {
    throw new Error("INVALID_EMAIL");
  }

  await prisma.platformSetting.upsert({
    where: { key: PLATFORM_EMAIL_KEY },
    create: { key: PLATFORM_EMAIL_KEY, value: normalized },
    update: { value: normalized },
  });

  return normalized;
}
