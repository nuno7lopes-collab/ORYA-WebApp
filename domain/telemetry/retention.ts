import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppEnv } from "@/lib/appEnv";

function parseRetentionDays(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), 3650);
}

export function getTelemetryRetentionConfig() {
  return {
    rawDays: parseRetentionDays(process.env.TELEMETRY_RETENTION_RAW_DAYS, 30),
    ingestErrorsDays: parseRetentionDays(process.env.TELEMETRY_RETENTION_INGEST_ERRORS_DAYS, 30),
    rollupsDays: parseRetentionDays(process.env.TELEMETRY_RETENTION_ROLLUPS_DAYS, 180),
    incidentsDays: parseRetentionDays(process.env.TELEMETRY_RETENTION_INCIDENTS_DAYS, 180),
    funnelResultsDays: parseRetentionDays(process.env.TELEMETRY_RETENTION_FUNNEL_RESULTS_DAYS, 180),
  };
}

export type TelemetryRetentionResult = {
  env: string;
  rawDeleted: number;
  ingestErrorsDeleted: number;
  rollupsDeleted: number;
  incidentsDeleted: number;
  funnelResultsDeleted: number;
  cutoffs: {
    rawBefore: string;
    ingestErrorsBefore: string;
    rollupsBefore: string;
    incidentsBefore: string;
    funnelResultsBefore: string;
  };
};

export async function purgeTelemetryRetention(): Promise<TelemetryRetentionResult> {
  const env = getAppEnv();
  const config = getTelemetryRetentionConfig();
  const now = new Date();

  const rawBefore = new Date(now.getTime() - config.rawDays * 24 * 60 * 60 * 1000);
  const ingestErrorsBefore = new Date(now.getTime() - config.ingestErrorsDays * 24 * 60 * 60 * 1000);
  const rollupsBefore = new Date(now.getTime() - config.rollupsDays * 24 * 60 * 60 * 1000);
  const incidentsBefore = new Date(now.getTime() - config.incidentsDays * 24 * 60 * 60 * 1000);
  const funnelResultsBefore = new Date(now.getTime() - config.funnelResultsDays * 24 * 60 * 60 * 1000);

  const [rawDeleted, ingestErrorsDeleted, rollupsDeleted, incidentsDeleted, funnelResultsDeleted] = await Promise.all([
    prisma.$executeRaw<number>(Prisma.sql`
      DELETE FROM app_v3.telemetry_events
      WHERE env = ${env}
        AND occurred_at < ${rawBefore}
    `),
    prisma.$executeRaw<number>(Prisma.sql`
      DELETE FROM app_v3.telemetry_ingest_errors
      WHERE env = ${env}
        AND created_at < ${ingestErrorsBefore}
    `),
    prisma.$executeRaw<number>(Prisma.sql`
      DELETE FROM app_v3.telemetry_metric_rollups
      WHERE env = ${env}
        AND bucket_start < ${rollupsBefore}
    `),
    prisma.$executeRaw<number>(Prisma.sql`
      DELETE FROM app_v3.telemetry_alert_incidents
      WHERE env = ${env}
        AND status = 'RESOLVED'
        AND triggered_at < ${incidentsBefore}
    `),
    prisma.$executeRaw<number>(Prisma.sql`
      DELETE FROM app_v3.telemetry_funnel_results
      WHERE env = ${env}
        AND bucket_start < ${funnelResultsBefore}
    `),
  ]);

  return {
    env,
    rawDeleted: Number(rawDeleted ?? 0),
    ingestErrorsDeleted: Number(ingestErrorsDeleted ?? 0),
    rollupsDeleted: Number(rollupsDeleted ?? 0),
    incidentsDeleted: Number(incidentsDeleted ?? 0),
    funnelResultsDeleted: Number(funnelResultsDeleted ?? 0),
    cutoffs: {
      rawBefore: rawBefore.toISOString(),
      ingestErrorsBefore: ingestErrorsBefore.toISOString(),
      rollupsBefore: rollupsBefore.toISOString(),
      incidentsBefore: incidentsBefore.toISOString(),
      funnelResultsBefore: funnelResultsBefore.toISOString(),
    },
  };
}
