import { api } from "./api";

export type CrmEngagementType = "PROFILE_VIEWED" | "EVENT_VIEWED";

export async function trackCrmEngagement(payload: {
  type: CrmEngagementType;
  organizationId?: number | null;
  eventId?: number | null;
}) {
  try {
    await api.request("/api/crm/engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: payload.type,
        organizationId: payload.organizationId ?? undefined,
        eventId: payload.eventId ?? undefined,
      }),
    });
  } catch {
    // best-effort
  }
}
