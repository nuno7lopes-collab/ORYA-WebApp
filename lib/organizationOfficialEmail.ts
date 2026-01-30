import "server-only";
import { prisma } from "@/lib/prisma";
import { isValidOfficialEmail, normalizeOfficialEmail } from "@/lib/organizationOfficialEmailUtils";

const PLATFORM_EMAIL_KEY = "platform.officialEmail";
const FALLBACK_PLATFORM_EMAIL = "admin@orya.pt";
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

export async function validateOfficialEmail(payload: { email?: string | null }) {
  const normalized = normalizeOfficialEmail(payload?.email ?? null);
  const valid = Boolean(normalized && isValidOfficialEmail(normalized));
  return { normalized, valid };
}
