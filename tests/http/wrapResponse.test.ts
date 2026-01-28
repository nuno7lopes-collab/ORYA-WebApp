import { describe, expect, it } from "vitest";
import { jsonWrap } from "@/lib/api/wrapResponse";

describe("jsonWrap", () => {
  it("wraps plain payloads", async () => {
    const res = jsonWrap({ foo: "bar" });
    const body = await res.json();
    expect(body).toEqual({ ok: true, result: { foo: "bar" } });
  });

  it("normalizes legacy ok=true shapes without data", async () => {
    const res = jsonWrap({ ok: true, items: [1, 2] });
    const body = await res.json();
    expect(body).toEqual({ ok: true, result: { items: [1, 2] } });
  });

  it("does not double-wrap v9 envelopes", async () => {
    const res = jsonWrap({ ok: false, error: { errorCode: "BAD", message: "bad" } });
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: { errorCode: "BAD", message: "bad" } });
  });

  it("wraps error shapes into v9 error", async () => {
    const res = jsonWrap({ error: "INVALID" }, { status: 400 });
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: { errorCode: "INVALID", message: "INVALID" } });
  });

  it("normalizes legacy success shape", async () => {
    const res = jsonWrap({ success: true, data: { value: 42 } });
    const body = await res.json();
    expect(body).toEqual({ ok: true, result: { value: 42 } });
  });

  it("normalizes legacy failure shape", async () => {
    const res = jsonWrap({ success: false, error: "FORBIDDEN" }, { status: 403 });
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: { errorCode: "FORBIDDEN", message: "FORBIDDEN" } });
  });

  it("maps code/retryable/nextAction into v9 error", async () => {
    const res = jsonWrap(
      { ok: false, code: "PAYMENT_FAILED", error: "Falhou", status: "FAILED", retryable: true, nextAction: "PAY_NOW" },
      { status: 400 },
    );
    const body = await res.json();
    expect(body.error.errorCode).toBe("PAYMENT_FAILED");
    expect(body.error.message).toBe("Falhou");
    expect(body.error.retryable).toBe(true);
    expect(body.error.nextAction).toBe("PAY_NOW");
    expect(body.error.details).toEqual({ status: "FAILED" });
  });
});
