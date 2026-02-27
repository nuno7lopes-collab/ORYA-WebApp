import { describe, expect, it } from "vitest";
import {
  EVENT_OPERATIONAL_STATUSES,
  EVENT_TERMINAL_STATUSES,
  hasEventEndedByDate,
  isEventCancelledStatus,
  isEventOperationalStatus,
  isEventTerminalStatus,
  resolveEventOperationalBlockReason,
} from "@/domain/events/lifecycle";

describe("event lifecycle status policy", () => {
  it("define estados operacionais sem FINISHED", () => {
    expect(EVENT_OPERATIONAL_STATUSES).toEqual(["PUBLISHED", "DATE_CHANGED"]);
    expect(EVENT_OPERATIONAL_STATUSES).not.toContain("FINISHED");
  });

  it("define estados terminais", () => {
    expect(EVENT_TERMINAL_STATUSES).toEqual(["CANCELLED", "FINISHED"]);
    expect(isEventTerminalStatus("FINISHED")).toBe(true);
    expect(isEventTerminalStatus("CANCELLED")).toBe(true);
    expect(isEventTerminalStatus("PUBLISHED")).toBe(false);
  });

  it("resolve estado cancelado como motivo terminal específico", () => {
    expect(isEventCancelledStatus("cancelled")).toBe(true);
    expect(
      resolveEventOperationalBlockReason({
        status: "CANCELLED",
        isDeleted: false,
        endsAt: null,
      }),
    ).toBe("EVENT_CANCELLED");
  });

  it("resolve fecho operacional quando estado não está ativo ou data já passou", () => {
    const now = new Date("2026-02-27T10:00:00.000Z");
    expect(
      resolveEventOperationalBlockReason({
        status: "FINISHED",
        isDeleted: false,
        endsAt: null,
        now,
      }),
    ).toBe("EVENT_CLOSED");
    expect(
      resolveEventOperationalBlockReason({
        status: "PUBLISHED",
        isDeleted: false,
        endsAt: "2026-02-27T09:00:00.000Z",
        now,
      }),
    ).toBe("EVENT_CLOSED");
  });

  it("mantém evento operacional quando publicado e em janela", () => {
    const now = new Date("2026-02-27T10:00:00.000Z");
    expect(isEventOperationalStatus("DATE_CHANGED")).toBe(true);
    expect(
      resolveEventOperationalBlockReason({
        status: "PUBLISHED",
        isDeleted: false,
        endsAt: "2026-02-27T11:00:00.000Z",
        now,
      }),
    ).toBeNull();
    expect(hasEventEndedByDate("2026-02-27T11:00:00.000Z", now)).toBe(false);
  });
});
