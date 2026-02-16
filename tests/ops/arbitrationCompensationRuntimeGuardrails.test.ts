import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("arbitration compensation runtime guardrails", () => {
  it("keeps canonical arbitration metrics and compensation operation wiring", () => {
    const commitRoute = readLocal("app/api/padel/calendar/claims/commit/route.ts");
    const workerRoute = readLocal("app/api/internal/worker/operations/route.ts");
    const workerTypes = readLocal("app/api/internal/worker/types.ts");

    expect(commitRoute).toContain("AGENDA_ARBITRATION_COMPENSATION_OPERATION");
    expect(commitRoute).toContain("arbitration.decision.latency_ms");
    expect(commitRoute).toContain("arbitration.override.rate");
    expect(commitRoute).toContain("arbitration.compensation.failed_rate");
    expect(commitRoute).toContain("arbitration.conflicts.by_resourceKey");
    expect(commitRoute).toContain("arbitration.decision_count");
    expect(commitRoute).toContain("arbitration.decision_latency_ms");

    expect(workerTypes).toContain("AGENDA_ARBITRATION_COMPENSATION");
    expect(workerRoute).toContain("processAgendaArbitrationCompensation");
    expect(workerRoute).toContain("AGENDA_ARBITRATION_COMPENSATION_PAYLOAD_INVALID");
    expect(workerRoute).toContain("arbitration.compensation.failed_rate");
  });

  it("keeps canonical schema+migration for arbitration compensation", () => {
    const schema = readLocal("prisma/schema.prisma");
    const migration = readLocal(
      "prisma/migrations/20260216070000_agenda_arbitration_compensation_runtime/migration.sql",
    );

    expect(schema).toContain("AgendaArbitrationCompensationStatus");
    expect(schema).toContain("AgendaArbitrationCompensationAttemptStatus");
    expect(schema).toContain("model AgendaArbitrationCompensationAttempt");
    expect(schema).toMatch(/compensationStatus\s+AgendaArbitrationCompensationStatus\?/);

    expect(migration).toContain("agenda_arbitration_compensation_attempts");
    expect(migration).toContain("AgendaArbitrationCompensationStatus");
    expect(migration).toContain("AgendaArbitrationCompensationAttemptStatus");
  });

  it("keeps cron scheduler for arbitration compensation retries", () => {
    const cronRoute = readLocal("app/api/cron/padel/arbitration-compensation/route.ts");
    const cronJobs = readLocal("lib/cron/jobs.ts");
    const cronLoop = readLocal("scripts/cron-loop.js");

    expect(cronRoute).toContain("AGENDA_ARBITRATION_COMPENSATION");
    expect(cronRoute).toContain("agenda_arbitration_comp:");
    expect(cronRoute).toContain("AGENDA_ARBITRATION_COMP_SCHEDULE_MS");
    expect(cronRoute).toContain("padel-arbitration-compensation");
    expect(cronJobs).toContain("padel-arbitration-compensation");
    expect(cronJobs).toContain("/api/cron/padel/arbitration-compensation");
    expect(cronLoop).toContain("padel-arbitration-compensation");
    expect(cronLoop).toContain("/api/cron/padel/arbitration-compensation");
  });
});
