import { beforeEach, describe, expect, it, vi } from "vitest";

const telemetryDelegates = vi.hoisted(() => ({
  telemetryEvent: {
    create: vi.fn(),
  },
  telemetryIngestError: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    telemetryEvent: telemetryDelegates.telemetryEvent,
    telemetryIngestError: telemetryDelegates.telemetryIngestError,
  },
}));

vi.mock("@/lib/observability/logger", () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

import {
  ingestTelemetryEvent,
  normalizeTelemetryBatchInput,
} from "@/domain/telemetry/ingest";

const defaults = {
  requestId: "req-1",
  correlationId: "corr-1",
  defaultSourceType: "WEB",
  defaultActorType: "ANONYMOUS",
};

describe("telemetry ingest", () => {
  beforeEach(() => {
    telemetryDelegates.telemetryEvent.create.mockReset();
    telemetryDelegates.telemetryIngestError.create.mockReset();
  });

  it("rejeita evento com nome inválido e grava ingest error", async () => {
    const result = await ingestTelemetryEvent(
      {
        eventName: " ",
      },
      defaults,
    );

    expect(result.ok).toBe(false);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("INVALID_EVENT_NAME");
    expect(telemetryDelegates.telemetryIngestError.create).toHaveBeenCalledTimes(1);
    expect(telemetryDelegates.telemetryEvent.create).not.toHaveBeenCalled();
  });

  it("sanitiza payload sensível antes de persistir", async () => {
    telemetryDelegates.telemetryEvent.create.mockResolvedValue({ id: "evt-1" });

    const result = await ingestTelemetryEvent(
      {
        eventName: "checkout_started",
        payload: {
          email: "cliente@orya.pt",
          nested: { token: "secret" },
          ok: true,
        },
      },
      defaults,
    );

    expect(result.ok).toBe(true);
    expect(result.accepted).toBe(true);
    expect(result.duplicate).toBe(false);

    const createArg = telemetryDelegates.telemetryEvent.create.mock.calls[0]?.[0] as {
      data: { eventName: string; payload: Record<string, unknown> };
    };
    expect(createArg.data.eventName).toBe("checkout.flow.started");
    expect(createArg.data.payload.email).toBe("[REDACTED]");
    expect((createArg.data.payload.nested as Record<string, unknown>).token).toBe("[REDACTED]");
    expect(createArg.data.payload.ok).toBe(true);
  });

  it("trata conflito de idempotência como duplicado", async () => {
    telemetryDelegates.telemetryEvent.create.mockRejectedValue({ code: "P2002" });

    const result = await ingestTelemetryEvent(
      {
        eventName: "checkout_started",
        idempotencyKey: "idemp-1",
      },
      defaults,
    );

    expect(result.ok).toBe(true);
    expect(result.accepted).toBe(true);
    expect(result.duplicate).toBe(true);
  });

  it("normaliza payload batch em formatos suportados", () => {
    const single = normalizeTelemetryBatchInput({ eventName: "a" });
    const wrapped = normalizeTelemetryBatchInput({ events: [{ eventName: "a" }, { eventName: "b" }] });
    const array = normalizeTelemetryBatchInput([{ eventName: "a" }, { eventName: "b" }]);

    expect(single).toHaveLength(1);
    expect(wrapped).toHaveLength(2);
    expect(array).toHaveLength(2);
  });

  it("rejeita evento fora do catálogo canónico", async () => {
    const result = await ingestTelemetryEvent(
      {
        eventName: "custom_unknown_event",
      },
      defaults,
    );

    expect(result.ok).toBe(false);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("UNKNOWN_EVENT_CONTRACT");
    expect(telemetryDelegates.telemetryIngestError.create).toHaveBeenCalledTimes(1);
  });

  it("rejeita versão fora do contrato", async () => {
    const result = await ingestTelemetryEvent(
      {
        eventName: "checkout_started",
        eventVersion: "2.0.0",
      },
      defaults,
    );

    expect(result.ok).toBe(false);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("INVALID_EVENT_VERSION");
    expect(telemetryDelegates.telemetryIngestError.create).toHaveBeenCalledTimes(1);
    expect(telemetryDelegates.telemetryEvent.create).not.toHaveBeenCalled();
  });
});
