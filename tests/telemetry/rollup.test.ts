import { beforeEach, describe, expect, it, vi } from "vitest";

const telemetryMetricRollup = vi.hoisted(() => ({
  upsert: vi.fn(),
}));
const queryRaw = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    telemetryMetricRollup,
    $queryRaw: queryRaw,
  },
}));

vi.mock("@/lib/appEnv", () => ({
  getAppEnv: vi.fn(() => "test"),
}));

import { recomputeTelemetryMetricRollups } from "@/domain/telemetry/rollup";

describe("telemetry rollup", () => {
  beforeEach(() => {
    telemetryMetricRollup.upsert.mockReset();
    queryRaw.mockReset();
    telemetryMetricRollup.upsert.mockResolvedValue({});
  });

  it("grava rollups globais e por dimensão", async () => {
    queryRaw
      .mockResolvedValueOnce([
        {
          organization_id: 7,
          bucket_start: new Date("2026-02-26T10:00:00.000Z"),
          dimension_value: "ALL",
          event_count: 15,
          error_count: 4,
          unique_actors: 11,
        },
      ])
      .mockResolvedValueOnce([
        {
          organization_id: 7,
          bucket_start: new Date("2026-02-26T10:00:00.000Z"),
          dimension_value: "checkout_payment_failed",
          event_count: 6,
          error_count: 4,
          unique_actors: 5,
        },
      ])
      .mockResolvedValueOnce([
        {
          organization_id: 7,
          bucket_start: new Date("2026-02-26T10:00:00.000Z"),
          dimension_value: "API",
          event_count: 10,
          error_count: 3,
        },
      ])
      .mockResolvedValueOnce([
        {
          organization_id: 7,
          bucket_start: new Date("2026-02-26T10:00:00.000Z"),
          dimension_value: "USER",
          event_count: 8,
          error_count: 2,
        },
      ]);

    const result = await recomputeTelemetryMetricRollups({
      from: new Date("2026-02-26T10:00:00.000Z"),
      to: new Date("2026-02-26T11:00:00.000Z"),
      bucketUnit: "HOUR",
      organizationId: 7,
    });

    expect(queryRaw).toHaveBeenCalledTimes(4);
    expect(result.rows.totalRows).toBe(1);
    expect(result.rows.eventRows).toBe(1);
    expect(result.rows.sourceRows).toBe(1);
    expect(result.rows.actorRows).toBe(1);

    const calls = telemetryMetricRollup.upsert.mock.calls.map((entry) => entry[0]);
    const globalCalls = calls.filter((entry) => entry.create.dimensionKey === "GLOBAL");
    expect(globalCalls).toHaveLength(3);
    expect(globalCalls.map((entry) => entry.create.metricKey).sort()).toEqual([
      "ERROR_COUNT",
      "EVENT_COUNT",
      "UNIQUE_ACTORS",
    ]);
    expect(result.written).toBe(10);
  });
});
