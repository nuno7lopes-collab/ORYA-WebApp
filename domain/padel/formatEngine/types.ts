import { padel_format } from "@prisma/client";

export type PadelAmMxMode = "INDIVIDUAL_ROTATION" | "FIXED_PAIR";
export type PadelAmMxProgressionMode = "ROUND_BY_ROUND";
export type PadelNonStopMode = "ACTIVE_QUEUE" | "HARD_CAP_WAITLIST";

export type PadelNonStopQueueRules = {
  fairness?: "LONGEST_WAIT_FIRST" | "ROUND_ROBIN";
  tieBreak?: "QUEUE_ENTERED_AT" | "SEED";
};

export type PadelFormatProfile = {
  format: padel_format;
  label: string;
  minTeams: number;
  defaultAmMxMode?: PadelAmMxMode;
  defaultAmMxProgressionMode?: PadelAmMxProgressionMode;
  defaultNonStopMode?: PadelNonStopMode;
  requiresKnockout?: boolean;
  isTimed?: boolean;
};

export type PadelCapacityPolicy = {
  publishWarnOnly: boolean;
  hardBlockGenerate: boolean;
  hardBlockAutoSchedule: boolean;
};

export type PadelCategoryWeightMap = Record<string, number>;

export type PadelRoundBlueprintType =
  | "GROUPS"
  | "KNOCKOUT"
  | "ROUND_ROBIN"
  | "NON_STOP"
  | "AM_MX_ROTATION";

export type PadelRoundBlueprint = {
  label: string;
  matches: number;
  type: PadelRoundBlueprintType;
};

export type PadelPlanCategoryInput = {
  categoryId?: number | string | null;
  label?: string | null;
  teams: number;
  format?: padel_format | string | null;
  amMxMode?: PadelAmMxMode | null;
  amMxProgressionMode?: PadelAmMxProgressionMode | null;
  nonStopMode?: PadelNonStopMode | null;
  nonStopRounds?: number | null;
  nonStopQueueRules?: PadelNonStopQueueRules | null;
  roundsHint?: number | null;
  groupCount?: number | null;
  groupSize?: number | null;
  qualifyPerGroup?: number | null;
  extraQualifiers?: number | null;
};

export type PadelPlanInput = {
  format: padel_format | string;
  categories?: PadelPlanCategoryInput[];
  teams?: number | null;
  amMxMode?: PadelAmMxMode | null;
  amMxProgressionMode?: PadelAmMxProgressionMode | null;
  nonStopMode?: PadelNonStopMode | null;
  nonStopRounds?: number | null;
  nonStopQueueRules?: PadelNonStopQueueRules | null;
  windowStart: Date | string;
  windowEnd: Date | string;
  durationMinutes: number;
  bufferMinutes?: number | null;
  courtIds?: number[] | null;
  courtsCount?: number | null;
  categoryWeights?: PadelCategoryWeightMap | null;
  roundsHint?: number | null;
  groupCount?: number | null;
  groupSize?: number | null;
  qualifyPerGroup?: number | null;
  extraQualifiers?: number | null;
};

export type PadelPlanCategoryResult = {
  key: string;
  categoryId: number | null;
  label: string;
  format: padel_format;
  teams: number;
  minTeams: number;
  matchesNeeded: number;
  allocatedSlots: number;
  recommendedMax: number;
  hardCapMax: number | null;
  queueEstimatedRounds: number | null;
  recommendedMaxTeams: number;
  feasible: boolean;
  warnings: string[];
  rounds: PadelRoundBlueprint[];
  amMxMode?: PadelAmMxMode;
  amMxProgressionMode?: PadelAmMxProgressionMode;
  nonStopMode?: PadelNonStopMode;
};

export type PadelPlanAlternative =
  | {
      type: "ADD_HOURS";
      hoursDelta: number;
      summary: string;
    }
  | {
      type: "ADD_COURTS";
      courtsDelta: number;
      summary: string;
    }
  | {
      type: "REDUCE_TEAMS";
      byCategory: Array<{
        key: string;
        label: string;
        currentTeams: number;
        recommendedMaxTeams: number;
      }>;
      summary: string;
    };

export type PadelPlanResult = {
  feasible: boolean;
  windowMinutes: number;
  courtsUsed: number;
  slotMinutes: number;
  totalSlots: number;
  matchesNeeded: number;
  unscheduledMatches: number;
  categories: PadelPlanCategoryResult[];
  warnings: string[];
  blockingReasons: string[];
  alternatives: PadelPlanAlternative[];
};

export type PadelScheduleFeasibilityResult = {
  feasible: boolean;
  skipped: number;
  unscheduledByReason: Record<string, number>;
  blockingReasons: string[];
};
