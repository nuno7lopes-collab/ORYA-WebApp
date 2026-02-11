export type CheckoutMethod = "card" | "mbway" | "apple_pay";

export type CheckoutStatus =
  | "PENDING"
  | "PROCESSING"
  | "REQUIRES_ACTION"
  | "PAID"
  | "SUCCEEDED"
  | "FAILED"
  | "REFUNDED"
  | "DISPUTED"
  | "CANCELED"
  | "CANCELLED"
  | "EXPIRED";

export type CheckoutLine = {
  ticketTypeId?: number;
  name: string;
  quantity: number;
  unitPriceCents: number;
  currency: string;
  lineTotalCents: number;
};

export type CheckoutBreakdown = {
  lines: CheckoutLine[];
  subtotalCents: number;
  discountCents: number;
  platformFeeCents?: number;
  cardPlatformFeeCents?: number;
  cardPlatformFeeBps?: number;
  totalCents: number;
  currency: string;
  paymentMethod?: "mbway" | "card";
};

export type CheckoutDraft = {
  slug?: string;
  eventId?: number;
  eventTitle?: string;
  serviceId?: number | null;
  serviceTitle?: string | null;
  bookingId?: number | null;
  bookingStartsAt?: string | null;
  pendingExpiresAt?: string | null;
  bookingExpiresAt?: string | null;
  sourceType?: string;
  paymentScenario?: string | null;
  pairingId?: number | null;
  pairingSlotId?: number | null;
  inviteToken?: string | null;
  idempotencyKey?: string | null;
  ticketTypeId?: number;
  ticketName?: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  currency: string;
  paymentMethod?: CheckoutMethod;
  purchaseId?: string | null;
  paymentIntentId?: string | null;
  clientSecret?: string | null;
  breakdown?: CheckoutBreakdown | null;
  freeCheckout?: boolean;
  createdAt: string;
  expiresAt: string;
};

export type CheckoutIntentResponse = {
  ok?: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
  purchaseId?: string;
  paymentScenario?: string;
  breakdown?: CheckoutBreakdown;
  freeCheckout?: boolean;
  isGratisCheckout?: boolean;
  amount?: number;
  currency?: string;
};

export type CheckoutStatusResponse = {
  status: CheckoutStatus;
  statusV1?: "PENDING" | "PROCESSING" | "REQUIRES_ACTION" | "SUCCEEDED" | "FAILED" | "CANCELED" | "EXPIRED";
  final: boolean;
  checkoutId?: string | null;
  purchaseId?: string | null;
  paymentIntentId?: string | null;
  code?: string;
  retryable?: boolean;
  nextAction?: string;
  errorMessage?: string | null;
};
