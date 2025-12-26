const MAX_STRIPE_IDEMPOTENCY_KEY = 200;

export function clampIdempotencyKey(key: string) {
  if (key.length <= MAX_STRIPE_IDEMPOTENCY_KEY) return key;
  return key.slice(0, MAX_STRIPE_IDEMPOTENCY_KEY);
}

export function checkoutKey(purchaseId: string) {
  return clampIdempotencyKey(`checkout:${purchaseId}`);
}

export function refundKey(purchaseId: string) {
  return clampIdempotencyKey(`refund:${purchaseId}`);
}

export function autoChargeKey(pairingId: number | string, attempt: number) {
  return clampIdempotencyKey(`auto_charge:${pairingId}:${attempt}`);
}
