export type ConnectStatus = "READY" | "INCOMPLETE" | "MISSING";

function normalizeStripeAccountId(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export function isValidStripeAccountId(value: string | null | undefined) {
  const accountId = normalizeStripeAccountId(value);
  if (!accountId) return false;
  if (accountId.length < 7) return false;
  return /^acct_[A-Za-z0-9]+$/.test(accountId);
}

export function resolveConnectStatus(
  stripeAccountId?: string | null,
  chargesEnabled?: boolean | null,
  payoutsEnabled?: boolean | null,
): ConnectStatus {
  if (!isValidStripeAccountId(stripeAccountId)) return "MISSING";
  if (!chargesEnabled || !payoutsEnabled) return "INCOMPLETE";
  return "READY";
}
