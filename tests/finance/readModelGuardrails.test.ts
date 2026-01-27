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

describe("finance read-model guardrails", () => {
  it("blocks direct SaleSummary/SaleLine/PaymentEvent writes outside finance consumer", () => {
    assertNoMatches(
      [
        "rg -n",
        "\"saleSummary\\\\.(create|update|upsert|delete|deleteMany)|saleLine\\\\.(create|deleteMany)|paymentEvent\\\\.(create|update|upsert|updateMany|deleteMany)\"",
        "app domain lib -S",
        "-g '!domain/finance/readModelConsumer.ts'",
      ].join(" "),
      "Direct read-model writes",
    );
  });

  it("keeps ledger append-only (no update/delete)", () => {
    assertNoMatches(
      ["rg -n", "\"ledgerEntry\\\\.(update|delete|deleteMany)\"", "app domain lib -S"].join(" "),
      "LedgerEntry update/delete",
    );
  });

  it("blocks direct EventLog writes outside append", () => {
    assertNoMatches(
      [
        "rg -n",
        "\"EventLog\\\\.(create|createMany)|eventLog\\\\.(create|createMany)\"",
        "app domain lib -S",
        "-g '!domain/eventLog/append.ts'",
      ].join(" "),
      "Direct EventLog writes",
    );
  });

  it("blocks direct OutboxEvent writes outside producer", () => {
    assertNoMatches(
      [
        "rg -n",
        "\"OutboxEvent\\\\.create|outboxEvent\\\\.create\"",
        "app domain lib -S",
        "-g '!domain/outbox/producer.ts'",
      ].join(" "),
      "Direct OutboxEvent writes",
    );
  });

  it("blocks direct Stripe PaymentIntent creation outside gateway", () => {
    assertNoMatches(
      [
        "rg -n",
        "\"stripe\\\\.paymentIntents\\\\.create\"",
        "app lib domain -S",
        "-g '!domain/finance/gateway/stripeGateway.ts'",
      ].join(" "),
      "Direct Stripe PaymentIntent create",
    );
  });

  it("blocks Date.now purchaseId in checkout entrypoints", () => {
    assertNoMatches(
      [
        "rg -n",
        "\"purchaseId\\\\s*=.*Date\\\\.now\\\\(\"",
        "app/api/servicos/[id]/checkout/route.ts",
        "app/api/servicos/[id]/creditos/checkout/route.ts",
        "app/api/organizacao/reservas/[id]/checkout/route.ts",
        "app/api/store/checkout/route.ts",
        "domain/padelSecondCharge.ts",
        "-S",
      ].join(" "),
      "Date.now purchaseId",
    );
  });
});
