import crypto from "crypto";

export function computeDedupeKey(
  matchId: number,
  startAt: Date | null,
  courtId: number | null,
  scheduleVersion?: string | null,
) {
  const payload = `${matchId}|${startAt ? startAt.toISOString() : "null"}|${courtId ?? "null"}|${scheduleVersion ?? "null"}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}
