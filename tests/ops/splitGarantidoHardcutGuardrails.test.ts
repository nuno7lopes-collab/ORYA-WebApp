import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("split garantido hard-cut guardrails", () => {
  it("rejects legacy split mode with 410 in setup and checkout routes", () => {
    const meSplit = readLocal("app/api/me/reservas/[id]/split/route.ts");
    const orgSplit = readLocal("app/api/org/[orgId]/reservas/[id]/split/route.ts");
    const inviteCheckout = readLocal("app/api/convites/[token]/checkout/route.ts");

    for (const content of [meSplit, orgSplit, inviteCheckout]) {
      expect(content).toContain("LEGACY_SPLIT_MODE_REMOVED");
      expect(content).toContain("SPLIT_GARANTIDO");
      expect(content).toContain("410");
    }

    expect(inviteCheckout).toContain("SPLIT_PAYMENT_METHOD_NOT_ALLOWED");
    expect(inviteCheckout).toContain('payment_method_types: ["card"]');
  });

  it("keeps runtime cron guard for split garantido transitions", () => {
    const cronRoute = readLocal("app/api/cron/bookings/split-garantido/route.ts");
    const splitRuntime = readLocal("domain/bookings/splitGarantido.ts");
    const workerRoute = readLocal("app/api/internal/worker/operations/route.ts");

    expect(cronRoute).toContain("settleBookingSplitRuntime");
    expect(cronRoute).toContain("BOOKING_SPLIT_OFFSESSION_CHARGE");
    expect(cronRoute).toContain("settle_job_missed_deadlineAt");
    expect(cronRoute).toContain("debt_open_rate_spike");
    expect(cronRoute).toContain("enforceSplitHoldCoverage");
    expect(cronRoute).toContain("split_guarantee_lost");
    expect(splitRuntime).toContain("HOLD_CAPTURE");
    expect(splitRuntime).toContain("OFFSESSION_PI");
    expect(splitRuntime).toContain("DEBT");
    expect(splitRuntime).toContain("BookingSplitHoldAttemptStatus");
    expect(splitRuntime).toContain("BookingSplitShareAttemptStatus");
    expect(splitRuntime).toContain("enforceSplitHoldCoverage");
    expect(splitRuntime).toContain("resolveNextBookingSplitOffsessionAttempt");
    expect(workerRoute).toContain("processBookingSplitOffsessionCharge");
    expect(workerRoute).toContain('from "@/domain/bookings/splitGarantido"');
    expect(workerRoute).toContain("BOOKING_SPLIT_OFFSESSION_MAX_ATTEMPTS");
  });

  it("keeps canonical offsession schema + migration for split runtime", () => {
    const schema = readLocal("prisma/schema.prisma");
    const migration = readLocal("prisma/migrations/20260216043000_split_offsession_attempts_runtime/migration.sql");

    expect(schema).toContain("offsessionPaymentMethodId");
    expect(schema).toContain("offsessionCustomerId");
    expect(schema).toContain("activeShareAttemptId");
    expect(schema).toContain("model BookingSplitShareAttempt");
    expect(schema).toContain("model BookingSplitHoldAttempt");
    expect(schema).toContain("enum BookingSplitCancelReason");
    expect(schema).toContain("model BookingSplitOffsessionAttempt");
    expect(schema).toContain("enum BookingSplitOffsessionAttemptStatus");
    expect(migration).toContain("booking_split_offsession_attempts");
    expect(migration).toContain("WHERE status = 'OPEN'");
  });
});
