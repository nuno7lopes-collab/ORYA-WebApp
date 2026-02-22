import crypto from "crypto";

export function computeDedupeKey(
  matchId: number,
  startAt: Date | null,
  courtId: number | null,
  scheduleVersion?: string | null,
  eventType?: string | null,
  scheduledAt?: Date | null,
) {
  const payload = [
    matchId,
    eventType ?? "MATCH_CHANGED",
    scheduledAt ? scheduledAt.toISOString() : "null",
    scheduleVersion ?? "null",
    startAt ? startAt.toISOString() : "null",
    courtId ?? "null",
  ].join("|");
  return crypto.createHash("sha256").update(payload).digest("hex");
}
