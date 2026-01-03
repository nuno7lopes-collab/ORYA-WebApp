import { env } from "@/lib/env";

const SUPABASE_PUBLIC_PREFIX = `${env.supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/`;

function resolveBuckets(primary?: string, fallback?: string) {
  const primaryTrimmed = primary?.trim();
  if (primaryTrimmed) return [primaryTrimmed];
  const fallbackTrimmed = fallback?.trim();
  return fallbackTrimmed ? [fallbackTrimmed] : [];
}

function normalizePublicUrl(raw: string | null | undefined, buckets: string[]) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  for (const bucket of buckets) {
    if (!bucket) continue;
    if (trimmed.startsWith(`${SUPABASE_PUBLIC_PREFIX}${bucket}/`)) return trimmed;
  }
  return null;
}

const avatarBuckets = resolveBuckets(env.avatarsBucket, env.uploadsBucket);
const coverBuckets = resolveBuckets(env.eventCoversBucket, env.uploadsBucket);

export function normalizeProfileAvatarUrl(raw: string | null | undefined) {
  return normalizePublicUrl(raw, avatarBuckets);
}

export function normalizeProfileCoverUrl(raw: string | null | undefined) {
  return normalizePublicUrl(raw, coverBuckets);
}

export function normalizeOrganizationAvatarUrl(raw: string | null | undefined) {
  return normalizePublicUrl(raw, avatarBuckets);
}

export function normalizeOrganizationCoverUrl(raw: string | null | undefined) {
  return normalizePublicUrl(raw, coverBuckets);
}
