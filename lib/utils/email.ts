export function normalizeEmail(email?: string | null) {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
}
