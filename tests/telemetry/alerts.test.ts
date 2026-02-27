import { beforeEach, describe, expect, it, vi } from "vitest";

const telemetryAlertRule = vi.hoisted(() => ({
  findMany: vi.fn(),
}));
const telemetryAlertIncident = vi.hoisted(() => ({
  findMany: vi.fn(),
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
  listTelemetryIncidentsPage,
} from "@/domain/telemetry/alerts";

describe("telemetry alerts evaluation", () => {
  beforeEach(() => {
    telemetryAlertRule.findMany.mockReset();
    telemetryAlertIncident.findMany.mockReset();
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

describe("telemetry incidents pagination", () => {
  beforeEach(() => {
    telemetryAlertIncident.findMany.mockReset();
    queryRaw.mockReset();
  });

  it("pagina por cursor em ordenação temporal", async () => {
    telemetryAlertIncident.findMany.mockResolvedValue([
      {
        id: "inc-1",
        ruleId: "rule-1",
        organizationId: 7,
        status: "OPEN",
        severity: "ERROR",
        title: "Erro 1",
        description: null,
        metricKey: "ERROR_COUNT",
        dimensionKey: null,
        dimensionValue: null,
        observedValue: 5,
        thresholdValue: 3,
        triggeredAt: new Date("2026-02-26T12:00:00.000Z"),
        acknowledgedAt: null,
        resolvedAt: null,
        acknowledgedByUserId: null,
        resolvedByUserId: null,
        context: {},
        createdAt: new Date("2026-02-26T12:00:00.000Z"),
        updatedAt: new Date("2026-02-26T12:00:00.000Z"),
        rule: { id: "rule-1", name: "Regra 1" },
      },
      {
        id: "inc-2",
        ruleId: "rule-1",
        organizationId: 7,
        status: "OPEN",
        severity: "WARN",
        title: "Erro 2",
        description: null,
        metricKey: "ERROR_COUNT",
        dimensionKey: null,
        dimensionValue: null,
        observedValue: 4,
        thresholdValue: 3,
        triggeredAt: new Date("2026-02-26T11:30:00.000Z"),
        acknowledgedAt: null,
        resolvedAt: null,
        acknowledgedByUserId: null,
        resolvedByUserId: null,
        context: {},
        createdAt: new Date("2026-02-26T11:30:00.000Z"),
        updatedAt: new Date("2026-02-26T11:30:00.000Z"),
        rule: { id: "rule-1", name: "Regra 1" },
      },
      {
        id: "inc-3",
        ruleId: "rule-2",
        organizationId: 7,
        status: "ACKNOWLEDGED",
        severity: "WARN",
        title: "Erro 3",
        description: null,
        metricKey: "ERROR_COUNT",
        dimensionKey: null,
        dimensionValue: null,
        observedValue: 3,
        thresholdValue: 3,
        triggeredAt: new Date("2026-02-26T11:00:00.000Z"),
        acknowledgedAt: new Date("2026-02-26T11:05:00.000Z"),
        resolvedAt: null,
        acknowledgedByUserId: "user-1",
        resolvedByUserId: null,
        context: {},
        createdAt: new Date("2026-02-26T11:00:00.000Z"),
        updatedAt: new Date("2026-02-26T11:05:00.000Z"),
        rule: { id: "rule-2", name: "Regra 2" },
      },
    ]);

    const result = await listTelemetryIncidentsPage({
      take: 2,
      cursor: "6d0d6e6a-2c6c-437f-8f2e-3a89f7f06a2b",
      sort: "TRIGGERED_DESC",
      statuses: ["OPEN"],
    });

    expect(result.sort).toBe("TRIGGERED_DESC");
    expect(result.items).toHaveLength(2);
    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.nextCursor).toBe("inc-2");
    expect(telemetryAlertIncident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
        cursor: { id: "6d0d6e6a-2c6c-437f-8f2e-3a89f7f06a2b" },
        skip: 1,
        orderBy: [{ triggeredAt: "desc" }, { id: "desc" }],
      }),
    );
  });

  it("pagina por impacto SLA com cursor codificado", async () => {
    queryRaw.mockResolvedValue([
      {
        id: "8e5f89f5-090e-43f9-80ad-5ddf678d09c4",
        rule_id: "5ee9f6b8-9cce-4f11-a203-7bb47342a5b2",
        organization_id: 7,
        status: "OPEN",
        severity: "CRITICAL",
        title: "Incidente crítico",
        description: null,
        metric_key: "ERROR_COUNT",
        dimension_key: "SOURCE_TYPE",
        dimension_value: "API",
        observed_value: 29,
        threshold_value: 10,
        triggered_at: new Date("2026-02-26T10:00:00.000Z"),
        acknowledged_at: null,
        resolved_at: null,
        acknowledged_by_user_id: null,
        resolved_by_user_id: null,
        context: {},
        created_at: new Date("2026-02-26T10:00:00.000Z"),
        updated_at: new Date("2026-02-26T10:00:00.000Z"),
        rule_join_id: "5ee9f6b8-9cce-4f11-a203-7bb47342a5b2",
        rule_name: "Erros críticos",
        breach_rank: 3,
        status_rank: 3,
        severity_rank: 4,
      },
      {
        id: "0a3bdb7d-c4da-4620-82df-46d4f6b53116",
        rule_id: null,
        organization_id: 7,
        status: "ACKNOWLEDGED",
        severity: "ERROR",
        title: "Incidente secundário",
        description: null,
        metric_key: "ERROR_COUNT",
        dimension_key: "SOURCE_TYPE",
        dimension_value: "WORKER",
        observed_value: 14,
        threshold_value: 10,
        triggered_at: new Date("2026-02-26T11:00:00.000Z"),
        acknowledged_at: new Date("2026-02-26T11:05:00.000Z"),
        resolved_at: null,
        acknowledged_by_user_id: "user-2",
        resolved_by_user_id: null,
        context: {},
        created_at: new Date("2026-02-26T11:00:00.000Z"),
        updated_at: new Date("2026-02-26T11:05:00.000Z"),
        rule_join_id: null,
        rule_name: null,
        breach_rank: 2,
        status_rank: 2,
        severity_rank: 3,
      },
    ]);

    const result = await listTelemetryIncidentsPage({
      organizationId: 7,
      sort: "SLA_IMPACT_DESC",
      statuses: ["OPEN", "ACKNOWLEDGED"],
      take: 1,
      ackSlaMinutes: 20,
      resolveSlaMinutes: 180,
    });

    expect(result.sort).toBe("SLA_IMPACT_DESC");
    expect(result.items).toHaveLength(1);
    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.nextCursor).toEqual(expect.any(String));
    expect(queryRaw).toHaveBeenCalledTimes(1);
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
