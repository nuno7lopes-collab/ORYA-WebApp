import { describe, expect, it } from "vitest";
import {
  agendaConflictResponse,
  buildBookingConflictBlocks,
  buildSessionConflictBlocks,
} from "@/lib/reservas/agendaConflictHelpers";

describe("agenda conflict helpers", () => {
  it("transforma bookings e sessões em blocos de conflito normalizados", () => {
    const blocks = buildBookingConflictBlocks([
      {
        startsAt: new Date("2026-03-10T10:00:00.000Z"),
        durationMinutes: 90,
        professionalId: 1,
        resourceId: 2,
      },
    ]);
    const sessionBlocks = buildSessionConflictBlocks([
      {
        startsAt: new Date("2026-03-10T12:00:00.000Z"),
        endsAt: new Date("2026-03-10T13:00:00.000Z"),
        professionalId: 3,
      },
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].start.toISOString()).toBe("2026-03-10T10:00:00.000Z");
    expect(blocks[0].end.toISOString()).toBe("2026-03-10T11:30:00.000Z");
    expect(blocks[0].resourceId).toBe(2);

    expect(sessionBlocks).toHaveLength(1);
    expect(sessionBlocks[0].resourceId).toBeNull();
    expect(sessionBlocks[0].professionalId).toBe(3);
  });

  it("gera payload canónico para conflito de agenda", () => {
    const payload = agendaConflictResponse();
    expect(payload.ok).toBe(false);
    expect(typeof payload.errorCode).toBe("string");
    expect(payload.errorCode.length).toBeGreaterThan(0);
  });
});
