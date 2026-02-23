const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

export const resolveSafeHttpUrl = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (!HTTP_PROTOCOLS.has(parsed.protocol.toLowerCase())) return null;
    return parsed.toString();
  } catch {
    return null;
  }
};
