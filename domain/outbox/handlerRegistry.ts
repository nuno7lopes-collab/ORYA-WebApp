import type { Prisma } from "@prisma/client";

export type OutboxHandlerInput = {
  eventId: string;
  eventType: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
  causationId: string | null;
  correlationId: string | null;
};

export type OutboxHandlerDecision =
  | {
      action: "DEAD_LETTER";
      reasonCode: string;
      errorClass: string;
      errorStack?: string | null;
      eventLogOrganizationId?: number | null;
      eventLogType?: string;
      eventLogPayload?: Prisma.InputJsonValue;
      eventLogSubjectType?: string | null;
      eventLogSubjectId?: string | null;
    }
  | {
      action: "SKIP";
    };

export type OutboxHandler = (input: OutboxHandlerInput) => Promise<OutboxHandlerDecision>;

const outboxHandlerRegistry = new Map<string, OutboxHandler>();

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function resolveOrganizationIdFromPayload(payload: Prisma.JsonValue): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const data = payload as Record<string, unknown>;
  const direct =
    parsePositiveInt(data.organizationId) ??
    parsePositiveInt(data.orgId) ??
    parsePositiveInt(data.toOrganizationId) ??
    parsePositiveInt(data.clubOrganizationId);
  if (direct) return direct;
  if (data.source && typeof data.source === "object" && !Array.isArray(data.source)) {
    const fromSource = parsePositiveInt((data.source as Record<string, unknown>).organizationId);
    if (fromSource) return fromSource;
  }
  return null;
}

export function registerOutboxHandler(eventType: string, handler: OutboxHandler) {
  const normalized = eventType.trim();
  if (!normalized) throw new Error("OUTBOX_HANDLER_EVENT_TYPE_REQUIRED");
  outboxHandlerRegistry.set(normalized, handler);
}

export function clearOutboxHandlerRegistry() {
  outboxHandlerRegistry.clear();
}

export function resolveOutboxHandler(eventType: string): OutboxHandler | null {
  return outboxHandlerRegistry.get(eventType.trim()) ?? null;
}

export function isUnknownOutboxDeadLetterEnabled() {
  const raw = (process.env.OUTBOX_UNKNOWN_DEFAULT_HANDLER_ENABLED ?? "true").toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off" && raw !== "no";
}

export async function defaultUnknownHandler(input: OutboxHandlerInput): Promise<OutboxHandlerDecision> {
  try {
    const organizationId = resolveOrganizationIdFromPayload(input.payload);
    return {
      action: "DEAD_LETTER",
      reasonCode: "UNKNOWN_EVENT_TYPE",
      errorClass: "OutboxUnsupportedEvent",
      eventLogOrganizationId: organizationId,
      eventLogType: "outbox.event.unsupported.dead_lettered",
      eventLogSubjectType: "OUTBOX_EVENT",
      eventLogSubjectId: input.eventId,
      eventLogPayload: {
        eventId: input.eventId,
        eventType: input.eventType,
        reasonCode: "UNKNOWN_EVENT_TYPE",
        causationId: input.causationId,
        correlationId: input.correlationId,
        payload: input.payload,
      } satisfies Prisma.InputJsonObject,
    };
  } catch {
    return {
      action: "DEAD_LETTER",
      reasonCode: "UNKNOWN_EVENT_TYPE",
      errorClass: "OutboxUnsupportedEvent",
    };
  }
}
