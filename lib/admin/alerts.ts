import { logWarn } from "@/lib/observability/logger";

export async function notifyAdminSecurityEvent(event: {
  type: string;
  userId: string;
  userEmail?: string | null;
  correlationId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const webhook = process.env.ADMIN_ALERT_WEBHOOK_URL;
  if (!webhook) return;

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: event.type,
        userId: event.userId,
        userEmail: event.userEmail ?? null,
        correlationId: event.correlationId ?? null,
        ip: event.ip ?? null,
        userAgent: event.userAgent ?? null,
        createdAt: new Date().toISOString(),
      }),
    });
  } catch (err) {
    logWarn("admin.alert_webhook_failed", { type: event.type, userId: event.userId, error: String(err) });
  }
}
