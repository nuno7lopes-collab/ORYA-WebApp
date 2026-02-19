type PullDismissInput = {
  platform: string;
  offsetY: number;
  ticketSheetVisible: boolean;
  dismissInFlight: boolean;
  threshold?: number;
};

type TicketSheetGateInput = {
  showStickyPurchaseBar: boolean;
  ticketMetaLength: number;
  canAccessInvite: boolean;
  eventIsActive: boolean;
};

export const IOS_PULL_DISMISS_THRESHOLD = -72;

export const shouldDismissByPullDown = ({
  platform,
  offsetY,
  ticketSheetVisible,
  dismissInFlight,
  threshold = IOS_PULL_DISMISS_THRESHOLD,
}: PullDismissInput) =>
  platform === "ios" &&
  !ticketSheetVisible &&
  !dismissInFlight &&
  offsetY <= threshold;

export const resolveCanOpenTicketSheet = ({
  showStickyPurchaseBar,
  ticketMetaLength,
  canAccessInvite,
  eventIsActive,
}: TicketSheetGateInput) =>
  showStickyPurchaseBar &&
  ticketMetaLength > 0 &&
  canAccessInvite &&
  eventIsActive;
