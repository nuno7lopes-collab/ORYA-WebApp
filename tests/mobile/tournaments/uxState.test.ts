import { describe, expect, it } from "vitest";
import {
  resolveRegistrationBlockReason,
  resolveRegistrationPrimaryCtaLabel,
  shouldShowMyPairingSection,
  shouldShowOpenPairingsSection,
} from "@/apps/mobile/features/tournaments/uxState";

describe("mobile tournament ux state", () => {
  it("prioritizes missing category before any other block", () => {
    const reason = resolveRegistrationBlockReason({
      registrationOpen: true,
      hasCategory: false,
      joinMode: "LOOKING_FOR_PARTNER",
      inviteContact: "",
      pairingBusy: false,
      padelActionsDisabled: false,
    });

    expect(reason).toBe("MISSING_CATEGORY");
  });

  it("requires invite contact when invite mode is selected", () => {
    const reason = resolveRegistrationBlockReason({
      registrationOpen: true,
      hasCategory: true,
      joinMode: "INVITE_PARTNER",
      inviteContact: "   ",
      pairingBusy: false,
      padelActionsDisabled: false,
    });

    expect(reason).toBe("MISSING_INVITE_CONTACT");
  });

  it("returns null when registration can continue", () => {
    const reason = resolveRegistrationBlockReason({
      registrationOpen: true,
      hasCategory: true,
      joinMode: "LOOKING_FOR_PARTNER",
      inviteContact: "",
      pairingBusy: false,
      padelActionsDisabled: false,
    });

    expect(reason).toBeNull();
  });

  it("renders open pairings only when loading or with rows", () => {
    expect(shouldShowOpenPairingsSection(false, 0)).toBe(false);
    expect(shouldShowOpenPairingsSection(true, 0)).toBe(true);
    expect(shouldShowOpenPairingsSection(false, 2)).toBe(true);
  });

  it("renders my pairing only for authenticated users", () => {
    expect(shouldShowMyPairingSection(false, true, 2)).toBe(false);
    expect(shouldShowMyPairingSection(false, false, 2)).toBe(false);
    expect(shouldShowMyPairingSection(true, true, 0)).toBe(true);
    expect(shouldShowMyPairingSection(true, false, 1)).toBe(true);
  });

  it("keeps deterministic registration cta copy by mode", () => {
    expect(resolveRegistrationPrimaryCtaLabel("FULL")).toBe("CREATE_AND_PAY");
    expect(resolveRegistrationPrimaryCtaLabel("SPLIT")).toBe("CREATE_AND_CONTINUE");
  });
});
