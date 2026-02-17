import { getMobileEnv } from "./env";

const hasProtocol = (value: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(value);

export const resolveMediaUri = (value?: string | null): string | null => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  if (raw.startsWith("data:")) return raw;
  if (hasProtocol(raw)) return raw;

  const base = getMobileEnv().apiBaseUrl?.trim();
  if (!base) return raw;

  try {
    const normalizedBase = base.endsWith("/") ? base : `${base}/`;
    const normalizedPath = raw.startsWith("/") ? raw.slice(1) : raw;
    return new URL(normalizedPath, normalizedBase).toString();
  } catch {
    return raw;
  }
};
