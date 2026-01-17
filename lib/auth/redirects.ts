export function sanitizeRedirectPath(
  input: string | null | undefined,
  fallback = "/"
) {
  if (!input) return fallback;
  const value = input.trim();
  if (!value) return fallback;
  if (value.startsWith("//")) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return fallback;
  if (value.includes("\n") || value.includes("\r")) return fallback;
  return value;
}
