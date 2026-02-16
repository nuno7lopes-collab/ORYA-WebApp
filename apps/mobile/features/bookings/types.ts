export type BookingActionPolicy = {
  allowed: boolean;
  reason: string | null;
  deadline: string | null;
};

export type BookingChangeRequest = {
  id: number;
  requestedBy: "ORG" | "USER";
  status: string;
  proposedStartsAt: string;
  priceDeltaCents: number;
  currency: string;
  expiresAt: string;
};

export type BookingOrganization = {
  id: number;
  publicName: string | null;
  businessName: string | null;
  username: string | null;
  brandingAvatarUrl: string | null;
  addressRef?: { formattedAddress?: string | null } | null;
};

export type BookingService = {
  id: number;
  title: string | null;
} | null;

export type BookingItem = {
  id: number;
  startsAt: string;
  durationMinutes: number;
  status: string;
  price: number;
  currency: string;
  estimatedStartsAt?: string | null;
  delayMinutes?: number | null;
  delayReason?: string | null;
  service: BookingService;
  organization: BookingOrganization | null;
  cancellation: BookingActionPolicy;
  reschedule: BookingActionPolicy;
  changeRequest?: BookingChangeRequest | null;
};

export type BookingCancelPreview = {
  allowed: boolean;
  reason: string | null;
  deadline: string | null;
  refund: {
    currency: string;
    totalCents: number;
    penaltyCents: number;
    refundCents: number;
    feesRetainedCents?: number;
    rule: string;
  } | null;
};

export type BookingChangeResponse = {
  request?: {
    id: number;
    status: string;
  } | null;
  payment?: {
    purchaseId: string;
    paymentId: string;
    paymentIntentId: string;
    clientSecret: string | null;
    amountCents: number;
    currency: string;
  } | null;
};

const TERMINAL_BOOKING_STATUSES = new Set([
  "CANCELLED",
  "CANCELLED_BY_CLIENT",
  "CANCELLED_BY_ORG",
  "COMPLETED",
  "NO_SHOW",
]);

const toTimestamp = (value: string | null | undefined) => {
  if (!value) return Number.NaN;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export const isTerminalBookingStatus = (status: string | null | undefined) =>
  typeof status === "string" && TERMINAL_BOOKING_STATUSES.has(status);

export const splitBookingsByTimeline = (items: BookingItem[], nowDate: Date = new Date()) => {
  const now = nowDate.getTime();
  const active: BookingItem[] = [];
  const history: BookingItem[] = [];

  items.forEach((item) => {
    const startTs = toTimestamp(item.startsAt);
    const inHistory = isTerminalBookingStatus(item.status) || !Number.isFinite(startTs) || startTs < now;
    if (inHistory) {
      history.push(item);
      return;
    }
    active.push(item);
  });

  active.sort((a, b) => toTimestamp(a.startsAt) - toTimestamp(b.startsAt));
  history.sort((a, b) => toTimestamp(b.startsAt) - toTimestamp(a.startsAt));

  return { active, history };
};
