export type SplitPricingMode = "FIXED" | "DYNAMIC";
export type SplitDynamicMode = "PERCENT" | "AMOUNT";

export type SplitParticipantInput = {
  inviteId?: number | null;
  userId?: string | null;
  name?: string | null;
  contact?: string | null;
  shareCents?: number | null;
  sharePercentBps?: number | null;
};

export type SplitParticipantComputed = SplitParticipantInput & {
  baseShareCents: number;
};

type NormalizeResult =
  | {
      ok: true;
      participants: SplitParticipantComputed[];
      fixedShareCents?: number | null;
      dynamicMode?: SplitDynamicMode | null;
    }
  | { ok: false; error: string };

const toInt = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

export function allocateCentsByWeights(totalCents: number, weights: number[]): number[] {
  const safeTotal = Math.max(0, Math.round(totalCents));
  if (!weights.length) return [];
  const totalWeight = weights.reduce((acc, w) => acc + Math.max(0, w), 0);
  if (totalWeight <= 0) {
    const base = Math.floor(safeTotal / weights.length);
    const remainder = safeTotal - base * weights.length;
    return weights.map((_, idx) => base + (idx < remainder ? 1 : 0));
  }

  const raw = weights.map((w) => (safeTotal * Math.max(0, w)) / totalWeight);
  const floors = raw.map((value) => Math.floor(value));
  let remainder = safeTotal - floors.reduce((acc, value) => acc + value, 0);

  const ranked = raw
    .map((value, idx) => ({ idx, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floors];
  let cursor = 0;
  while (remainder > 0 && ranked.length) {
    result[ranked[cursor]?.idx ?? 0] += 1;
    remainder -= 1;
    cursor = (cursor + 1) % ranked.length;
  }

  return result;
}

export function normalizeSplitParticipants(params: {
  totalBaseCents: number;
  pricingMode: SplitPricingMode;
  dynamicMode?: SplitDynamicMode | null;
  participants: SplitParticipantInput[];
}): NormalizeResult {
  const totalBaseCents = Math.max(0, Math.round(params.totalBaseCents));
  const participants = params.participants ?? [];
  if (!participants.length) {
    return { ok: false, error: "PARTICIPANTS_REQUIRED" };
  }

  if (params.pricingMode === "FIXED") {
    const explicit = participants.map((item) => toInt(item.shareCents));
    const provided = explicit.filter((value) => value != null) as number[];
    if (provided.length > 0 && provided.length !== participants.length) {
      return { ok: false, error: "SHARE_REQUIRED" };
    }

    if (provided.length > 0) {
      const first = provided[0] ?? 0;
      if (!provided.every((value) => value === first)) {
        return { ok: false, error: "SHARE_MISMATCH" };
      }
      if (first <= 0) return { ok: false, error: "SHARE_INVALID" };
      const expected = first * participants.length;
      if (expected !== totalBaseCents) {
        return { ok: false, error: "SHARE_TOTAL_MISMATCH" };
      }
      return {
        ok: true,
        fixedShareCents: first,
        participants: participants.map((item) => ({
          ...item,
          baseShareCents: first,
        })),
      };
    }

    const base = Math.floor(totalBaseCents / participants.length);
    if (base <= 0) {
      return { ok: false, error: "SHARE_TOO_SMALL" };
    }
    const remainder = totalBaseCents - base * participants.length;
    if (remainder !== 0) {
      return { ok: false, error: "SHARE_TOTAL_MISMATCH" };
    }
    return {
      ok: true,
      fixedShareCents: base,
      participants: participants.map((item) => ({
        ...item,
        baseShareCents: base,
      })),
    };
  }

  const inferredDynamicMode: SplitDynamicMode | null =
    params.dynamicMode ??
    (participants.some((item) => item.sharePercentBps != null) ? "PERCENT" : null) ??
    (participants.some((item) => item.shareCents != null) ? "AMOUNT" : null);

  if (!inferredDynamicMode) {
    return { ok: false, error: "DYNAMIC_MODE_REQUIRED" };
  }

  if (inferredDynamicMode === "PERCENT") {
    const weights = participants.map((item) => {
      const value = toInt(item.sharePercentBps);
      return value == null ? null : Math.max(0, value);
    });
    if (weights.some((value) => value == null)) {
      return { ok: false, error: "PERCENT_REQUIRED" };
    }
    const totalWeight = weights.reduce<number>((acc, value) => acc + (value ?? 0), 0);
    if (totalWeight !== 10_000) {
      return { ok: false, error: "PERCENT_TOTAL_INVALID" };
    }
    const baseShares = allocateCentsByWeights(totalBaseCents, weights as number[]);
    if (baseShares.some((value) => value <= 0)) {
      return { ok: false, error: "SHARE_TOO_SMALL" };
    }
    return {
      ok: true,
      dynamicMode: "PERCENT",
      participants: participants.map((item, idx) => ({
        ...item,
        baseShareCents: baseShares[idx] ?? 0,
      })),
    };
  }

  const amounts = participants.map((item) => toInt(item.shareCents));
  if (amounts.some((value) => value == null)) {
    return { ok: false, error: "SHARE_REQUIRED" };
  }
  const sum = (amounts as number[]).reduce((acc, value) => acc + value, 0);
  if (sum !== totalBaseCents) {
    return { ok: false, error: "SHARE_TOTAL_MISMATCH" };
  }

  if ((amounts as number[]).some((value) => value <= 0)) {
    return { ok: false, error: "SHARE_TOO_SMALL" };
  }

  return {
    ok: true,
    dynamicMode: "AMOUNT",
    participants: participants.map((item, idx) => ({
      ...item,
      baseShareCents: amounts[idx] ?? 0,
    })),
  };
}
