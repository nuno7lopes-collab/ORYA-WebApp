import { describe, expect, it, vi } from "vitest";

vi.mock("@/domain/outbox/producer", () => ({
  recordOutboxEvent: vi.fn(async () => ({ eventId: "evt_test" })),
}));
vi.mock("@/domain/eventLog/append", () => ({
  appendEventLog: vi.fn(async () => null),
}));
import { PadelPairingJoinMode, PadelPaymentMode, PadelRegistrationStatus } from "@prisma/client";
import {
  deriveRegistrationStatusFromPairing,
  mapRegistrationToPairingLifecycle,
  resolveInitialPadelRegistrationStatus,
  resolvePartnerActionStatus,
} from "@/domain/padelRegistration";

describe("padel registration status (D12)", () => {
  it("resolves initial status from join mode + payment", () => {
    expect(
      resolveInitialPadelRegistrationStatus({
        pairingJoinMode: PadelPairingJoinMode.INVITE_PARTNER,
        paymentMode: PadelPaymentMode.SPLIT,
        captainPaid: false,
      }),
    ).toBe(PadelRegistrationStatus.PENDING_PARTNER);

    expect(
      resolveInitialPadelRegistrationStatus({
        pairingJoinMode: PadelPairingJoinMode.LOOKING_FOR_PARTNER,
        paymentMode: PadelPaymentMode.SPLIT,
        captainPaid: false,
      }),
    ).toBe(PadelRegistrationStatus.MATCHMAKING);

    expect(
      resolveInitialPadelRegistrationStatus({
        pairingJoinMode: PadelPairingJoinMode.INVITE_PARTNER,
        paymentMode: PadelPaymentMode.FULL,
        captainPaid: true,
      }),
    ).toBe(PadelRegistrationStatus.CONFIRMED);
  });

  it("resolves partner action status", () => {
    expect(resolvePartnerActionStatus({ partnerPaid: false })).toBe(PadelRegistrationStatus.PENDING_PAYMENT);
    expect(resolvePartnerActionStatus({ partnerPaid: true })).toBe(PadelRegistrationStatus.CONFIRMED);
  });

  it("maps registration to pairing lifecycle (compat)", () => {
    expect(mapRegistrationToPairingLifecycle(PadelRegistrationStatus.CONFIRMED, PadelPaymentMode.FULL)).toBe(
      "CONFIRMED_CAPTAIN_FULL",
    );
    expect(mapRegistrationToPairingLifecycle(PadelRegistrationStatus.CONFIRMED, PadelPaymentMode.SPLIT)).toBe(
      "CONFIRMED_BOTH_PAID",
    );
    expect(mapRegistrationToPairingLifecycle(PadelRegistrationStatus.PENDING_PAYMENT, PadelPaymentMode.SPLIT)).toBe(
      "PENDING_PARTNER_PAYMENT",
    );
    expect(mapRegistrationToPairingLifecycle(PadelRegistrationStatus.MATCHMAKING, PadelPaymentMode.SPLIT)).toBe(
      "PENDING_ONE_PAID",
    );
    expect(mapRegistrationToPairingLifecycle(PadelRegistrationStatus.EXPIRED, PadelPaymentMode.SPLIT)).toBe(
      "CANCELLED_INCOMPLETE",
    );
  });

  it("derives registration status from pairing lifecycle (legacy)", () => {
    expect(
      deriveRegistrationStatusFromPairing({
        pairingJoinMode: PadelPairingJoinMode.INVITE_PARTNER,
        lifecycleStatus: "CANCELLED_INCOMPLETE",
        paymentMode: PadelPaymentMode.SPLIT,
      }),
    ).toBe(PadelRegistrationStatus.CANCELLED);

    expect(
      deriveRegistrationStatusFromPairing({
        pairingJoinMode: PadelPairingJoinMode.INVITE_PARTNER,
        lifecycleStatus: "PENDING_PARTNER_PAYMENT",
        paymentMode: PadelPaymentMode.SPLIT,
      }),
    ).toBe(PadelRegistrationStatus.PENDING_PAYMENT);

    expect(
      deriveRegistrationStatusFromPairing({
        pairingJoinMode: PadelPairingJoinMode.LOOKING_FOR_PARTNER,
        lifecycleStatus: "PENDING_ONE_PAID",
        paymentMode: PadelPaymentMode.SPLIT,
      }),
    ).toBe(PadelRegistrationStatus.MATCHMAKING);
  });
});
