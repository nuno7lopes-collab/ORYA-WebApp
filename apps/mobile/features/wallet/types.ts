export type WalletEntitlement = {
  entitlementId: string;
  type:
    | "EVENT_TICKET"
    | "PADEL_ENTRY"
    | "SERVICE_BOOKING"
    | "TICKET"
    | "REGISTRATION"
    | "BOOKING"
    | string;
  status: string;
  consumedAt?: string | null;
  scope?: {
    eventId?: number | null;
    tournamentId?: number | null;
    seasonId?: number | null;
  };
  snapshot: {
    title: string | null;
    coverUrl: string | null;
    venueName: string | null;
    startAt: string | null;
    timezone: string | null;
  };
  actions?: {
    canShowQr?: boolean;
  };
  passAvailable?: boolean;
  qrToken?: string | null;
  updatedAt?: string;
};

export type WalletPage = {
  items: WalletEntitlement[];
  nextCursor: string | null;
};

export type WalletDetail = {
  entitlementId: string;
  type: string;
  status: string;
  consumedAt?: string | null;
  snapshot: WalletEntitlement["snapshot"];
  actions?: {
    canShowQr?: boolean;
  };
  passAvailable?: boolean;
  passUrl?: string | null;
  qrToken?: string | null;
  event?: {
    id: number;
    slug: string;
    organizationName: string | null;
    organizationUsername: string | null;
  } | null;
  payment?: {
    totalPaidCents: number;
    platformFeeCents: number;
    cardPlatformFeeCents: number;
    stripeFeeCents: number;
    feesTotalCents: number;
    netCents: number;
    currency: string;
    status: string | null;
    feeMode: string | null;
    paymentMethod: string | null;
  } | null;
  refund?: {
    baseAmountCents: number;
    feesExcludedCents: number;
    refundedAt: string | null;
    reason: string | null;
  } | null;
  pairing?: {
    id: number;
    paymentMode: string;
    pairingStatus: string;
    lifecycleStatus: string;
    slots: Array<{ slotRole: string; slotStatus: string; paymentStatus: string }>;
  } | null;
  pairingActions?: {
    canAccept: boolean;
    canDecline: boolean;
    canPay: boolean;
    userSlotRole: string | null;
  } | null;
  audit?: {
    updatedAt?: string | null;
    createdAt?: string | null;
  };
};
