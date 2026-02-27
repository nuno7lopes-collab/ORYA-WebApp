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

export type CheckoutDraftItem = {
  ticketTypeId: number;
  ticketName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  currency: string;
};

export type CheckoutInventoryHold = {
  holdId: string;
  ticketTypeId: number;
  quantity: number;
  subjectFingerprint: string;
  expiresAt: string;
  subjectLabel: string;
};

export type CheckoutDraft = {
  slug?: string;
  eventId?: number;
  eventTitle?: string;
  serviceId?: number | null;
  serviceTitle?: string | null;
  organizationId?: number | null;
  bookingId?: number | null;
  bookingStartsAt?: string | null;
  bookingDurationMinutes?: number | null;
  bookingProfessionalId?: number | null;
  bookingResourceIds?: number[] | null;
  pendingExpiresAt?: string | null;
  bookingExpiresAt?: string | null;
  holdId?: string | null;
  clientSessionId?: string | null;
  holdSubjectFingerprint?: string | null;
  holdSubjectLabel?: string | null;
  holdExpiresAt?: string | null;
  inventoryClientSessionId?: string | null;
  inventoryHolds?: CheckoutInventoryHold[] | null;
  inventoryHoldExpiresAt?: string | null;
  sourceType?: string;
  paymentScenario?: string | null;
  pairingId?: number | null;
  pairingSlotId?: number | null;
  inviteToken?: string | null;
  idempotencyKey?: string | null;
  items?: CheckoutDraftItem[];
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
  code?: string;
  status?: CheckoutStatus;
  nextAction?: string;
  retryable?: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
  purchaseId?: string;
  stripePublishableKey?: string | null;
  stripeMode?: "test" | "prod" | string | null;
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
