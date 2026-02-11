"use client";

import { useEffect, useRef } from "react";

type CrmEngagementTrackerProps = {
  type: "PROFILE_VIEWED" | "EVENT_VIEWED";
  organizationId?: number | null;
  eventId?: number | null;
  enabled?: boolean;
};

export default function CrmEngagementTracker({
  type,
  organizationId,
  eventId,
  enabled = true,
}: CrmEngagementTrackerProps) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (!enabled || sentRef.current) return;
    if (type === "PROFILE_VIEWED" && !organizationId) return;
    if (type === "EVENT_VIEWED" && !eventId) return;
    sentRef.current = true;

    fetch("/api/crm/engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        organizationId: organizationId ?? undefined,
        eventId: eventId ?? undefined,
      }),
    }).catch(() => {});
  }, [enabled, eventId, organizationId, type]);

  return null;
}
