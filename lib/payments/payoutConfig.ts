const DEFAULT_PAYOUT_HOLD_HOURS = 72;

export function getPayoutHoldHours() {
  const raw = process.env.PAYOUT_HOLD_HOURS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PAYOUT_HOLD_HOURS;
}

export function computeHoldUntil(paidAt: Date) {
  const hours = getPayoutHoldHours();
  return new Date(paidAt.getTime() + hours * 60 * 60 * 1000);
}
