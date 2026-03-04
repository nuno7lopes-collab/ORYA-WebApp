import { api } from "./api";

export type CrmEngagementType = "PROFILE_VIEWED" | "EVENT_VIEWED";
const CRM_REQUEST_TIMEOUT_MS = 2500;

export async function trackCrmEngagement(payload: {
  type: CrmEngagementType;
  organizationId?: number | null;
  eventId?: number | null;
}) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CRM_REQUEST_TIMEOUT_MS);
    try {
      await api.request("/api/crm/engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: payload.type,
          organizationId: payload.organizationId ?? undefined,
          eventId: payload.eventId ?? undefined,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // best-effort
  }
}
