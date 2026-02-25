import { resolveConnectStatus } from "@/domain/finance/stripeConnectStatus";
import { requiresOrganizationStripe } from "@/domain/finance/payoutModePolicy";
import { buildOrgHref, parseOrganizationId } from "@/lib/organizationIdUtils";
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

type PaidWriteGateInput = {
  organizationId?: number | null;
  orgType?: string | null;
  officialEmail?: string | null;
  officialEmailVerifiedAt?: Date | string | null;
  stripeAccountId?: string | null;
  stripeChargesEnabled?: boolean | null;
  stripePayoutsEnabled?: boolean | null;
  amountCents?: number | null;
};

type PaidWriteGateFailureDetails = {
  missingEmail: boolean;
  missingStripe: boolean;
  ctaHref: string;
};

export type PaidWriteGateResult =
  | { ok: true }
  | {
      ok: false;
      errorCode: "PAYMENTS_NOT_READY";
      message: string;
      details: PaidWriteGateFailureDetails;
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

function resolvePaidWriteCtaHref(organizationId: number | null) {
  if (!organizationId) {
    return "/org-hub/organizations";
  }
  return buildOrgHref(organizationId, "/finance", { view: "payouts" });
}

function normalizeAmountCents(amountCents: number | null | undefined) {
  if (!Number.isFinite(Number(amountCents))) return 0;
  return Math.round(Number(amountCents));
}

export function evaluatePaidWriteGate(input: PaidWriteGateInput): PaidWriteGateResult {
  const amountCents = normalizeAmountCents(input.amountCents ?? 0);
  if (amountCents <= 0) {
    return { ok: true };
  }

  const organizationId = parseOrganizationId(input.organizationId ?? null);
  const requireStripe = requiresOrganizationStripe(input.orgType);
  const gate = getPaidSalesGate({
    officialEmail: input.officialEmail ?? null,
    officialEmailVerifiedAt: input.officialEmailVerifiedAt ?? null,
    stripeAccountId: input.stripeAccountId ?? null,
    stripeChargesEnabled: input.stripeChargesEnabled ?? false,
    stripePayoutsEnabled: input.stripePayoutsEnabled ?? false,
    requireStripe,
  });
  if (gate.ok) {
    return { ok: true };
  }

  const message = formatPaidSalesGateMessage(
    gate,
    "Pagamentos indisponíveis para preços pagos nesta organização.",
  );
  return {
    ok: false,
    errorCode: "PAYMENTS_NOT_READY",
    message,
    details: {
      missingEmail: gate.missingEmail,
      missingStripe: gate.missingStripe,
      ctaHref: resolvePaidWriteCtaHref(organizationId),
    },
  };
}
