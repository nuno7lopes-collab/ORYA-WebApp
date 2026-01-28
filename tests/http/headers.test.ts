import { describe, expect, it } from "vitest";
import { buildResponseHeaders } from "@/lib/http/requestContext";
import { respondPlainText } from "@/lib/http/envelope";

describe("response headers", () => {
  it("buildResponseHeaders sets canonical request/correlation/org headers", () => {
    const headers = buildResponseHeaders({ requestId: "req_123", correlationId: "corr_456", orgId: 42 });

    expect(headers.get("x-request-id")).toBe("req_123");
    expect(headers.get("x-orya-request-id")).toBe("req_123");
    expect(headers.get("x-correlation-id")).toBe("corr_456");
    expect(headers.get("x-orya-correlation-id")).toBe("corr_456");
    expect(headers.get("x-org-id")).toBe("42");
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
