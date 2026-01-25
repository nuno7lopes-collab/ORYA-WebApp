export const LOYALTY_POINTS_PER_EURO = 100;

export const LOYALTY_RULE_POINTS_MIN = 1;
export const LOYALTY_RULE_POINTS_MAX = 5000;

export const LOYALTY_MAX_POINTS_PER_DAY_MAX = 20000;
export const LOYALTY_MAX_POINTS_PER_USER_MAX = 200000;

export const LOYALTY_REWARD_POINTS_MIN = 100;
export const LOYALTY_REWARD_POINTS_MAX = 500000;

export const LOYALTY_GUARDRAILS = {
  pointsPerEuro: LOYALTY_POINTS_PER_EURO,
  rule: {
    points: { min: LOYALTY_RULE_POINTS_MIN, max: LOYALTY_RULE_POINTS_MAX },
    maxPointsPerDay: { max: LOYALTY_MAX_POINTS_PER_DAY_MAX },
    maxPointsPerUser: { max: LOYALTY_MAX_POINTS_PER_USER_MAX },
  },
  reward: {
    pointsCost: { min: LOYALTY_REWARD_POINTS_MIN, max: LOYALTY_REWARD_POINTS_MAX },
  },
} as const;

export function validateLoyaltyRuleLimits(params: {
  points: number;
  maxPointsPerDay: number | null;
  maxPointsPerUser: number | null;
}) {
  const { points, maxPointsPerDay, maxPointsPerUser } = params;

  if (points < LOYALTY_RULE_POINTS_MIN || points > LOYALTY_RULE_POINTS_MAX) {
    return {
      ok: false,
      error: `Pontos devem estar entre ${LOYALTY_RULE_POINTS_MIN} e ${LOYALTY_RULE_POINTS_MAX}.`,
    } as const;
  }

  if (maxPointsPerDay !== null && maxPointsPerDay > LOYALTY_MAX_POINTS_PER_DAY_MAX) {
    return {
      ok: false,
      error: `Max por dia excede o limite global (${LOYALTY_MAX_POINTS_PER_DAY_MAX}).`,
    } as const;
  }

  if (maxPointsPerUser !== null && maxPointsPerUser > LOYALTY_MAX_POINTS_PER_USER_MAX) {
    return {
      ok: false,
      error: `Max por utilizador excede o limite global (${LOYALTY_MAX_POINTS_PER_USER_MAX}).`,
    } as const;
  }

  return { ok: true } as const;
}

export function validateLoyaltyRewardLimits(params: { pointsCost: number }) {
  const { pointsCost } = params;
  if (pointsCost < LOYALTY_REWARD_POINTS_MIN || pointsCost > LOYALTY_REWARD_POINTS_MAX) {
    return {
      ok: false,
      error: `Custo deve estar entre ${LOYALTY_REWARD_POINTS_MIN} e ${LOYALTY_REWARD_POINTS_MAX}.`,
    } as const;
  }
  return { ok: true } as const;
}

export function clampLoyaltyRulePoints(points: number) {
  return Math.max(LOYALTY_RULE_POINTS_MIN, Math.min(points, LOYALTY_RULE_POINTS_MAX));
}

export function clampLoyaltyMaxPerDay(value: number | null) {
  if (value === null) return null;
  return Math.min(value, LOYALTY_MAX_POINTS_PER_DAY_MAX);
}

export function clampLoyaltyMaxPerUser(value: number | null) {
  if (value === null) return null;
  return Math.min(value, LOYALTY_MAX_POINTS_PER_USER_MAX);
}
