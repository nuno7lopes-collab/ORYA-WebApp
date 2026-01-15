import { optimizeImageUrl } from "@/lib/image";

const PROFILE_COVER_WIDTH = 1500;
const PROFILE_COVER_HEIGHT = 500;
const PROFILE_COVER_PATH = "/profile-covers/";

type ProfileCoverOptions = {
  width?: number;
  height?: number;
  quality?: number;
  format?: "webp" | "avif" | "auto";
};

export function isProfileCoverUrl(coverUrl: string | null | undefined) {
  if (!coverUrl) return false;
  try {
    const parsed = new URL(coverUrl);
    return parsed.pathname.includes(PROFILE_COVER_PATH);
  } catch {
    return false;
  }
}

export function sanitizeProfileCoverUrl(coverUrl: string | null | undefined) {
  const trimmed = coverUrl?.trim();
  if (!trimmed) return null;
  return isProfileCoverUrl(trimmed) ? trimmed : null;
}

export function getProfileCoverUrl(
  coverUrl: string | null | undefined,
  options: ProfileCoverOptions = {},
) {
  const sanitized = sanitizeProfileCoverUrl(coverUrl);
  if (!sanitized) return null;
  const width = options.width ?? PROFILE_COVER_WIDTH;
  const height = options.height ?? PROFILE_COVER_HEIGHT;
  return (
    optimizeImageUrl(
      sanitized,
      width,
      options.quality ?? 72,
      options.format ?? "webp",
      height,
      "cover",
    ) || sanitized
  );
}
