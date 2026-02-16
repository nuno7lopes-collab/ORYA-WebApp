export function normalizeEmail(email?: string | null) {
  if (!email) return null;
  const trimmed = email.trim().normalize("NFKC").toLowerCase();
  return trimmed || null;
}
