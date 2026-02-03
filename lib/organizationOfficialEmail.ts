import "server-only";
import { prisma } from "@/lib/prisma";
import { isValidOfficialEmail, normalizeOfficialEmail } from "@/lib/organizationOfficialEmailUtils";

const PLATFORM_EMAIL_KEY = "platform.officialEmail";
export async function getPlatformOfficialEmail(): Promise<{ email: string | null; source: "db" | "missing" }> {
  const row = await prisma.platformSetting.findUnique({
    where: { key: PLATFORM_EMAIL_KEY },
    select: { value: true },
  });

  const dbEmail = normalizeOfficialEmail(row?.value ?? null);
  if (dbEmail) {
    return { email: dbEmail, source: "db" };
  }
  return { email: null, source: "missing" };
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
