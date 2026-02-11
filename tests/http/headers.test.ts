import { describe, expect, it } from "vitest";
import { buildResponseHeaders, getRequestContext } from "@/lib/http/requestContext";
import { respondPlainText } from "@/lib/http/envelope";

describe("response headers", () => {
  it("buildResponseHeaders sets canonical request/correlation/org headers", () => {
    const headers = buildResponseHeaders({ requestId: "req_123", correlationId: "corr_456", orgId: 42 });

    expect(headers.get("x-request-id")).toBe("req_123");
    expect(headers.get("x-orya-request-id")).toBe("req_123");
    expect(headers.get("x-correlation-id")).toBe("corr_456");
    expect(headers.get("x-orya-correlation-id")).toBe("corr_456");
    expect(headers.get("x-orya-org-id")).toBe("42");
  });

  it("getRequestContext prefers x-orya-* headers over x-*", () => {
    const headers = new Headers({
      "x-request-id": "req_fallback",
      "x-orya-request-id": "req_primary",
      "x-correlation-id": "corr_fallback",
      "x-orya-correlation-id": "corr_primary",
      "x-orya-org-id": "7",
    });
    const ctx = getRequestContext({ headers });

    expect(ctx.requestId).toBe("req_primary");
    expect(ctx.correlationId).toBe("corr_primary");
    expect(ctx.orgId).toBe(7);
  });

  it("getRequestContext falls back to x-request-id when x-orya-request-id is missing", () => {
    const headers = new Headers({
      "x-request-id": "req_only",
    });
    const ctx = getRequestContext({ headers });

    expect(ctx.requestId).toBe("req_only");
    expect(ctx.correlationId).toBe("req_only");
  });

  it("getRequestContext prefers explicit orgId option over header", () => {
    const headers = new Headers({ "x-orya-org-id": "5" });
    const ctx = getRequestContext({ headers }, { orgId: 12 });

    expect(ctx.orgId).toBe(12);
  });

  it("respondPlainText preserves custom Content-Type and adds canonical headers", () => {
    const res = respondPlainText(
      { requestId: "req_text", correlationId: "corr_text", orgId: null },
      "OK",
      { headers: { "Content-Type": "text/calendar; charset=utf-8" } },
    );

    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("x-request-id")).toBe("req_text");
    expect(res.headers.get("x-orya-request-id")).toBe("req_text");
    expect(res.headers.get("x-correlation-id")).toBe("corr_text");
    expect(res.headers.get("x-orya-correlation-id")).toBe("corr_text");
  });

  it("respondPlainText injects Content-Type when missing", () => {
    const res = respondPlainText(
      { requestId: "req_default", correlationId: "corr_default", orgId: null },
      "OK",
    );

    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  });
});
