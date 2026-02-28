import { afterEach, describe, expect, it } from "vitest";

import {
  clearOutboxHandlerRegistry,
  defaultUnknownHandler,
  isUnknownOutboxDeadLetterEnabled,
  registerOutboxHandler,
  resolveOutboxHandler,
} from "@/domain/outbox/handlerRegistry";

describe("outbox handler registry", () => {
  afterEach(() => {
    clearOutboxHandlerRegistry();
    delete process.env.OUTBOX_UNKNOWN_DEFAULT_HANDLER_ENABLED;
  });

  it("regista e resolve handlers por eventType", async () => {
    registerOutboxHandler("custom.event", async () => ({ action: "SKIP" }));
    const handler = resolveOutboxHandler("custom.event");
    expect(handler).toBeTypeOf("function");
    const decision = await handler?.({
      eventId: "evt-1",
      eventType: "custom.event",
      payload: {},
      createdAt: new Date("2026-02-01T00:00:00Z"),
      causationId: null,
      correlationId: null,
    });
    expect(decision).toEqual({ action: "SKIP" });
  });

  it("defaultUnknownHandler devolve DEAD_LETTER e resolve organizationId do payload", async () => {
    const decision = await defaultUnknownHandler({
      eventId: "evt-unknown",
      eventType: "org.context.changed",
      payload: {
        toOrganizationId: 42,
        fromOrganizationId: 10,
      },
      createdAt: new Date("2026-02-01T00:00:00Z"),
      causationId: null,
      correlationId: "corr-1",
    });

    expect(decision.action).toBe("DEAD_LETTER");
    if (decision.action === "DEAD_LETTER") {
      expect(decision.reasonCode).toBe("UNKNOWN_EVENT_TYPE");
      expect(decision.errorClass).toBe("OutboxUnsupportedEvent");
      expect(decision.eventLogOrganizationId).toBe(42);
    }
  });

  it("feature flag aceita rollback para comportamento legado", () => {
    process.env.OUTBOX_UNKNOWN_DEFAULT_HANDLER_ENABLED = "false";
    expect(isUnknownOutboxDeadLetterEnabled()).toBe(false);
    process.env.OUTBOX_UNKNOWN_DEFAULT_HANDLER_ENABLED = "true";
    expect(isUnknownOutboxDeadLetterEnabled()).toBe(true);
  });
});
