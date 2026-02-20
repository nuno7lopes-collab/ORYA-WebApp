import {
  IOS_PULL_DISMISS_THRESHOLD,
  resolveCanOpenTicketSheet,
  resolveTicketCtaState,
  resolveTicketSheetGateState,
  shouldDismissByPullDown,
} from "../features/events/detailState";

describe("event detail state helpers", () => {
  it("dismisses on iOS pull-down when threshold is exceeded", () => {
    expect(
      shouldDismissByPullDown({
        platform: "ios",
        offsetY: IOS_PULL_DISMISS_THRESHOLD - 4,
        ticketSheetVisible: false,
        dismissInFlight: false,
      }),
    ).toBe(true);
  });

  it("does not dismiss on android", () => {
    expect(
      shouldDismissByPullDown({
        platform: "android",
        offsetY: IOS_PULL_DISMISS_THRESHOLD - 20,
        ticketSheetVisible: false,
        dismissInFlight: false,
      }),
    ).toBe(false);
  });

  it("keeps ticket sheet gate closed when event is inactive", () => {
    expect(
      resolveCanOpenTicketSheet({
        showStickyPurchaseBar: true,
        ticketMetaLength: 3,
        selectableTicketMetaLength: 3,
        canAccessInvite: true,
        eventIsActive: false,
        isPublicEvent: true,
      }),
    ).toBe(false);
  });

  it("opens ticket sheet gate when all conditions are valid", () => {
    expect(
      resolveCanOpenTicketSheet({
        showStickyPurchaseBar: true,
        ticketMetaLength: 2,
        selectableTicketMetaLength: 2,
        canAccessInvite: true,
        eventIsActive: true,
        isPublicEvent: true,
      }),
    ).toBe(true);
  });

  it("flags config invalid when event has tickets but none selectable", () => {
    const state = resolveTicketSheetGateState({
      showStickyPurchaseBar: true,
      ticketMetaLength: 2,
      selectableTicketMetaLength: 0,
      canAccessInvite: true,
      eventIsActive: true,
      isPublicEvent: true,
    });
    expect(state.configInvalid).toBe(true);
    expect(state.canOpenSheet).toBe(false);
  });

  it("resolves READY CTA only when ticket sheet can open", () => {
    const gateState = resolveTicketSheetGateState({
      showStickyPurchaseBar: true,
      ticketMetaLength: 2,
      selectableTicketMetaLength: 2,
      canAccessInvite: true,
      eventIsActive: true,
      isPublicEvent: true,
    });
    expect(gateState.canOpenSheet).toBe(true);
    expect(resolveTicketCtaState(gateState)).toBe("READY");
  });

  it("resolves INVITE_LOCKED CTA when invite gate blocks access", () => {
    const gateState = resolveTicketSheetGateState({
      showStickyPurchaseBar: true,
      ticketMetaLength: 2,
      selectableTicketMetaLength: 2,
      canAccessInvite: false,
      eventIsActive: true,
      isPublicEvent: false,
    });
    expect(resolveTicketCtaState(gateState)).toBe("INVITE_LOCKED");
  });

  it("resolves ENDED CTA when event ended", () => {
    const gateState = resolveTicketSheetGateState({
      showStickyPurchaseBar: true,
      ticketMetaLength: 2,
      selectableTicketMetaLength: 2,
      canAccessInvite: true,
      eventIsActive: false,
      isPublicEvent: true,
    });
    expect(resolveTicketCtaState(gateState)).toBe("ENDED");
  });

  it("resolves COMING_SOON CTA when event has no ticket types yet", () => {
    const gateState = resolveTicketSheetGateState({
      showStickyPurchaseBar: true,
      ticketMetaLength: 0,
      selectableTicketMetaLength: 0,
      canAccessInvite: true,
      eventIsActive: true,
      isPublicEvent: true,
    });
    expect(resolveTicketCtaState(gateState)).toBe("COMING_SOON");
  });

  it("resolves UNAVAILABLE CTA when tickets exist but none are purchasable", () => {
    const gateState = resolveTicketSheetGateState({
      showStickyPurchaseBar: true,
      ticketMetaLength: 3,
      selectableTicketMetaLength: 0,
      canAccessInvite: true,
      eventIsActive: true,
      isPublicEvent: true,
    });
    expect(resolveTicketCtaState(gateState)).toBe("UNAVAILABLE");
  });
});
