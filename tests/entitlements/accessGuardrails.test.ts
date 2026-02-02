import { describe, it } from "vitest";
import { execSync } from "child_process";

function assertNoMatches(command: string, label: string) {
  try {
    execSync(command, { stdio: "pipe" });
    throw new Error(`${label} found matches`);
  } catch (err: any) {
    if (typeof err?.status === "number" && err.status === 1) {
      return;
    }
    const output = err?.stdout ? String(err.stdout) : "";
    const stderr = err?.stderr ? String(err.stderr) : "";
    throw new Error(`${label} check failed\n${output}${stderr}`);
  }
}

describe("access entitlement guardrails", () => {
  it("blocks entitlement writes outside canonical modules", () => {
    assertNoMatches(
      [
        "rg -n",
        "\"entitlement\\\\.(create|update|upsert|updateMany|delete|deleteMany)\"",
        "app domain lib -S",
        "-g '!domain/finance/fulfillment.ts'",
        "-g '!domain/finance/outbox.ts'",
        "-g '!lib/operations/fulfillPaid.ts'",
        "-g '!lib/operations/fulfillPadelSplit.ts'",
        "-g '!lib/operations/fulfillPadelFull.ts'",
        "-g '!lib/operations/fulfillPadelRegistration.ts'",
        "-g '!lib/operations/fulfillStoreOrder.ts'",
        "-g '!lib/operations/fulfillResale.ts'",
        "-g '!lib/operations/fulfillServiceBooking.ts'",
        "-g '!app/api/stripe/webhook/route.ts'",
        "-g '!app/api/internal/worker/operations/route.ts'",
        "-g '!app/api/organizacao/events/[[]id[]]/refund/route.ts'",
        "-g '!app/api/admin/eventos/purge/route.ts'",
      ].join(" "),
      "Entitlement writes outside canonical modules",
    );
  });

  it("blocks ticket-status access gates in padel pairings", () => {
    assertNoMatches(
      ["rg -n", "\"ticket\\\\.status\"", "app/api/padel/pairings/route.ts -S"].join(" "),
      "Ticket status access gates",
    );
  });
});
