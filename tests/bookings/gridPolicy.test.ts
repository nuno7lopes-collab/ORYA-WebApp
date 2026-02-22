import { describe, expect, it } from "vitest";
import {
  resolveBookingGridPolicy,
  validateBookingConfigInput,
  validateDurationAgainstPolicy,
  validateStartAtAgainstPolicy,
  validateStartMinuteAgainstPolicy,
} from "@/lib/reservas/gridPolicy";

describe("booking grid policy", () => {
  it("aceita :00 e :30 e recusa :15 quando grid=30", () => {
    const policy = resolveBookingGridPolicy({ gridMinutes: 30, activeDurations: [60, 90] });

    const ok00 = validateStartAtAgainstPolicy({
      startsAt: new Date("2026-01-12T10:00:00.000Z"),
      timezone: "Europe/Lisbon",
      policy,
    });
    const ok30 = validateStartAtAgainstPolicy({
      startsAt: new Date("2026-01-12T10:30:00.000Z"),
      timezone: "Europe/Lisbon",
      policy,
    });
    const fail15 = validateStartAtAgainstPolicy({
      startsAt: new Date("2026-01-12T10:15:00.000Z"),
      timezone: "Europe/Lisbon",
      policy,
    });

    expect(ok00.ok).toBe(true);
    expect(ok30.ok).toBe(true);
    expect(fail15.ok).toBe(false);
  });

  it("só aceita durações ativas do catálogo", () => {
    const policy = resolveBookingGridPolicy({
      gridMinutes: 30,
      activeDurations: [30, 60, 90, 120],
    });

    expect(validateDurationAgainstPolicy({ durationMinutes: 30, policy }).ok).toBe(true);
    expect(validateDurationAgainstPolicy({ durationMinutes: 60, policy }).ok).toBe(true);
    expect(validateDurationAgainstPolicy({ durationMinutes: 120, policy }).ok).toBe(true);
    expect(validateDurationAgainstPolicy({ durationMinutes: 75, policy }).ok).toBe(false);
  });

  it("valida startMinute pela grelha da organização", () => {
    const policy = resolveBookingGridPolicy({ gridMinutes: 30 });
    expect(validateStartMinuteAgainstPolicy({ startMinute: 10 * 60, policy }).ok).toBe(true);
    expect(validateStartMinuteAgainstPolicy({ startMinute: 10 * 60 + 30, policy }).ok).toBe(true);
    expect(validateStartMinuteAgainstPolicy({ startMinute: 10 * 60 + 15, policy }).ok).toBe(false);
  });

  it("recusa allowCustomDuration=true na config", () => {
    const validation = validateBookingConfigInput({
      gridMinutes: 30,
      activeDurations: [60, 90],
      allowCustomDuration: true,
    });
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.errorCode).toBe("INVALID_BOOKING_CONFIG");
    }
  });
});
