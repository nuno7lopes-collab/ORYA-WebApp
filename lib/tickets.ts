// Shared ticketing limits between client (checkout) e server (APIs)
export const MAX_TICKETS_PER_WAVE = 6;

export function clampWaveQuantity(qty: number, remaining?: number | null) {
  const safeQty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;
  const cap =
    remaining === null || remaining === undefined
      ? MAX_TICKETS_PER_WAVE
      : Math.max(0, Math.min(remaining, MAX_TICKETS_PER_WAVE));

  return Math.min(safeQty, cap);
}
