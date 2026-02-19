import {
  IOS_PULL_DISMISS_THRESHOLD,
  resolveCanOpenTicketSheet,
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
});
