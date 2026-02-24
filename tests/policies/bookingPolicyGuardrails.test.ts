import { describe, expect, it } from "vitest";
import {
  BOOKING_POLICY_WINDOW_MINUTES_MAX,
  BOOKING_POLICY_WINDOW_MINUTES_MIN,
  ORG_RESCHEDULE_WINDOW_MINUTES_DEFAULT,
  ORG_RESCHEDULE_WINDOW_MINUTES_MAX,
  clampBookingPolicyWindowMinutes,
  clampOrgRescheduleWindowMinutes,
  validateBookingPolicyWindowMinutes,
  validateOrgRescheduleWindowMinutes,
} from "@/lib/policies/bookingPolicyGuardrails";

describe("booking policy guardrails", () => {
  it("aceita null quando o campo permite null", () => {
    const result = validateBookingPolicyWindowMinutes({
      value: null,
      field: "cancellationWindowMinutes",
      allowNull: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeNull();
    }
  });

  it("rejeita valores acima do limite", () => {
    const result = validateBookingPolicyWindowMinutes({
      value: BOOKING_POLICY_WINDOW_MINUTES_MAX + 1,
      field: "rescheduleWindowMinutes",
      allowNull: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("BOOKING_POLICY_RESCHEDULE_WINDOW_OUT_OF_RANGE");
    }
  });

  it("rejeita valor não numérico", () => {
    const result = validateBookingPolicyWindowMinutes({
      value: "abc",
      field: "cancellationWindowMinutes",
      allowNull: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("BOOKING_POLICY_CANCELLATION_WINDOW_INVALID");
    }
  });

  it("clamp da policy mantém range permitido", () => {
    expect(clampBookingPolicyWindowMinutes(-100)).toBe(BOOKING_POLICY_WINDOW_MINUTES_MIN);
    expect(clampBookingPolicyWindowMinutes(BOOKING_POLICY_WINDOW_MINUTES_MAX + 999)).toBe(
      BOOKING_POLICY_WINDOW_MINUTES_MAX,
    );
  });
});

describe("org reschedule guardrails", () => {
  it("rejeita orgRescheduleWindowMinutes acima do limite", () => {
    const result = validateOrgRescheduleWindowMinutes(3333333333333);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("ORG_RESCHEDULE_WINDOW_OUT_OF_RANGE");
    }
  });

  it("clamp do org reschedule usa default quando não numérico", () => {
    expect(clampOrgRescheduleWindowMinutes(Number.NaN)).toBe(ORG_RESCHEDULE_WINDOW_MINUTES_DEFAULT);
  });

  it("clamp do org reschedule respeita o máximo", () => {
    expect(clampOrgRescheduleWindowMinutes(ORG_RESCHEDULE_WINDOW_MINUTES_MAX + 500)).toBe(
      ORG_RESCHEDULE_WINDOW_MINUTES_MAX,
    );
  });
});
