import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http/requestContext", () => ({
  getRequestContext: () => ({ requestId: "req_test", correlationId: "corr_test" }),
  buildResponseHeaders: (_ctx: any, existing?: HeadersInit) => {
    const headers = new Headers(existing);
    headers.set("x-request-id", "req_test");
    headers.set("x-correlation-id", "corr_test");
    return headers;
  },
}));

import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

describe("withApiEnvelope", () => {
  it("does not double-wrap v9 envelopes", async () => {
    const handler = withApiEnvelope(async () => {
      return new Response(
        JSON.stringify({
          ok: false,
          error: { errorCode: "BAD_REQUEST", message: "bad" },
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    });

    const res = await handler(new Request("http://localhost/test"));
    const body = await res.json();

    expect(body).toMatchObject({
      ok: false,
      requestId: "req_test",
      correlationId: "corr_test",
      errorCode: "BAD_REQUEST",
      message: "bad",
      retryable: false,
      code: "BAD_REQUEST",
      error: "bad",
      errorDetail: { errorCode: "BAD_REQUEST", message: "bad" },
    });
    expect((body as any).data).toBeUndefined();
    expect(res.headers.get("x-request-id")).toBe("req_test");
    expect(res.headers.get("x-correlation-id")).toBe("corr_test");
  });

  it("preserves SSE responses", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: ping\n\n"));
        controller.close();
      },
    });

    const handler = withApiEnvelope(async () => {
      return new Response(stream, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    });

    const res = await handler(new Request("http://localhost/sse"));
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("x-request-id")).toBe("req_test");
    expect(res.headers.get("x-correlation-id")).toBe("corr_test");
  });

  it("preserves download responses", async () => {
    const handler = withApiEnvelope(async () => {
      return new Response("ICS", {
        status: 200,
        headers: {
          "content-type": "text/calendar",
          "content-disposition": "attachment; filename=invite.ics",
        },
      });
    });

    const res = await handler(new Request("http://localhost/ics"));
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("content-type")).toContain("text/calendar");
    expect(res.headers.get("x-request-id")).toBe("req_test");
    expect(res.headers.get("x-correlation-id")).toBe("corr_test");
    const body = await res.text();
    expect(body).toBe("ICS");
  });

  it("preserves raw non-JSON responses", async () => {
    const handler = withApiEnvelope(async () => {
      return new Response("raw-body", {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      });
    });

    const res = await handler(new Request("http://localhost/raw"));
    expect(res.headers.get("content-type")).toContain("application/octet-stream");
    expect(res.headers.get("x-request-id")).toBe("req_test");
    expect(res.headers.get("x-correlation-id")).toBe("corr_test");
    const body = await res.text();
    expect(body).toBe("raw-body");
  });
});
