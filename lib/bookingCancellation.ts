export type CancellationDecision = {
  allowed: boolean;
  reason: "ALREADY_STARTED" | "WINDOW_EXPIRED" | "POLICY_BLOCKED" | null;
  deadline: Date | null;
};

export function getCancellationDeadline(startsAt: Date, windowMinutes: number | null) {
  if (windowMinutes == null) return null;
  return new Date(startsAt.getTime() - windowMinutes * 60 * 1000);
}

export function decideCancellation(
  startsAt: Date,
  windowMinutes: number | null,
  now = new Date(),
): CancellationDecision {
  if (startsAt.getTime() <= now.getTime()) {
    return { allowed: false, reason: "ALREADY_STARTED", deadline: null };
  }

  const deadline = getCancellationDeadline(startsAt, windowMinutes);
  if (!deadline) {
    return { allowed: false, reason: "POLICY_BLOCKED", deadline: null };
  }

  if (now.getTime() > deadline.getTime()) {
    return { allowed: false, reason: "WINDOW_EXPIRED", deadline };
  }

  return { allowed: true, reason: null, deadline };
}
