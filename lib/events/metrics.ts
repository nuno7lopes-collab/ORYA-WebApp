import "server-only";

export type EventConsumesResourcesMetric =
  | "event_consumes_resources.create"
  | "event_consumes_resources.update"
  | "event_consumes_resources.delete"
  | "event_consumes_resources.conflict";

type MetricPayload = {
  organizationId?: number | null;
  eventId?: number | null;
  status?: "success" | "failure";
  reason?: string;
  conflictsCount?: number;
  applied?: boolean;
  claimsCreated?: number;
  operation?: "create" | "update" | "publish" | "delete";
};

export function emitEventConsumesResourcesMetric(metric: EventConsumesResourcesMetric, payload: MetricPayload = {}) {
  console.log(
    JSON.stringify({
      kind: "event_metric",
      metric,
      ...payload,
    }),
  );
}

export function extractConflictsCount(details: unknown): number {
  if (!details || typeof details !== "object") return 0;
  const raw = (details as { conflicts?: unknown }).conflicts;
  return Array.isArray(raw) ? raw.length : 0;
}
