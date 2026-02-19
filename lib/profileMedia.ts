function getPublicSupabaseUrl() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  return raw.trim().replace(/\/+$/, "");
}

const SUPABASE_PUBLIC_BASE_URL = getPublicSupabaseUrl();
const SUPABASE_PUBLIC_PREFIX = SUPABASE_PUBLIC_BASE_URL
  ? `${SUPABASE_PUBLIC_BASE_URL}/storage/v1/object/public/`
  : "";

const uploadsBucket =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET_UPLOADS ??
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ??
  process.env.SUPABASE_STORAGE_BUCKET_UPLOADS ??
  process.env.SUPABASE_STORAGE_BUCKET ??
  "uploads";
const avatarsBucketEnv =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET_AVATARS ??
  process.env.SUPABASE_STORAGE_BUCKET_AVATARS ??
  "";
const eventCoversBucketEnv =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET_EVENT_COVERS ??
  process.env.SUPABASE_STORAGE_BUCKET_EVENT_COVERS ??
  "";

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
  if (!SUPABASE_PUBLIC_PREFIX) return null;
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
  if (!SUPABASE_PUBLIC_PREFIX) return null;
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

const avatarBuckets = resolveBuckets(avatarsBucketEnv, uploadsBucket);
const coverBuckets = resolveBuckets(eventCoversBucketEnv, uploadsBucket);

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
