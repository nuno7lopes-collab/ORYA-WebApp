import { describe, expect, it } from "vitest";
import { makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { validateClassSessionsAgainstAvailability } from "@/lib/reservas/classSeriesAvailability";

const TIMEZONE = "Europe/Lisbon";

function makeTemplatesForAllDays(availabilityId: number, startMinute: number, endMinute: number) {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    availabilityId,
    dayOfWeek,
    intervals: [{ startMinute, endMinute }],
  }));
}

function makeSession(year: number, month: number, day: number, startHour: number, endHour: number) {
  const startsAt = makeUtcDateFromLocal({ year, month, day, hour: startHour, minute: 0 }, TIMEZONE);
  const endsAt = makeUtcDateFromLocal({ year, month, day, hour: endHour, minute: 0 }, TIMEZONE);
  return { startsAt, endsAt };
}

describe("classSeriesAvailability validation", () => {
  it("bloqueia sessão de aula fora da disponibilidade do escopo profissional", async () => {
    const tx = {
      availabilitySchedule: {
        findMany: async () => [
          {
            id: 11,
            scopeType: "ORGANIZATION" as const,
            scopeId: 0,
            startDate: new Date("2030-01-01T00:00:00.000Z"),
            endDate: null,
            createdAt: new Date("2029-12-01T00:00:00.000Z"),
          },
          {
            id: 12,
            scopeType: "PROFESSIONAL" as const,
            scopeId: 88,
            startDate: new Date("2030-01-01T00:00:00.000Z"),
            endDate: null,
            createdAt: new Date("2029-12-01T00:00:00.000Z"),
          },
        ],
      },
      availabilityOverride: {
        findMany: async () => [],
      },
      weeklyAvailabilityTemplate: {
        findMany: async () => [
          ...makeTemplatesForAllDays(11, 8 * 60, 18 * 60),
          ...makeTemplatesForAllDays(12, 8 * 60, 10 * 60),
        ],
      },
    };

    const session = makeSession(2030, 1, 8, 11, 12);
    const validation = await validateClassSessionsAgainstAvailability({
      tx,
      organizationId: 21,
      timezone: TIMEZONE,
      sessions: [session],
      professionalId: 88,
      stepMinutes: 30,
    });

    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.conflict.scopeType).toBe("PROFESSIONAL");
    expect(validation.conflict.scopeId).toBe(88);
    expect(validation.conflict.reason).toBe("outside_scope_availability");
  });

  it("aceita sessão quando só existe escopo geral e o slot está dentro da disponibilidade", async () => {
    const tx = {
      availabilitySchedule: {
        findMany: async () => [
          {
            id: 21,
            scopeType: "ORGANIZATION" as const,
            scopeId: 0,
            startDate: new Date("2030-01-01T00:00:00.000Z"),
            endDate: null,
            createdAt: new Date("2029-12-01T00:00:00.000Z"),
          },
        ],
      },
      availabilityOverride: {
        findMany: async () => [],
      },
      weeklyAvailabilityTemplate: {
        findMany: async () => makeTemplatesForAllDays(21, 8 * 60, 19 * 60),
      },
    };

    const session = makeSession(2030, 1, 8, 10, 11);
    const validation = await validateClassSessionsAgainstAvailability({
      tx,
      organizationId: 21,
      timezone: TIMEZONE,
      sessions: [session],
      professionalId: null,
      resourceScopeId: null,
      stepMinutes: 30,
    });

    expect(validation.ok).toBe(true);
  });
});
