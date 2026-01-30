import { resolveConnectStatus } from "@/domain/finance/stripeConnectStatus";
import { normalizeOfficialEmail } from "@/lib/organizationOfficialEmailUtils";

type PaidSalesGateInput = {
  officialEmail?: string | null;
  officialEmailVerifiedAt?: Date | string | null;
  stripeAccountId?: string | null;
  stripeChargesEnabled?: boolean | null;
  stripePayoutsEnabled?: boolean | null;
  requireStripe?: boolean;
};

export type PaidSalesGate = {
  ok: boolean;
  missingEmail: boolean;
  missingStripe: boolean;
};

export function getPaidSalesGate(input: PaidSalesGateInput): PaidSalesGate {
  const emailVerified = Boolean(normalizeOfficialEmail(input.officialEmail ?? null) && input.officialEmailVerifiedAt);
  const requireStripe = input.requireStripe !== false;
  const stripeReady = requireStripe
    ? resolveConnectStatus(
        input.stripeAccountId ?? null,
        input.stripeChargesEnabled ?? false,
        input.stripePayoutsEnabled ?? false,
      ) === "READY"
    : true;
  const missingEmail = !emailVerified;
  const missingStripe = !stripeReady;
  return { ok: !missingEmail && !missingStripe, missingEmail, missingStripe };
}

export function formatPaidSalesGateMessage(gate: PaidSalesGate, prefix: string) {
  if (gate.ok) return prefix;
  const reasons: string[] = [];
  if (gate.missingEmail) reasons.push("verifica o email oficial");
  if (gate.missingStripe) reasons.push("liga a tua conta Stripe");
  if (!reasons.length) return prefix;
  return `${prefix} ${reasons.join(" e ")}.`;
}
