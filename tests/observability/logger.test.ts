import { afterEach, describe, expect, it, vi } from "vitest";

import { logError, logInfo, logWarn } from "@/lib/observability/logger";

function parseConsoleLine(spy: ReturnType<typeof vi.spyOn>) {
  const firstCall = spy.mock.calls[0];
  expect(firstCall).toBeTruthy();
  const line = firstCall?.[0];
  expect(typeof line).toBe("string");
  return JSON.parse(String(line));
}

describe("observability logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emite logInfo em JSON com campos obrigatórios", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    logInfo(
      "test.scope",
      { requestId: "req-1", correlationId: "corr-1", action: "ping" },
      { fallbackToRequestContext: false },
    );

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const payload = parseConsoleLine(infoSpy);
    expect(payload).toMatchObject({
      level: "info",
      scope: "test.scope",
      requestId: "req-1",
      correlationId: "corr-1",
    });
    expect(typeof payload.ts).toBe("string");
    expect(payload.context).toMatchObject({ action: "ping" });
    expect(payload.error).toBeNull();
  });

  it("faz redaction de PII em contexto e erro", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logError(
      "test.error",
      new Error("boom"),
      {
        requestId: "req-2",
        correlationId: "corr-2",
        email: "user@example.com",
        token: "abc123",
        nested: { password: "secret", phone: "+351912345678" },
      },
      { fallbackToRequestContext: false },
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const payload = parseConsoleLine(errorSpy);
    expect(payload).toMatchObject({
      level: "error",
      scope: "test.error",
      requestId: "req-2",
      correlationId: "corr-2",
    });
    expect(payload.context.email).toBe("[REDACTED]");
    expect(payload.context.token).toBe("[REDACTED]");
    expect(payload.context.nested.password).toBe("[REDACTED]");
    expect(payload.context.nested.phone).toBe("[REDACTED]");
    expect(payload.error).toMatchObject({ name: "Error", message: "boom" });
  });

  it("emite warn sem erro e com contexto vazio", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logWarn("test.warn", undefined, { fallbackToRequestContext: false });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const payload = parseConsoleLine(warnSpy);
    expect(payload.level).toBe("warn");
    expect(payload.scope).toBe("test.warn");
    expect(payload.error).toBeNull();
    expect(payload.context).toEqual({});
  });
});
