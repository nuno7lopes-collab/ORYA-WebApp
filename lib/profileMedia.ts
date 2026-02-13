import { env } from "@/lib/env";

const SUPABASE_PUBLIC_PREFIX = `${env.supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/`;

export type SupabasePublicObjectRef = {
  bucket: string;
  objectPath: string;
};

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

export function parseSupabasePublicObjectUrl(
  raw: string | null | undefined,
): SupabasePublicObjectRef | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith(SUPABASE_PUBLIC_PREFIX)) return null;
  const path = trimmed.slice(SUPABASE_PUBLIC_PREFIX.length).split("?")[0] ?? "";
  const firstSlash = path.indexOf("/");
  if (firstSlash <= 0) return null;
  const bucketRaw = path.slice(0, firstSlash).trim();
  const objectPathRaw = path.slice(firstSlash + 1).trim();
  if (!bucketRaw || !objectPathRaw) return null;
  try {
    return {
      bucket: decodeURIComponent(bucketRaw),
      objectPath: decodeURIComponent(objectPathRaw),
    };
  } catch {
    return null;
  }
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
