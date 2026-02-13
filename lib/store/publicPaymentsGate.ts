import { getPaidSalesGate } from "@/lib/organizationPayments";
import { requiresOrganizationStripe } from "@/domain/finance/payoutModePolicy";

type PublicPaymentsGateInput = {
  orgType?: string | null;
  officialEmail?: string | null;
  officialEmailVerifiedAt?: Date | string | null;
  stripeAccountId?: string | null;
  stripeChargesEnabled?: boolean | null;
  stripePayoutsEnabled?: boolean | null;
};

export function getPublicStorePaymentsGate(input: PublicPaymentsGateInput) {
  const requireStripe = requiresOrganizationStripe(input.orgType);
  const gate = getPaidSalesGate({
    officialEmail: input.officialEmail ?? null,
    officialEmailVerifiedAt: input.officialEmailVerifiedAt ?? null,
    stripeAccountId: input.stripeAccountId ?? null,
    stripeChargesEnabled: input.stripeChargesEnabled ?? false,
    stripePayoutsEnabled: input.stripePayoutsEnabled ?? false,
    requireStripe,
  });
  return {
    ...gate,
    requireStripe,
  };
}
