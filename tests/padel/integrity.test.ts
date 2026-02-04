import { describe, expect, it } from "vitest";
import {
  computePadelIntegritySummary,
  evaluatePadelIntegrity,
  resolveExpectedRegistrationStatus,
} from "@/domain/padel/integrity";
import {
  PadelPairingJoinMode,
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPairingStatus,
  PadelRegistrationStatus,
} from "@prisma/client";

const basePairing = {
  id: 1,
  eventId: 10,
  categoryId: null,
  pairingStatus: PadelPairingStatus.COMPLETE,
  pairingJoinMode: PadelPairingJoinMode.INVITE_PARTNER,
  registrationStatus: PadelRegistrationStatus.CONFIRMED,
  slots: [
    { slotStatus: PadelPairingSlotStatus.FILLED, paymentStatus: PadelPairingPaymentStatus.PAID },
    { slotStatus: PadelPairingSlotStatus.FILLED, paymentStatus: PadelPairingPaymentStatus.PAID },
  ],
};

describe("padel integrity checks", () => {
  it("resolves expected status from slots", () => {
    expect(resolveExpectedRegistrationStatus(basePairing)).toBe(PadelRegistrationStatus.CONFIRMED);

    expect(
      resolveExpectedRegistrationStatus({
        ...basePairing,
        slots: [
          { slotStatus: PadelPairingSlotStatus.FILLED, paymentStatus: PadelPairingPaymentStatus.PAID },
          { slotStatus: PadelPairingSlotStatus.FILLED, paymentStatus: PadelPairingPaymentStatus.UNPAID },
        ],
      }),
    ).toBe(PadelRegistrationStatus.PENDING_PAYMENT);
  });

  it("flags confirmed pairings with inconsistent slots", () => {
    const issues = evaluatePadelIntegrity({
      ...basePairing,
      pairingStatus: PadelPairingStatus.INCOMPLETE,
      slots: [
        { slotStatus: PadelPairingSlotStatus.FILLED, paymentStatus: PadelPairingPaymentStatus.UNPAID },
        { slotStatus: PadelPairingSlotStatus.FILLED, paymentStatus: PadelPairingPaymentStatus.PAID },
      ],
    });

    const reasons = issues.map((issue) => issue.reason);
    expect(reasons).toEqual(expect.arrayContaining([
      "CONFIRMED_PAIRING_INCOMPLETE",
      "CONFIRMED_SLOTS_UNPAID",
      "REGISTRATION_STATUS_MISMATCH",
    ]));
  });

  it("flags matchmaking join mode mismatches", () => {
    const issues = evaluatePadelIntegrity({
      ...basePairing,
      registrationStatus: PadelRegistrationStatus.MATCHMAKING,
      pairingJoinMode: PadelPairingJoinMode.INVITE_PARTNER,
    });
    expect(issues.some((issue) => issue.reason === "MATCHMAKING_JOINMODE_MISMATCH")).toBe(true);
  });

  it("summarizes issues", () => {
    const summary = computePadelIntegritySummary([
      basePairing,
      {
        ...basePairing,
        id: 2,
        pairingStatus: PadelPairingStatus.INCOMPLETE,
        slots: [
          { slotStatus: PadelPairingSlotStatus.FILLED, paymentStatus: PadelPairingPaymentStatus.UNPAID },
          { slotStatus: PadelPairingSlotStatus.FILLED, paymentStatus: PadelPairingPaymentStatus.UNPAID },
        ],
      },
    ]);

    expect(summary.counts.total).toBeGreaterThan(0);
    expect(summary.counts.byReason).toHaveProperty("REGISTRATION_STATUS_MISMATCH");
  });
});
