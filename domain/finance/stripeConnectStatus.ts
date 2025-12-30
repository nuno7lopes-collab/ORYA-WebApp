export type ConnectStatus = "READY" | "INCOMPLETE" | "MISSING";

export function resolveConnectStatus(stripeAccountId?: string | null, chargesEnabled?: boolean | null, payoutsEnabled?: boolean | null): ConnectStatus {
  if (!stripeAccountId) return "MISSING";
  if (!chargesEnabled || !payoutsEnabled) return "INCOMPLETE";
  return "READY";
}
