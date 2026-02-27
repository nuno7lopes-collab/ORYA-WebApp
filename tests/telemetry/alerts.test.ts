import { beforeEach, describe, expect, it, vi } from "vitest";

const telemetryAlertRule = vi.hoisted(() => ({
  findMany: vi.fn(),
}));
const telemetryAlertIncident = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));
const telemetryMetricRollup = vi.hoisted(() => ({
  findMany: vi.fn(),
}));
const queryRaw = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    telemetryAlertRule,
    telemetryAlertIncident,
    telemetryMetricRollup,
    $queryRaw: queryRaw,
  },
}));

vi.mock("@/lib/appEnv", () => ({
  getAppEnv: vi.fn(() => "test"),
}));

const now = new Date("2026-02-26T11:00:00.000Z");

function buildRuleRow() {
  return {
    id: "rule-1",
    organizationId: 7,
    name: "Erros API",
    description: null,
    metricKey: "ERROR_COUNT",
    dimensionKey: null,
    dimensionValue: null,
    comparisonOperator: "GTE",
    threshold: 3,
    windowMinutes: 15,
    cooldownMinutes: 30,
    severity: "WARN",
    isActive: true,
    createdByUserId: null,
    createdAt: now,
    updatedAt: now,
  };
}

import {
  evaluateTelemetryAlertRules,
  getTelemetryIncidentKpis,
} from "@/domain/telemetry/alerts";

describe("telemetry alerts evaluation", () => {
  beforeEach(() => {
    telemetryAlertRule.findMany.mockReset();
    telemetryAlertIncident.findFirst.mockReset();
    telemetryAlertIncident.create.mockReset();
    telemetryAlertIncident.update.mockReset();
    telemetryMetricRollup.findMany.mockReset();
    queryRaw.mockReset();
  });

  it("usa GLOBAL/ALL quando a regra não define dimensão", async () => {
    telemetryAlertRule.findMany.mockResolvedValue([buildRuleRow()]);
    telemetryMetricRollup.findMany.mockResolvedValue([
      {
        organizationId: 7,
        value: 5,
        bucketStart: new Date("2026-02-26T10:55:00.000Z"),
      },
    ]);
    telemetryAlertIncident.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    telemetryAlertIncident.create.mockResolvedValue({ id: "inc-1" });

    const result = await evaluateTelemetryAlertRules({ now });

    const firstRollupCall = telemetryMetricRollup.findMany.mock.calls[0]?.[0] as {
      where: { dimensionKey?: string; dimensionValue?: string };
    };
    expect(firstRollupCall.where.dimensionKey).toBe("GLOBAL");
    expect(firstRollupCall.where.dimensionValue).toBe("ALL");
    expect(telemetryAlertIncident.create).toHaveBeenCalledTimes(1);
    expect(result.openedIncidents).toBe(1);
  });

  it("faz fallback para eventos raw quando faltam rollups globais", async () => {
    telemetryAlertRule.findMany.mockResolvedValue([buildRuleRow()]);
    telemetryMetricRollup.findMany.mockResolvedValue([]);
    queryRaw.mockResolvedValue([
      {
        organization_id: 7,
        observed_value: 4,
      },
    ]);
    telemetryAlertIncident.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    telemetryAlertIncident.create.mockResolvedValue({ id: "inc-2" });

    const result = await evaluateTelemetryAlertRules({ now });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(telemetryAlertIncident.create).toHaveBeenCalledTimes(1);
    expect(result.openedIncidents).toBe(1);
  });
});

describe("telemetry incident kpis", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("normaliza agregados SQL para métricas operacionais", async () => {
    queryRaw.mockResolvedValue([
      {
        total_incidents: "9",
        open_incidents: "2",
        acknowledged_incidents: "3",
        resolved_incidents: "4",
        acknowledged_samples: "6",
        resolved_samples: "5",
        mtta_minutes: "6.5",
        mttr_minutes: 32.25,
        ack_sla_breaches: "1",
        resolve_sla_breaches: 2,
      },
    ]);

    const from = new Date("2026-02-26T00:00:00.000Z");
    const to = new Date("2026-02-26T12:00:00.000Z");

    const result = await getTelemetryIncidentKpis({
      organizationId: 7,
      from,
      to,
      ackSlaMinutes: 20,
      resolveSlaMinutes: 180,
    });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(result.totalIncidents).toBe(9);
    expect(result.openIncidents).toBe(2);
    expect(result.acknowledgedIncidents).toBe(3);
    expect(result.resolvedIncidents).toBe(4);
    expect(result.acknowledgedSamples).toBe(6);
    expect(result.resolvedSamples).toBe(5);
    expect(result.mttaMinutes).toBe(6.5);
    expect(result.mttrMinutes).toBe(32.25);
    expect(result.ackSlaMinutes).toBe(20);
    expect(result.resolveSlaMinutes).toBe(180);
    expect(result.ackSlaBreaches).toBe(1);
    expect(result.resolveSlaBreaches).toBe(2);
  });

  it("devolve zeros quando a query não regressa linhas", async () => {
    queryRaw.mockResolvedValue([]);

    const from = new Date("2026-02-26T00:00:00.000Z");
    const to = new Date("2026-02-26T01:00:00.000Z");
    const result = await getTelemetryIncidentKpis({ from, to });

    expect(result.totalIncidents).toBe(0);
    expect(result.ackSlaMinutes).toBe(15);
    expect(result.resolveSlaMinutes).toBe(120);
    expect(result.mttaMinutes).toBeNull();
    expect(result.mttrMinutes).toBeNull();
  });
});
