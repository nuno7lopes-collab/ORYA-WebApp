import { describe, expect, it } from "vitest";
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

describe("finance read-model guardrails", () => {
  it("blocks direct SaleSummary/SaleLine/PaymentEvent writes outside finance consumer", () => {
    expect(() =>
      assertNoMatches(
        [
          "rg -n",
          "\"saleSummary\\\\.(create|update|upsert|delete|deleteMany)|saleLine\\\\.(create|deleteMany)|paymentEvent\\\\.(create|update|upsert|updateMany|deleteMany)\"",
          "app domain lib -S",
          "-g '!domain/finance/readModelConsumer.ts'",
          "-g '!lib/refunds/unifiedRefundCase.ts'",
        ].join(" "),
        "Direct read-model writes",
      ),
    ).not.toThrow();
  });

  it("keeps ledger append-only (no update/delete)", () => {
    expect(() =>
      assertNoMatches(
        ["rg -n", "\"ledgerEntry\\\\.(update|delete|deleteMany)\"", "app domain lib -S"].join(" "),
        "LedgerEntry update/delete",
      ),
    ).not.toThrow();
  });

  it("blocks direct EventLog writes outside append", () => {
    expect(() =>
      assertNoMatches(
        [
          "rg -n",
          "\"EventLog\\\\.(create|createMany)|eventLog\\\\.(create|createMany)\"",
          "app domain lib -S",
          "-g '!domain/eventLog/append.ts'",
        ].join(" "),
        "Direct EventLog writes",
      ),
    ).not.toThrow();
  });

  it("blocks direct OutboxEvent writes outside producer", () => {
    expect(() =>
      assertNoMatches(
        [
          "rg -n",
          "\"OutboxEvent\\\\.create|outboxEvent\\\\.create\"",
          "app domain lib -S",
          "-g '!domain/outbox/producer.ts'",
        ].join(" "),
        "Direct OutboxEvent writes",
      ),
    ).not.toThrow();
  });

  it("blocks direct Stripe PaymentIntent creation outside gateway", () => {
    expect(() =>
      assertNoMatches(
        [
          "rg -n",
          "\"stripe\\\\.paymentIntents\\\\.create\"",
          "app lib domain -S",
          "-g '!domain/finance/gateway/stripeGateway.ts'",
        ].join(" "),
        "Direct Stripe PaymentIntent create",
      ),
    ).not.toThrow();
  });

  it("blocks Date.now purchaseId in checkout entrypoints", () => {
    expect(() =>
      assertNoMatches(
        [
          "rg -n",
          "\"purchaseId\\\\s*=.*Date\\\\.now\\\\(\"",
          "app/api/servicos/[id]/checkout/route.ts",
          "app/api/org/[orgId]/reservas/[id]/checkout/route.ts",
          "domain/padelSecondCharge.ts",
          "-S",
        ].join(" "),
        "Date.now purchaseId",
      ),
    ).not.toThrow();
  });
});
