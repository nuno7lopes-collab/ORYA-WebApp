import {
  computeAutoSchedulePlan,
  type AutoScheduleMatch,
} from "@/domain/padel/autoSchedule";
import { resolveCategoryKey } from "@/domain/padel/schedulerV2/constraints";
import { normalizeUnscheduledReason } from "@/domain/padel/schedulerV2/reasons";
import type {
  PadelScheduleStrategy,
  SchedulerV2CategorySummary,
  SchedulerV2Input,
  SchedulerV2Plan,
} from "@/domain/padel/schedulerV2/types";

const parseRoundLabelMeta = (label?: string | null) => {
  if (!label) return { prefix: "", size: null };
  const trimmed = label.trim();
  const prefix = trimmed.startsWith("A ") ? "A" : trimmed.startsWith("B ") ? "B" : "";
  const base = prefix ? trimmed.slice(2).trim() : trimmed;
  let size: number | null = null;
  if (base.startsWith("R")) {
    const parsed = Number(base.slice(1));
    size = Number.isFinite(parsed) ? parsed : null;
  } else if (base === "QUARTERFINAL") size = 8;
  else if (base === "SEMIFINAL") size = 4;
  else if (base === "FINAL") size = 2;
  return { prefix, size };
};

const prefixOrder = (prefix: string) => (prefix === "A" ? 0 : prefix === "B" ? 1 : 2);

const roundTypeOrder = (roundType?: string | null, priority: "GROUPS_FIRST" | "KNOCKOUT_FIRST" = "GROUPS_FIRST") => {
  if (priority === "KNOCKOUT_FIRST") {
    if (roundType === "KNOCKOUT") return 0;
    if (roundType === "GROUPS") return 1;
    return 2;
  }
  if (roundType === "GROUPS") return 0;
  if (roundType === "KNOCKOUT") return 1;
  return 2;
};

const sortByCompetitivePriority = (
  matches: Array<AutoScheduleMatch & { categoryId?: number | null }>,
  priority: "GROUPS_FIRST" | "KNOCKOUT_FIRST",
) => {
  return [...matches].sort((a, b) => {
    const typeDiff = roundTypeOrder(a.roundType, priority) - roundTypeOrder(b.roundType, priority);
    if (typeDiff !== 0) return typeDiff;

    if (a.roundType === "KNOCKOUT" || b.roundType === "KNOCKOUT") {
      const aMeta = parseRoundLabelMeta(a.roundLabel);
      const bMeta = parseRoundLabelMeta(b.roundLabel);
      if (prefixOrder(aMeta.prefix) !== prefixOrder(bMeta.prefix)) {
        return prefixOrder(aMeta.prefix) - prefixOrder(bMeta.prefix);
      }
      if (aMeta.size !== null && bMeta.size !== null && aMeta.size !== bMeta.size) {
        return bMeta.size - aMeta.size;
      }
    }

    if (a.roundLabel && b.roundLabel && a.roundLabel !== b.roundLabel) {
      return a.roundLabel.localeCompare(b.roundLabel, "pt-PT", { numeric: true, sensitivity: "base" });
    }

    return a.id - b.id;
  });
};

const buildBalancedOrder = (
  matches: Array<AutoScheduleMatch & { categoryId?: number | null }>,
  priority: "GROUPS_FIRST" | "KNOCKOUT_FIRST",
) => {
  const sorted = sortByCompetitivePriority(matches, priority);
  const byCategory = new Map<string, Array<AutoScheduleMatch & { categoryId?: number | null }>>();

  for (const match of sorted) {
    const key = resolveCategoryKey(match.categoryId ?? null);
    const bucket = byCategory.get(key) ?? [];
    bucket.push(match);
    byCategory.set(key, bucket);
  }

  const categoryKeys = Array.from(byCategory.keys()).sort((a, b) => {
    if (a === "global" && b !== "global") return -1;
    if (b === "global" && a !== "global") return 1;
    const aNum = Number(a);
    const bNum = Number(b);
    if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
    return a.localeCompare(b, "pt-PT", { numeric: true, sensitivity: "base" });
  });

  const ordered: Array<AutoScheduleMatch & { categoryId?: number | null }> = [];
  let remaining = sorted.length;
  while (remaining > 0) {
    for (const key of categoryKeys) {
      const bucket = byCategory.get(key);
      if (!bucket || bucket.length === 0) continue;
      const next = bucket.shift();
      if (next) {
        ordered.push(next);
        remaining -= 1;
      }
    }
  }

  return ordered;
};

const buildByCategorySummary = (params: {
  orderedMatches: Array<AutoScheduleMatch & { categoryId?: number | null }>;
  scheduledByMatchId: Set<number>;
  skippedByMatchId: Map<number, string>;
}): SchedulerV2CategorySummary[] => {
  const summary = new Map<string, SchedulerV2CategorySummary>();

  for (const match of params.orderedMatches) {
    const key = resolveCategoryKey(match.categoryId ?? null);
    if (!summary.has(key)) {
      summary.set(key, {
        categoryId: key === "global" ? null : Number(key),
        scheduledCount: 0,
        skippedCount: 0,
        unscheduledByReason: {},
      });
    }
    const bucket = summary.get(key)!;
    if (params.scheduledByMatchId.has(match.id)) {
      bucket.scheduledCount += 1;
      continue;
    }
    const reason = normalizeUnscheduledReason(params.skippedByMatchId.get(match.id) ?? "NO_SLOT_AVAILABLE");
    bucket.skippedCount += 1;
    bucket.unscheduledByReason[reason] = (bucket.unscheduledByReason[reason] ?? 0) + 1;
  }

  return Array.from(summary.values());
};

export function computeSchedulerV2Plan(input: SchedulerV2Input): SchedulerV2Plan {
  const priority =
    input.strategy === "KNOCKOUT_FIRST"
      ? "KNOCKOUT_FIRST"
      : input.strategy === "GROUPS_FIRST"
        ? "GROUPS_FIRST"
        : input.config.priority;

  const orderedMatches =
    input.strategy === "BALANCED_BY_CATEGORY"
      ? buildBalancedOrder(input.unscheduledMatches, priority)
      : sortByCompetitivePriority(input.unscheduledMatches, priority);

  const result = computeAutoSchedulePlan({
    unscheduledMatches: orderedMatches,
    scheduledMatches: input.scheduledMatches,
    courts: input.courts,
    availabilities: input.availabilities,
    courtBlocks: input.courtBlocks,
    config: {
      ...input.config,
      priority,
      preserveInputOrder: true,
    },
  });

  const scheduledByMatchId = new Set(result.scheduled.map((item) => item.matchId));
  const skippedByMatchId = new Map(result.skipped.map((item) => [item.matchId, item.reason]));
  const byCategory = buildByCategorySummary({
    orderedMatches,
    scheduledByMatchId,
    skippedByMatchId,
  });

  return {
    ...result,
    strategy: input.strategy,
    byCategory,
  };
}

export const __test__ = {
  buildBalancedOrder,
  sortByCompetitivePriority,
};
