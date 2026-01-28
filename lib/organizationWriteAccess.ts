import { resolveConnectStatus } from "@/domain/finance/stripeConnectStatus";

type OrganizationWriteContext = {
  id?: number;
  officialEmail?: string | null;
  officialEmailVerifiedAt?: Date | string | null;
  stripeAccountId?: string | null;
  stripeChargesEnabled?: boolean | null;
  stripePayoutsEnabled?: boolean | null;
  orgType?: string | null;
};

type AccessResult = { ok: true } | { ok: false; error: string };

export function isOfficialEmailVerified(org: OrganizationWriteContext) {
  return Boolean(org.officialEmail && org.officialEmailVerifiedAt);
}

export function ensureOrganizationEmailVerified(org: OrganizationWriteContext): AccessResult {
  if (isOfficialEmailVerified(org)) {
    return { ok: true };
  }
  return { ok: false, error: "Email oficial obrigatório para esta ação." };
}

export function isStripeReady(org: OrganizationWriteContext, requireStripe = true) {
  if (!requireStripe) return true;
  return (
    resolveConnectStatus(
      org.stripeAccountId ?? null,
      org.stripeChargesEnabled ?? false,
      org.stripePayoutsEnabled ?? false,
    ) === "READY"
  );
}

export function ensureStripeReadyForServices(org: OrganizationWriteContext): AccessResult {
  const requireStripe = org.orgType !== "PLATFORM";
  if (isStripeReady(org, requireStripe)) {
    return { ok: true };
  }
  return { ok: false, error: "Stripe obrigatório para criar serviços." };
}

export function ensureOrganizationWriteAccess(
  org: OrganizationWriteContext,
  opts?: { requireStripeForServices?: boolean },
): AccessResult {
  const emailGate = ensureOrganizationEmailVerified(org);
  if (!emailGate.ok) return emailGate;
  if (opts?.requireStripeForServices) {
    return ensureStripeReadyForServices(org);
  }
  return { ok: true };
}
