export function clampWaveQuantity(qty: number, remaining?: number | null) {
  const safeQty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;
  const cap =
    remaining === null || remaining === undefined
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, remaining);

  return Math.min(safeQty, cap);
}
