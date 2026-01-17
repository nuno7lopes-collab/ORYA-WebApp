import { env } from "@/lib/env";

const SUPABASE_PUBLIC_PREFIX = `${env.supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/`;

function resolveBuckets(primary?: string, fallback?: string) {
  const buckets = new Set<string>();
  const primaryTrimmed = primary?.trim();
  if (primaryTrimmed) buckets.add(primaryTrimmed);
  const fallbackTrimmed = fallback?.trim();
  if (fallbackTrimmed) buckets.add(fallbackTrimmed);
  return Array.from(buckets);
}

function normalizePublicUrl(
  raw: string | null | undefined,
  buckets: string[],
  options?: { pathPrefixes?: string[] },
) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  for (const bucket of buckets) {
    if (!bucket) continue;
    const prefix = `${SUPABASE_PUBLIC_PREFIX}${bucket}/`;
    if (!trimmed.startsWith(prefix)) continue;
    if (options?.pathPrefixes?.length) {
      const path = trimmed.slice(prefix.length).split("?")[0];
      const matches = options.pathPrefixes.some((segment) =>
        path.startsWith(segment.replace(/^\/+/, "")),
      );
      if (!matches) continue;
    }
    return trimmed;
  }
  return null;
}

const avatarBuckets = resolveBuckets(env.avatarsBucket, env.uploadsBucket);
const coverBuckets = resolveBuckets(env.eventCoversBucket, env.uploadsBucket);

export function normalizeProfileAvatarUrl(raw: string | null | undefined) {
  return normalizePublicUrl(raw, avatarBuckets);
}

export function normalizeProfileCoverUrl(raw: string | null | undefined) {
  return normalizePublicUrl(raw, coverBuckets, { pathPrefixes: ["profile-covers/"] });
}

export function normalizeOrganizationAvatarUrl(raw: string | null | undefined) {
  return normalizePublicUrl(raw, avatarBuckets);
}

export function normalizeOrganizationCoverUrl(raw: string | null | undefined) {
  return normalizePublicUrl(raw, coverBuckets, { pathPrefixes: ["profile-covers/"] });
}
