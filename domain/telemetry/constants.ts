export const TELEMETRY_SOURCE_TYPES = [
  "WEB",
  "MOBILE",
  "API",
  "WORKER",
  "CRON",
  "INTERNAL",
] as const;

export const TELEMETRY_ACTOR_TYPES = [
  "ANONYMOUS",
  "USER",
  "SYSTEM",
  "SERVICE",
] as const;

export const TELEMETRY_SEVERITIES = [
  "INFO",
  "WARN",
  "ERROR",
  "CRITICAL",
] as const;

export const TELEMETRY_BUCKET_UNITS = ["HOUR", "DAY"] as const;

export const TELEMETRY_METRIC_KEYS = [
  "EVENT_COUNT",
  "UNIQUE_ACTORS",
  "ERROR_COUNT",
] as const;

export const TELEMETRY_INCIDENT_STATUSES = [
  "OPEN",
  "ACKNOWLEDGED",
  "RESOLVED",
] as const;

export const TELEMETRY_COMPARISON_OPERATORS = [
  "GTE",
  "GT",
  "LTE",
  "LT",
  "EQ",
  "NEQ",
] as const;

export type TelemetrySourceType = (typeof TELEMETRY_SOURCE_TYPES)[number];
export type TelemetryActorType = (typeof TELEMETRY_ACTOR_TYPES)[number];
export type TelemetrySeverity = (typeof TELEMETRY_SEVERITIES)[number];
export type TelemetryBucketUnit = (typeof TELEMETRY_BUCKET_UNITS)[number];
export type TelemetryMetricKey = (typeof TELEMETRY_METRIC_KEYS)[number];
export type TelemetryIncidentStatus = (typeof TELEMETRY_INCIDENT_STATUSES)[number];
export type TelemetryComparisonOperator =
  (typeof TELEMETRY_COMPARISON_OPERATORS)[number];
