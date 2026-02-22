import type {
  AutoScheduleAvailability,
  AutoScheduleConfig,
  AutoScheduleCourt,
  AutoScheduleCourtBlock,
  AutoScheduleExistingMatch,
  AutoScheduleMatch,
  AutoScheduleResult,
} from "@/domain/padel/autoSchedule";

export type PadelDrawPolicy = "RANDOM_WITH_OPTIONAL_SEEDS" | "RANDOM_ONLY" | "SEEDED_ONLY";

export type PadelSeedSource = "TOURNAMENT_CONFIG" | "RANKING_SNAPSHOT" | "NONE";

export type PadelScheduleStrategy = "BALANCED_BY_CATEGORY" | "GROUPS_FIRST" | "KNOCKOUT_FIRST";

export type PadelPartialMode = "ALLOW_PARTIAL" | "REQUIRE_FULL";

export type PadelExecutionMode = "SYNC" | "ASYNC";

export type PadelUnscheduledReason =
  | "INVALID_WINDOW"
  | "WINDOW_NOT_SET"
  | "NO_COURTS_CONFIGURED"
  | "NO_SLOT_IN_WINDOW"
  | "NO_COURT_WINDOW"
  | "COURT_BLOCKED"
  | "PLAYER_UNAVAILABLE"
  | "REST_CONFLICT"
  | "OVERLAP_CONFLICT"
  | "NO_PARTICIPANTS"
  | "MISSING_PARTICIPANTS"
  | "COURT_NOT_AVAILABLE"
  | "NO_SLOT_AVAILABLE"
  | "CATEGORY_WINDOW_EXHAUSTED"
  | "HARD_BLOCK_CONFLICT"
  | "CLASS_SESSION_CONFLICT"
  | "BOOKING_CONFLICT"
  | "MATCH_CONFLICT"
  | "SOFT_BLOCK_CONFLICT"
  | "AGENDA_CONFLICT"
  | (string & {});

export type SchedulerV2CategorySummary = {
  categoryId: number | null;
  scheduledCount: number;
  skippedCount: number;
  unscheduledByReason: Record<string, number>;
};

export type SchedulerV2Plan = AutoScheduleResult & {
  strategy: PadelScheduleStrategy;
  byCategory: SchedulerV2CategorySummary[];
};

export type SchedulerV2Input = {
  strategy: PadelScheduleStrategy;
  unscheduledMatches: Array<AutoScheduleMatch & { categoryId?: number | null }>;
  scheduledMatches: AutoScheduleExistingMatch[];
  courts: AutoScheduleCourt[];
  availabilities: AutoScheduleAvailability[];
  courtBlocks: AutoScheduleCourtBlock[];
  config: AutoScheduleConfig;
};
