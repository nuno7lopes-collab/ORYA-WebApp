import { describe, expect, it } from "vitest";
import { AvailabilityScopeType } from "@prisma/client";
import { buildScheduleDelayMap, resolveBookingDelay } from "@/lib/reservas/scheduleDelay";

const baseTime = new Date("2026-02-04T10:00:00.000Z");

const makeDelay = (params: { scopeType: AvailabilityScopeType; scopeId: number; delayMinutes: number; effectiveFrom: string }) => ({
  scopeType: params.scopeType,
  scopeId: params.scopeId,
  delayMinutes: params.delayMinutes,
  reason: null,
  effectiveFrom: new Date(params.effectiveFrom),
  createdAt: new Date(params.effectiveFrom),
});

describe("schedule delays", () => {
  it("aplica atraso da organização", () => {
    const delays = buildScheduleDelayMap([
      makeDelay({ scopeType: AvailabilityScopeType.ORGANIZATION, scopeId: 0, delayMinutes: 10, effectiveFrom: "2026-02-04T09:00:00.000Z" }),
    ]);

    const result = resolveBookingDelay({
      startsAt: baseTime,
      assignmentMode: "PROFESSIONAL",
      professionalId: 12,
      resourceId: null,
      delayMap: delays,
    });

    expect(result.delayMinutes).toBe(10);
    expect(result.estimatedStartsAt?.toISOString()).toBe("2026-02-04T10:10:00.000Z");
  });

  it("soma atraso de organização e profissional", () => {
    const delays = buildScheduleDelayMap([
      makeDelay({ scopeType: AvailabilityScopeType.ORGANIZATION, scopeId: 0, delayMinutes: 10, effectiveFrom: "2026-02-04T09:00:00.000Z" }),
      makeDelay({ scopeType: AvailabilityScopeType.PROFESSIONAL, scopeId: 12, delayMinutes: 5, effectiveFrom: "2026-02-04T09:30:00.000Z" }),
    ]);

    const result = resolveBookingDelay({
      startsAt: baseTime,
      assignmentMode: "PROFESSIONAL",
      professionalId: 12,
      resourceId: null,
      delayMap: delays,
    });

    expect(result.delayMinutes).toBe(15);
    expect(result.estimatedStartsAt?.toISOString()).toBe("2026-02-04T10:15:00.000Z");
  });

  it("ignora atraso efetivo depois do horário", () => {
    const delays = buildScheduleDelayMap([
      makeDelay({ scopeType: AvailabilityScopeType.ORGANIZATION, scopeId: 0, delayMinutes: 10, effectiveFrom: "2026-02-04T11:00:00.000Z" }),
    ]);

    const result = resolveBookingDelay({
      startsAt: baseTime,
      assignmentMode: "RESOURCE",
      professionalId: null,
      resourceId: 5,
      delayMap: delays,
    });

    expect(result.delayMinutes).toBe(0);
    expect(result.estimatedStartsAt).toBeNull();
  });
});
