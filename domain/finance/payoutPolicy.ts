export function computeReleaseAt(eventEndsAt: Date | null) {
  if (!eventEndsAt) return null;
  const release = new Date(eventEndsAt.getTime() + 72 * 60 * 60 * 1000);
  return release;
}

export function computeHold(amountCents: number, hasDisputes: boolean) {
  if (hasDisputes) return { holdCents: amountCents, reason: "DISPUTES" };
  return { holdCents: 0, reason: null };
}
