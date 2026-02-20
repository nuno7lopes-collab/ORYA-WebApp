export const SCHEDULER_V2_WEIGHTS = {
  sameCourtRepeatPenalty: 1,
  consecutiveMatchPenalty: 2,
  categoryStreakPenalty: 2,
} as const;

export type SchedulerV2ScoreInput = {
  sameCourtRepeat: number;
  consecutiveMatch: number;
  categoryStreak: number;
};

export const computeSchedulerV2Penalty = (input: SchedulerV2ScoreInput) => {
  return (
    input.sameCourtRepeat * SCHEDULER_V2_WEIGHTS.sameCourtRepeatPenalty +
    input.consecutiveMatch * SCHEDULER_V2_WEIGHTS.consecutiveMatchPenalty +
    input.categoryStreak * SCHEDULER_V2_WEIGHTS.categoryStreakPenalty
  );
};
