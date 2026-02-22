import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("GET /api/padel/ops/summary observabilidade", () => {
  it("expõe métricas operacionais de auto-schedule/reminders/live-stream", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/api/padel/ops/summary/route.ts"),
      "utf8",
    );

    expect(source).toContain("autoScheduleBlockedByClassSessionCount");
    expect(source).toContain("autoScheduleSkippedByBookingCount");
    expect(source).toContain("matchStartingSoonSentCount");
    expect(source).toContain("publicLivePayloadStreamCoverage");
    expect(source).toContain("scheduleWriteGatewayDecisionLatencyMs");
    expect(source).toContain("calendarConflictPreflightMismatchCount");
  });

  it("inclui alerta AUTO_SCHEDULE_INFEASIBLE_SPIKE com baseline horária", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/api/padel/ops/summary/route.ts"),
      "utf8",
    );

    expect(source).toContain("autoScheduleInfeasibleLastHourCount");
    expect(source).toContain("autoScheduleInfeasibleBaselinePerHour");
    expect(source).toContain("autoScheduleInfeasibleSpikeThreshold");
    expect(source).toContain("AUTO_SCHEDULE_INFEASIBLE_SPIKE");
  });
});
