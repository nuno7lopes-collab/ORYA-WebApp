import { describe, expect, it } from "vitest";
import { respondError, respondOk } from "@/lib/http/envelope";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

describe("http envelope contract", () => {
  it("includes requestId and correlationId in success responses", async () => {
    const ctx = { requestId: "req_test", correlationId: "corr_test" };
    const res = respondOk(ctx, { hello: "world" });
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      requestId: "req_test",
      correlationId: "corr_test",
      data: { hello: "world" },
    });
    expect(res.headers.get("x-orya-request-id")).toBe("req_test");
    expect(res.headers.get("x-orya-correlation-id")).toBe("corr_test");
    expect(res.headers.get("x-request-id")).toBe("req_test");
    expect(res.headers.get("x-correlation-id")).toBe("corr_test");
  });

  it("includes errorCode/message/retryable in error responses", async () => {
    const ctx = { requestId: "req_err", correlationId: "corr_err" };
    const res = respondError(
      ctx,
      { errorCode: "BAD_INPUT", message: "Dados invalidos.", retryable: false },
      { status: 400 },
    );
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("BAD_INPUT");
    expect(body.message).toBe("Dados invalidos.");
    expect(body.retryable).toBe(false);
    expect(body.requestId).toBe("req_err");
    expect(body.correlationId).toBe("corr_err");
  });
});

describe("p0 guardrails", () => {
  const p0Paths = [
    "app/api/payments/intent/route.ts",
    "app/api/checkout/status/route.ts",
    "app/api/store/checkout/route.ts",
    "app/api/store/checkout/prefill/route.ts",
    "app/api/servicos/[id]/checkout/route.ts",
    "app/api/servicos/[id]/creditos/checkout/route.ts",
    "app/api/organizacao/reservas/[id]/checkout/route.ts",
    "app/api/padel/pairings/[id]/checkout/route.ts",
    "app/api/admin/payments/refund/route.ts",
    "app/api/admin/payments/dispute/route.ts",
    "app/api/admin/payments/reprocess/route.ts",
    "app/api/admin/refunds/list/route.ts",
    "app/api/admin/refunds/retry/route.ts",
    "app/api/organizacao/refunds/list/route.ts",
    "app/api/organizacao/payouts/status/route.ts",
    "app/api/organizacao/payouts/list/route.ts",
    "app/api/organizacao/payouts/summary/route.ts",
    "app/api/organizacao/payouts/settings/route.ts",
    "app/api/organizacao/payouts/connect/route.ts",
    "app/api/organizacao/payouts/webhook/route.ts",
    "app/api/admin/payouts/list/route.ts",
    "app/api/admin/payouts/[id]/route.ts",
    "app/api/admin/payouts/[id]/block/route.ts",
    "app/api/admin/payouts/[id]/unblock/route.ts",
    "app/api/admin/payouts/[id]/cancel/route.ts",
    "app/api/admin/payouts/[id]/force-release/route.ts",
    "app/api/internal/reconcile/route.ts",
    "app/api/internal/outbox/dlq/route.ts",
    "app/api/internal/outbox/replay/route.ts",
    "app/api/internal/worker/operations/route.ts",
    "app/api/internal/reprocess/purchase/route.ts",
    "app/api/internal/reprocess/payment-intent/route.ts",
    "app/api/internal/reprocess/stripe-event/route.ts",
    "app/api/internal/checkout/timeline/route.ts",
    "app/api/internal/checkin/consume/route.ts",
    "app/api/cron/operations/route.ts",
    "app/api/cron/payouts/release/route.ts",
    "app/api/stripe/webhook/route.ts",
    "app/api/webhooks/stripe/route.ts",
  ];

  it("P0 endpoints cannot return raw NextResponse.json envelopes", () => {
    for (const relPath of p0Paths) {
      const file = readFileSync(resolve(process.cwd(), relPath), "utf8");
      expect(file).not.toContain("NextResponse.json(");
    }
  });

  it("plain text signature errors only allowed in webhook files", () => {
    const repo = readFileSync(resolve(process.cwd(), "app/api/stripe/webhook/route.ts"), "utf8") +
      readFileSync(resolve(process.cwd(), "app/api/organizacao/payouts/webhook/route.ts"), "utf8");
    expect(repo).toContain("respondPlainText");

    const allFiles = p0Paths.map((p) => readFileSync(resolve(process.cwd(), p), "utf8")).join("\n");
    expect(allFiles).not.toContain("new Response(\"Missing signature\"");
    expect(allFiles).not.toContain("new Response(\"Invalid signature\"");
  });
});
