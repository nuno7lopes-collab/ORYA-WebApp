import { describe, expect, it } from "vitest";
import { sanitizeTelemetryPayload } from "@/domain/telemetry/redaction";

describe("telemetry redaction", () => {
  it("redige campos sensíveis e mantém estrutura", () => {
    const output = sanitizeTelemetryPayload({
      email: "user@orya.pt",
      nested: {
        token: "abc",
        safe: 42,
      },
      list: [{ phone: "+351999" }, { ok: true }],
    });

    expect(output.email).toBe("[REDACTED]");
    expect((output.nested as Record<string, unknown>).token).toBe("[REDACTED]");
    expect((output.nested as Record<string, unknown>).safe).toBe(42);

    const list = output.list as Array<Record<string, unknown>>;
    expect(list[0].phone).toBe("[REDACTED]");
    expect(list[1].ok).toBe(true);
  });

  it("transforma valores não-objeto num envelope estável", () => {
    const output = sanitizeTelemetryPayload("hello");
    expect(output).toEqual({ value: "hello" });
  });
});
