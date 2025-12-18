export type FulfillPayload = {
  paymentIntentId: string;
  purchaseId: string;
  eventId?: number | null;
  userId?: string | null;
  ownerIdentityId?: string | null;
  lines: Array<{
    ticketTypeId: number;
    quantity: number;
    unitPriceCents: number;
    currency?: string;
  }>;
  breakdown?: {
    subtotalCents: number;
    discountCents: number;
    platformFeeCents: number;
    totalCents: number;
    feeMode?: string | null;
    currency?: string | null;
    feeBpsApplied?: number | null;
    feeFixedApplied?: number | null;
  };
  promoCodeId?: number | null;
  promoCode?: string | null;
  scenario?: string | null;
  pairingId?: number | null;
  slotId?: number | null;
  rawMetadata?: Record<string, unknown>;
};
