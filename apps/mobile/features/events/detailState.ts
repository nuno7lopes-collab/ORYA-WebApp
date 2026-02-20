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
  selectableTicketMetaLength: number;
  canAccessInvite: boolean;
  eventIsActive: boolean;
  isPublicEvent: boolean;
};

export type TicketSheetGateState = {
  hasTicketTypes: boolean;
  hasSelectableTickets: boolean;
  eventEnded: boolean;
  inviteLocked: boolean;
  configInvalid: boolean;
  canOpenSheet: boolean;
};

export type TicketCtaState =
  | "READY"
  | "INVITE_LOCKED"
  | "ENDED"
  | "COMING_SOON"
  | "UNAVAILABLE";

export const IOS_PULL_DISMISS_THRESHOLD = -86;

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

export const resolveTicketSheetGateState = ({
  showStickyPurchaseBar,
  ticketMetaLength,
  selectableTicketMetaLength,
  canAccessInvite,
  eventIsActive,
  isPublicEvent,
}: TicketSheetGateInput): TicketSheetGateState => {
  const hasTicketTypes = showStickyPurchaseBar && ticketMetaLength > 0;
  const hasSelectableTickets =
    showStickyPurchaseBar && selectableTicketMetaLength > 0;
  const eventEnded = !eventIsActive;
  const inviteLocked = !canAccessInvite;
  const configInvalid =
    showStickyPurchaseBar &&
    isPublicEvent &&
    eventIsActive &&
    canAccessInvite &&
    hasTicketTypes &&
    !hasSelectableTickets;

  return {
    hasTicketTypes,
    hasSelectableTickets,
    eventEnded,
    inviteLocked,
    configInvalid,
    canOpenSheet:
      showStickyPurchaseBar &&
      hasTicketTypes &&
      hasSelectableTickets &&
      canAccessInvite &&
      eventIsActive,
  };
};

export const resolveCanOpenTicketSheet = (input: TicketSheetGateInput) =>
  resolveTicketSheetGateState(input).canOpenSheet;

export const resolveTicketCtaState = (
  gateState: TicketSheetGateState,
): TicketCtaState => {
  if (gateState.canOpenSheet) return "READY";
  if (gateState.inviteLocked) return "INVITE_LOCKED";
  if (gateState.eventEnded) return "ENDED";
  if (!gateState.hasTicketTypes) return "COMING_SOON";
  return "UNAVAILABLE";
};
