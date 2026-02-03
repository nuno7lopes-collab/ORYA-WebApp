export type WalletEntitlement = {
  entitlementId: string;
  type: "TICKET" | "REGISTRATION" | "BOOKING" | string;
  status: string;
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
  snapshot: WalletEntitlement["snapshot"];
  passAvailable?: boolean;
  passUrl?: string | null;
  qrToken?: string | null;
  event?: {
    id: number;
    slug: string;
    organizationName: string | null;
    organizationUsername: string | null;
  } | null;
  pairing?: {
    id: number;
    paymentMode: string;
    pairingStatus: string;
    lifecycleStatus: string;
    slots: Array<{ slotRole: string; slotStatus: string; paymentStatus: string }>;
  } | null;
};
