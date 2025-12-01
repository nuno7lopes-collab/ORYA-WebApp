export function optimizeImageUrl(
  url: string | null | undefined,
  width = 1200,
  quality = 75,
  format: "webp" | "avif" | "auto" = "webp",
) {
  if (!url || typeof url !== "string") return url ?? "";
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("supabase.co")) {
      parsed.searchParams.set("width", String(width));
      parsed.searchParams.set("quality", String(quality));
      parsed.searchParams.set("format", format);
      return parsed.toString();
    }
    return url;
  } catch (err) {
    return url;
  }
}

export const defaultBlurDataURL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9' viewBox='0 0 16 9'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%23050B16' offset='0'%3E%3C/stop%3E%3Cstop stop-color='%23111F3B' offset='1'%3E%3C/stop%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='16' height='9' fill='url(%23g)'/%3E%3C/svg%3E";
