import { beforeEach, describe, expect, it, vi } from "vitest";

const telemetryDelegates = vi.hoisted(() => ({
  telemetryFunnelDefinition: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  telemetryFunnelResult: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    upsert: vi.fn(),
  },
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    telemetryFunnelDefinition: telemetryDelegates.telemetryFunnelDefinition,
    telemetryFunnelResult: telemetryDelegates.telemetryFunnelResult,
    $queryRaw: telemetryDelegates.queryRaw,
  },
}));

vi.mock("@/lib/appEnv", () => ({
  getAppEnv: vi.fn(() => "test"),
}));

vi.mock("@/lib/observability/logger", () => ({
  logError: vi.fn(),
}));

import {
  listTelemetryFunnelDefinitions,
  recomputeTelemetryFunnelResults,
} from "@/domain/telemetry/funnels";

describe("telemetry funnels", () => {
  beforeEach(() => {
    telemetryDelegates.telemetryFunnelDefinition.findMany.mockReset();
    telemetryDelegates.telemetryFunnelDefinition.findUnique.mockReset();
    telemetryDelegates.telemetryFunnelDefinition.create.mockReset();
    telemetryDelegates.telemetryFunnelDefinition.update.mockReset();
    telemetryDelegates.telemetryFunnelResult.findMany.mockReset();
    telemetryDelegates.telemetryFunnelResult.deleteMany.mockReset();
    telemetryDelegates.telemetryFunnelResult.upsert.mockReset();
    telemetryDelegates.queryRaw.mockReset();

    telemetryDelegates.telemetryFunnelResult.deleteMany.mockResolvedValue({ count: 0 });
    telemetryDelegates.telemetryFunnelResult.upsert.mockResolvedValue({});
  });

  it("filtra definições pelo env activo", async () => {
    telemetryDelegates.telemetryFunnelDefinition.findMany.mockResolvedValue([
      {
        id: "funnel-test",
        organizationId: 7,
        name: "Funil Teste",
        description: null,
        steps: [
          { key: "start", eventName: "checkout.flow.started", required: true, withinMinutes: null },
          {
            key: "paid",
            eventName: "checkout.payment.succeeded",
            required: true,
            withinMinutes: 30,
          },
        ],
        isActive: true,
        createdByUserId: null,
        createdAt: new Date("2026-02-27T10:00:00.000Z"),
        updatedAt: new Date("2026-02-27T10:00:00.000Z"),
        env: "test",
      },
      {
        id: "funnel-prod",
        organizationId: 7,
        name: "Funil Prod",
        description: null,
        steps: [
          { key: "start", eventName: "checkout.flow.started", required: true, withinMinutes: null },
          {
            key: "paid",
            eventName: "checkout.payment.succeeded",
            required: true,
            withinMinutes: 30,
          },
        ],
        isActive: true,
        createdByUserId: null,
        createdAt: new Date("2026-02-27T10:00:00.000Z"),
        updatedAt: new Date("2026-02-27T10:00:00.000Z"),
        env: "prod",
      },
    ]);

    const definitions = await listTelemetryFunnelDefinitions({
      organizationId: 7,
      includeGlobal: true,
      activeOnly: true,
    });

    expect(definitions).toHaveLength(1);
    expect(definitions[0]?.id).toBe("funnel-test");
  });

  it("recomputa resultados por organização e bucket", async () => {
    const from = new Date("2026-02-27T10:00:00.000Z");
    const to = new Date("2026-02-27T11:00:00.000Z");

    telemetryDelegates.queryRaw.mockResolvedValueOnce([
        {
          event_name: "checkout.flow.started",
          occurred_at: new Date("2026-02-27T10:00:01.000Z"),
          actor_key: "actor:a",
          actor_user_id: null,
          session_id: null,
        },
        {
          event_name: "checkout.payment.succeeded",
          occurred_at: new Date("2026-02-27T10:10:00.000Z"),
          actor_key: "actor:a",
          actor_user_id: null,
          session_id: null,
        },
        {
          event_name: "checkout.flow.started",
          occurred_at: new Date("2026-02-27T10:02:00.000Z"),
          actor_key: "actor:b",
          actor_user_id: null,
          session_id: null,
        },
        {
          event_name: "checkout.flow.started",
          occurred_at: new Date("2026-02-27T10:03:00.000Z"),
          actor_key: "actor:c",
          actor_user_id: null,
          session_id: null,
        },
        {
          event_name: "checkout.payment.succeeded",
          occurred_at: new Date("2026-02-27T10:50:00.000Z"),
          actor_key: "actor:c",
          actor_user_id: null,
          session_id: null,
        },
      ]);

    telemetryDelegates.telemetryFunnelDefinition.findMany.mockResolvedValue([
      {
        id: "funnel-1",
        organizationId: 7,
        name: "Checkout",
        description: null,
        steps: [
          { key: "start", eventName: "checkout.flow.started", required: true, withinMinutes: null },
          {
            key: "paid",
            eventName: "checkout.payment.succeeded",
            required: true,
            withinMinutes: 30,
          },
        ],
        isActive: true,
        createdByUserId: null,
        createdAt: new Date("2026-02-27T10:00:00.000Z"),
        updatedAt: new Date("2026-02-27T10:00:00.000Z"),
        env: "test",
      },
    ]);
    telemetryDelegates.telemetryFunnelResult.deleteMany.mockResolvedValue({ count: 2 });
    telemetryDelegates.telemetryFunnelResult.upsert.mockResolvedValue({});

    const result = await recomputeTelemetryFunnelResults({
      from,
      to,
      bucketUnit: "HOUR",
      organizationId: 7,
    });

    expect(telemetryDelegates.queryRaw).toHaveBeenCalledTimes(1);
    expect(result.errors).toBe(0);
    expect(telemetryDelegates.telemetryFunnelResult.deleteMany).toHaveBeenCalledTimes(1);
    expect(telemetryDelegates.telemetryFunnelResult.upsert).toHaveBeenCalledTimes(2);

    const [firstUpsert, secondUpsert] = telemetryDelegates.telemetryFunnelResult.upsert.mock.calls.map(
      (entry) => entry[0],
    );

    expect(firstUpsert.create.stepKey).toBe("start");
    expect(firstUpsert.create.enteredCount).toBe(3);
    expect(firstUpsert.create.convertedCount).toBe(1);
    expect(firstUpsert.create.conversionRateBps).toBe(3333);

    expect(secondUpsert.create.stepKey).toBe("paid");
    expect(secondUpsert.create.enteredCount).toBe(1);
    expect(secondUpsert.create.convertedCount).toBe(1);
    expect(secondUpsert.create.conversionRateBps).toBe(10000);

    expect(result.organizations).toBe(1);
    expect(result.funnels).toBe(1);
    expect(result.buckets).toBe(1);
    expect(result.rowsDeleted).toBe(2);
    expect(result.rowsWritten).toBe(2);
    expect(result.errors).toBe(0);
  });
});
