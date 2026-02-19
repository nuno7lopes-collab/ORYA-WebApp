import {
  IOS_PULL_DISMISS_THRESHOLD,
  resolveCanOpenTicketSheet,
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
        canAccessInvite: true,
        eventIsActive: false,
      }),
    ).toBe(false);
  });

  it("opens ticket sheet gate when all conditions are valid", () => {
    expect(
      resolveCanOpenTicketSheet({
        showStickyPurchaseBar: true,
        ticketMetaLength: 2,
        canAccessInvite: true,
        eventIsActive: true,
      }),
    ).toBe(true);
  });
});
