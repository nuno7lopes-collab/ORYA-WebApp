"use client";

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function getPublicBaseUrl() {
  if (typeof window !== "undefined") {
    return normalizeBaseUrl(window.location.origin);
  }
  const fallback =
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "";
  return normalizeBaseUrl(fallback);
}
