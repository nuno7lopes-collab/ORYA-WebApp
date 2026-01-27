import { prisma } from "@/lib/prisma";

const PLATFORM_EMAIL_KEY = "platform.officialEmail";
const FALLBACK_PLATFORM_EMAIL = "admin@orya.pt";

export function normalizeOfficialEmail(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function isValidOfficialEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function getPlatformOfficialEmail(): Promise<{ email: string; source: "db" | "env" | "fallback" }>
{
  const row = await prisma.platformSetting.findUnique({
    where: { key: PLATFORM_EMAIL_KEY },
    select: { value: true },
  });

  if (row?.value) {
    return { email: normalizeOfficialEmail(row.value), source: "db" };
  }

  const envEmail = process.env.PLATFORM_OFFICIAL_EMAIL;
  if (envEmail) {
    return { email: normalizeOfficialEmail(envEmail), source: "env" };
  }

  console.warn("[platform-email] fallback email in use", { key: PLATFORM_EMAIL_KEY });
  return { email: FALLBACK_PLATFORM_EMAIL, source: "fallback" };
}

export async function setPlatformOfficialEmail(rawEmail: string) {
  const normalized = normalizeOfficialEmail(rawEmail);
  if (!isValidOfficialEmail(normalized)) {
    throw new Error("INVALID_EMAIL");
  }

  await prisma.platformSetting.upsert({
    where: { key: PLATFORM_EMAIL_KEY },
    create: { key: PLATFORM_EMAIL_KEY, value: normalized },
    update: { value: normalized },
  });

  return normalized;
}
