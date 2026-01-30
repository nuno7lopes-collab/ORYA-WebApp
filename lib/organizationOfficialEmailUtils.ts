const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function normalizeOfficialEmail(input?: string | null) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalized = trimmed.normalize("NFKC").toLowerCase();
  return normalized || null;
}

export function isValidOfficialEmail(input?: string | null) {
  const normalized = normalizeOfficialEmail(input);
  if (!normalized) return false;
  return EMAIL_REGEX.test(normalized);
}

export function maskEmailForLog(input?: string | null) {
  const normalized = normalizeOfficialEmail(input);
  if (!normalized) return null;
  const [local, domain] = normalized.split("@");
  if (!domain) return null;
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}***@${domain}`;
}
