import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logError, logWarn } from "@/lib/observability/logger";
import { validateTelemetryContractPayload } from "@/domain/telemetry/catalog";
import {
  type TelemetryActorType,
  type TelemetrySeverity,
  type TelemetrySourceType,
} from "@/domain/telemetry/constants";
import { sanitizeTelemetryPayload } from "@/domain/telemetry/redaction";
import {
  buildTelemetryActorKey,
  normalizeTelemetryActorType,
  normalizeTelemetryDate,
  normalizeTelemetryEventVersion,
  normalizeTelemetryIdempotencyKey,
  normalizeTelemetryOrgId,
  normalizeTelemetryOutcome,
  normalizeTelemetryReference,
  normalizeTelemetrySessionId,
  normalizeTelemetrySeverity,
  normalizeTelemetrySourceType,
  normalizeTelemetrySurface,
  normalizeTelemetryUserId,
} from "@/domain/telemetry/types";

const MAX_BATCH_SIZE = 50;

type TelemetryIngestErrorDelegate = {
  create?: (args: {
    data: {
      organizationId: number | null;
      sourceType: TelemetrySourceType;
      eventName: string | null;
      reason: string;
      requestId: string | null;
      correlationId: string | null;
      payload: Prisma.InputJsonValue;
    };
  }) => Promise<unknown>;
};

type TelemetryEventDelegate = {
  create?: (args: {
    data: Record<string, unknown>;
    select: { id: true };
  }) => Promise<{ id: string }>;
};

function getTelemetryIngestErrorDelegate() {
  return (prisma as unknown as { telemetryIngestError?: TelemetryIngestErrorDelegate })
    .telemetryIngestError;
}

function getTelemetryEventDelegate() {
  return (prisma as unknown as { telemetryEvent?: TelemetryEventDelegate }).telemetryEvent;
}

export type TelemetryIngestInput = {
  organizationId?: number | null;
  eventName?: string | null;
  eventVersion?: string | null;
  sourceType?: TelemetrySourceType | string | null;
  severity?: TelemetrySeverity | string | null;
  actorType?: TelemetryActorType | string | null;
  actorUserId?: string | null;
  actorKey?: string | null;
  requestId?: string | null;
  correlationId?: string | null;
  idempotencyKey?: string | null;
  sessionId?: string | null;
  surface?: string | null;
  outcome?: string | null;
  payload?: unknown;
  tags?: unknown;
  occurredAt?: Date | string | null;
};

export type TelemetryIngestDefaults = {
  requestId?: string | null;
  correlationId?: string | null;
  defaultOrganizationId?: number | null;
  defaultSourceType: TelemetrySourceType;
  defaultActorType: TelemetryActorType;
  defaultActorUserId?: string | null;
};

export type TelemetryIngestResult = {
  ok: boolean;
  accepted: boolean;
  duplicate: boolean;
  eventId: string | null;
  eventName: string | null;
  reason?: string;
};

export type TelemetryBatchResult = {
  accepted: number;
  duplicates: number;
  rejected: number;
  items: TelemetryIngestResult[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeTelemetryBatchInput(payload: unknown): TelemetryIngestInput[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord) as TelemetryIngestInput[];
  }

  if (!isRecord(payload)) return [];

  const eventsCandidate = payload.events;
  if (Array.isArray(eventsCandidate)) {
    return eventsCandidate.filter(isRecord) as TelemetryIngestInput[];
  }

  if (isRecord(payload.event)) {
    return [payload.event as TelemetryIngestInput];
  }

  return [payload as TelemetryIngestInput];
}

function sanitizeTags(value: unknown) {
  const sanitized = sanitizeTelemetryPayload(value ?? {});
  return sanitized as Prisma.InputJsonValue;
}

async function recordIngestError(params: {
  organizationId: number | null;
  sourceType: TelemetrySourceType;
  eventName: string | null;
  reason: string;
  requestId: string | null;
  correlationId: string | null;
  payload: unknown;
}) {
  try {
    const delegate = getTelemetryIngestErrorDelegate();
    if (!delegate?.create) return;
    await delegate.create({
      data: {
        organizationId: params.organizationId,
        sourceType: params.sourceType,
        eventName: params.eventName,
        reason: params.reason,
        requestId: params.requestId,
        correlationId: params.correlationId,
        payload: sanitizeTags(params.payload),
      },
    });
  } catch (err) {
    logWarn("telemetry.ingest_error_record_failed", {
      reason: params.reason,
      eventName: params.eventName,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function ingestTelemetryEvent(
  input: TelemetryIngestInput,
  defaults: TelemetryIngestDefaults,
): Promise<TelemetryIngestResult> {
  const rawEventName =
    typeof input.eventName === "string" ? input.eventName.trim() : "";
  const organizationId =
    normalizeTelemetryOrgId(input.organizationId) ??
    normalizeTelemetryOrgId(defaults.defaultOrganizationId);
  const sourceType = normalizeTelemetrySourceType(
    input.sourceType,
    defaults.defaultSourceType,
  );

  if (!rawEventName) {
    await recordIngestError({
      organizationId: organizationId ?? null,
      sourceType,
      eventName: null,
      reason: "INVALID_EVENT_NAME",
      requestId: defaults.requestId ?? null,
      correlationId: defaults.correlationId ?? null,
      payload: input,
    });
    return {
      ok: false,
      accepted: false,
      duplicate: false,
      eventId: null,
      eventName: null,
      reason: "INVALID_EVENT_NAME",
    };
  }

  const contractValidation = validateTelemetryContractPayload(
    rawEventName,
    input.payload,
  );
  if (!contractValidation.ok) {
    await recordIngestError({
      organizationId: organizationId ?? null,
      sourceType,
      eventName: rawEventName,
      reason: contractValidation.error,
      requestId: defaults.requestId ?? null,
      correlationId: defaults.correlationId ?? null,
      payload: input,
    });
    return {
      ok: false,
      accepted: false,
      duplicate: false,
      eventId: null,
      eventName: rawEventName,
      reason: contractValidation.error,
    };
  }

  const contract = contractValidation.contract;
  const eventName = contract.eventName;
  const severity = normalizeTelemetrySeverity(
    input.severity,
    contract.defaultSeverity,
  );

  const fallbackActorType = defaults.defaultActorUserId
    ? "USER"
    : defaults.defaultActorType;
  const actorType = normalizeTelemetryActorType(input.actorType, fallbackActorType);

  const actorUserId =
    normalizeTelemetryUserId(input.actorUserId) ??
    normalizeTelemetryUserId(defaults.defaultActorUserId);

  const sessionId = normalizeTelemetrySessionId(input.sessionId);
  const actorKey = buildTelemetryActorKey({
    actorKey: input.actorKey,
    actorUserId,
    sessionId,
  });

  const requestId =
    normalizeTelemetryReference(input.requestId, 120) ??
    normalizeTelemetryReference(defaults.requestId, 120);
  const correlationId =
    normalizeTelemetryReference(input.correlationId, 120) ??
    normalizeTelemetryReference(defaults.correlationId, 120) ??
    requestId;

  const eventVersion = normalizeTelemetryEventVersion(
    input.eventVersion ?? contract.eventVersion,
  );
  if (eventVersion !== contract.eventVersion) {
    await recordIngestError({
      organizationId: organizationId ?? null,
      sourceType,
      eventName,
      reason: "INVALID_EVENT_VERSION",
      requestId,
      correlationId,
      payload: {
        providedEventVersion: eventVersion,
        expectedEventVersion: contract.eventVersion,
        input,
      },
    });
    return {
      ok: false,
      accepted: false,
      duplicate: false,
      eventId: null,
      eventName,
      reason: "INVALID_EVENT_VERSION",
    };
  }
  const idempotencyKey = normalizeTelemetryIdempotencyKey(input.idempotencyKey);
  const occurredAt = normalizeTelemetryDate(input.occurredAt);
  const surface = normalizeTelemetrySurface(input.surface);
  const outcome = normalizeTelemetryOutcome(input.outcome);

  const payload = sanitizeTelemetryPayload(input.payload ?? {});
  const tags = sanitizeTelemetryPayload(input.tags ?? {});

  try {
    const delegate = getTelemetryEventDelegate();
    if (!delegate?.create) {
      return {
        ok: false,
        accepted: false,
        duplicate: false,
        eventId: null,
        eventName,
        reason: "TELEMETRY_MODEL_UNAVAILABLE",
      };
    }
    const created = await delegate.create({
      data: {
        organizationId,
        eventName,
        eventVersion,
        sourceType,
        severity,
        actorType,
        actorUserId,
        actorKey,
        requestId,
        correlationId,
        idempotencyKey,
        sessionId,
        surface,
        outcome,
        payload: payload as Prisma.InputJsonValue,
        tags: tags as Prisma.InputJsonValue,
        occurredAt,
      },
      select: { id: true },
    });

    return {
      ok: true,
      accepted: true,
      duplicate: false,
      eventId: created.id,
      eventName,
    };
  } catch (error) {
    const knownCode =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? error.code
        : typeof (error as { code?: unknown })?.code === "string"
          ? String((error as { code?: unknown }).code)
          : null;
    if (knownCode === "P2002") {
      return {
        ok: true,
        accepted: true,
        duplicate: true,
        eventId: null,
        eventName,
      };
    }

    await recordIngestError({
      organizationId: organizationId ?? null,
      sourceType,
      eventName,
      reason: "DB_WRITE_FAILED",
      requestId: requestId ?? null,
      correlationId: correlationId ?? null,
      payload: {
        error: error instanceof Error ? error.message : String(error),
        input,
      },
    });

    logError("telemetry.ingest_failed", error, {
      eventName,
      organizationId,
      sourceType,
      requestId,
      correlationId,
    });

    return {
      ok: false,
      accepted: false,
      duplicate: false,
      eventId: null,
      eventName,
      reason: "DB_WRITE_FAILED",
    };
  }
}

export async function ingestTelemetryBatch(
  rawInputs: TelemetryIngestInput[],
  defaults: TelemetryIngestDefaults,
): Promise<TelemetryBatchResult> {
  const boundedInputs = rawInputs.slice(0, MAX_BATCH_SIZE);
  const items: TelemetryIngestResult[] = [];

  for (const input of boundedInputs) {
    // Mantemos ingestão sequencial para preservar idempotência previsível no mesmo batch.
    const result = await ingestTelemetryEvent(input, defaults);
    items.push(result);
  }

  const accepted = items.filter((item) => item.accepted).length;
  const duplicates = items.filter((item) => item.duplicate).length;
  const rejected = items.length - accepted;

  if (rawInputs.length > MAX_BATCH_SIZE) {
    logWarn("telemetry.batch.truncated", {
      requested: rawInputs.length,
      acceptedBatchSize: MAX_BATCH_SIZE,
      requestId: defaults.requestId,
      correlationId: defaults.correlationId,
    });
  }

  return { accepted, duplicates, rejected, items };
}
