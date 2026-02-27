import {
  TELEMETRY_ACTOR_TYPES,
  TELEMETRY_SEVERITIES,
  TELEMETRY_SOURCE_TYPES,
  type TelemetryActorType,
  type TelemetrySeverity,
  type TelemetrySourceType,
} from "@/domain/telemetry/constants";

const EVENT_NAME_PATTERN = /^[a-z0-9]+(?:\.[a-z0-9]+){2,7}$/;
const EVENT_VERSION_PATTERN = /^[0-9A-Za-z._-]{1,32}$/;
const OUTCOME_PATTERN = /^[a-zA-Z0-9._:-]{1,80}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeString(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function normalizeEnumValue<T extends string>(
  value: unknown,
  options: readonly T[],
): T | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  return (options as readonly string[]).includes(normalized)
    ? (normalized as T)
    : null;
}

export function normalizeTelemetryEventName(value: unknown): string | null {
  const raw = normalizeString(value, 120);
  if (!raw) return null;
  return EVENT_NAME_PATTERN.test(raw) ? raw : null;
}

export function normalizeTelemetryEventVersion(value: unknown): string {
  const raw = normalizeString(value, 32);
  if (!raw) return "1.0.0";
  return EVENT_VERSION_PATTERN.test(raw) ? raw : "1.0.0";
}

export function normalizeTelemetryOutcome(value: unknown): string | null {
  const raw = normalizeString(value, 80);
  if (!raw) return null;
  return OUTCOME_PATTERN.test(raw) ? raw : null;
}

export function normalizeTelemetrySurface(value: unknown): string | null {
  return normalizeString(value, 160);
}

export function normalizeTelemetryIdempotencyKey(value: unknown): string | null {
  return normalizeString(value, 180);
}

export function normalizeTelemetrySessionId(value: unknown): string | null {
  return normalizeString(value, 180);
}

export function normalizeTelemetryOrgId(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function normalizeTelemetryDate(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date() : value;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function normalizeTelemetrySourceType(
  value: unknown,
  fallback: TelemetrySourceType,
): TelemetrySourceType {
  return normalizeEnumValue(value, TELEMETRY_SOURCE_TYPES) ?? fallback;
}

export function normalizeTelemetrySeverity(
  value: unknown,
  fallback: TelemetrySeverity,
): TelemetrySeverity {
  return normalizeEnumValue(value, TELEMETRY_SEVERITIES) ?? fallback;
}

export function normalizeTelemetryActorType(
  value: unknown,
  fallback: TelemetryActorType,
): TelemetryActorType {
  return normalizeEnumValue(value, TELEMETRY_ACTOR_TYPES) ?? fallback;
}

export function normalizeTelemetryUserId(value: unknown): string | null {
  const raw = normalizeString(value, 64);
  if (!raw) return null;
  return UUID_PATTERN.test(raw) ? raw : null;
}

export function normalizeTelemetryReference(value: unknown, maxLen = 160): string | null {
  return normalizeString(value, maxLen);
}

export function buildTelemetryActorKey(input: {
  actorKey?: unknown;
  actorUserId?: unknown;
  sessionId?: unknown;
}): string | null {
  const explicit = normalizeTelemetryReference(input.actorKey, 200);
  if (explicit) return explicit;

  const actorUserId = normalizeTelemetryUserId(input.actorUserId);
  if (actorUserId) return `user:${actorUserId}`;

  const sessionId = normalizeTelemetrySessionId(input.sessionId);
  if (sessionId) return `session:${sessionId}`;

  return null;
}
