import { describe, expect, it } from "vitest";
import { jsonWrap } from "@/lib/api/wrapResponse";

const REQUEST_HEADERS = {
  "x-request-id": "req_test",
  "x-correlation-id": "corr_test",
};

describe("jsonWrap", () => {
  it("wraps plain payloads", async () => {
    const res = jsonWrap({ foo: "bar" }, { headers: REQUEST_HEADERS });
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      requestId: "req_test",
      correlationId: "corr_test",
      data: { foo: "bar" },
      result: { foo: "bar" },
    });
  });

  it("normalizes legacy ok=true shapes without data", async () => {
    const res = jsonWrap({ ok: true, items: [1, 2] }, { headers: REQUEST_HEADERS });
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      requestId: "req_test",
      correlationId: "corr_test",
      data: { items: [1, 2] },
      result: { items: [1, 2] },
      items: [1, 2],
    });
  });

  it("does not double-wrap v9 envelopes", async () => {
    const res = jsonWrap({ ok: false, error: { errorCode: "BAD", message: "bad" } }, { headers: REQUEST_HEADERS });
    const body = await res.json();
    expect(body).toEqual({
      ok: false,
      requestId: "req_test",
      correlationId: "corr_test",
      errorCode: "BAD",
      message: "bad",
      retryable: false,
      code: "BAD",
      error: "bad",
      errorDetail: { errorCode: "BAD", message: "bad" },
    });
  });

  it("wraps error shapes into v9 error", async () => {
    const res = jsonWrap({ error: "INVALID" }, { status: 400, headers: REQUEST_HEADERS });
    const body = await res.json();
    expect(body).toEqual({
      ok: false,
      requestId: "req_test",
      correlationId: "corr_test",
      errorCode: "INVALID",
      message: "INVALID",
      retryable: false,
      code: "INVALID",
      error: "INVALID",
    });
  });

  it("normalizes legacy success shape", async () => {
    const res = jsonWrap({ success: true, data: { value: 42 } }, { headers: REQUEST_HEADERS });
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      requestId: "req_test",
      correlationId: "corr_test",
      data: { value: 42 },
      result: { value: 42 },
    });
  });

  it("normalizes legacy failure shape", async () => {
    const res = jsonWrap({ success: false, error: "FORBIDDEN" }, { status: 403, headers: REQUEST_HEADERS });
    const body = await res.json();
    expect(body).toEqual({
      ok: false,
      requestId: "req_test",
      correlationId: "corr_test",
      errorCode: "FORBIDDEN",
      message: "FORBIDDEN",
      retryable: false,
      code: "FORBIDDEN",
      error: "FORBIDDEN",
    });
  });

  it("maps code/retryable/nextAction into v9 error", async () => {
    const res = jsonWrap(
      { ok: false, code: "PAYMENT_FAILED", error: "Falhou", status: "FAILED", retryable: true, nextAction: "PAY_NOW" },
      { status: 400, headers: REQUEST_HEADERS },
    );
    const body = await res.json();
    expect(body.errorCode).toBe("PAYMENT_FAILED");
    expect(body.message).toBe("Falhou");
    expect(body.retryable).toBe(true);
    expect(body.nextAction).toBe("PAY_NOW");
    expect(body.details).toEqual({ status: "FAILED" });
    expect(body.data).toEqual({ status: "FAILED" });
    expect(body.status).toBe("FAILED");
    expect(body.requestId).toBe("req_test");
    expect(body.correlationId).toBe("corr_test");
  });
});
