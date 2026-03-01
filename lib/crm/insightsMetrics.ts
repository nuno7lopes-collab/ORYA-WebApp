import { normalizeCrmAbTestConfig } from "@/lib/crm/abTesting";

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toMonthKeyUtc(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function shiftUtcMonths(date: Date, delta: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1, 0, 0, 0, 0));
}

function roundRate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

export type RetentionCohortInput = {
  createdAt: Date;
  lastMatchAt: Date | null;
};

export type RetentionCohortRow = {
  month: string;
  size: number;
  retained30: number;
  retained60: number;
  retained90: number;
  eligible30: boolean;
  eligible60: boolean;
  eligible90: boolean;
  rate30: number | null;
  rate60: number | null;
  rate90: number | null;
};

export function buildRetentionCohorts(params: {
  profiles: RetentionCohortInput[];
  now?: Date;
  cohortMonths?: number;
}): {
  cohortMonths: number;
  cohorts: RetentionCohortRow[];
  summary: {
    totalContacts: number;
    matureCohorts30: number;
    matureCohorts60: number;
    matureCohorts90: number;
    avgRate30: number;
    avgRate60: number;
    avgRate90: number;
  };
} {
  const now = params.now ?? new Date();
  const cohortMonths = clamp(Math.trunc(params.cohortMonths ?? 6), 3, 18);

  const cohorts = new Map<
    string,
    {
      monthStart: Date;
      size: number;
      retained30: number;
      retained60: number;
      retained90: number;
    }
  >();

  for (let index = cohortMonths - 1; index >= 0; index -= 1) {
    const monthStart = shiftUtcMonths(startOfUtcMonth(now), -index);
    const key = toMonthKeyUtc(monthStart);
    cohorts.set(key, {
      monthStart,
      size: 0,
      retained30: 0,
      retained60: 0,
      retained90: 0,
    });
  }

  for (const profile of params.profiles) {
    if (!(profile.createdAt instanceof Date) || Number.isNaN(profile.createdAt.getTime())) continue;
    const key = toMonthKeyUtc(profile.createdAt);
    const target = cohorts.get(key);
    if (!target) continue;

    target.size += 1;

    if (profile.lastMatchAt instanceof Date && !Number.isNaN(profile.lastMatchAt.getTime())) {
      const retained30At = new Date(profile.createdAt.getTime() + 30 * DAY_MS);
      const retained60At = new Date(profile.createdAt.getTime() + 60 * DAY_MS);
      const retained90At = new Date(profile.createdAt.getTime() + 90 * DAY_MS);

      if (profile.lastMatchAt >= retained30At) target.retained30 += 1;
      if (profile.lastMatchAt >= retained60At) target.retained60 += 1;
      if (profile.lastMatchAt >= retained90At) target.retained90 += 1;
    }
  }

  const rows: RetentionCohortRow[] = [];
  let matureRate30Total = 0;
  let matureRate60Total = 0;
  let matureRate90Total = 0;
  let matureCohorts30 = 0;
  let matureCohorts60 = 0;
  let matureCohorts90 = 0;

  for (const [month, row] of cohorts.entries()) {
    const ageDays = Math.floor((now.getTime() - row.monthStart.getTime()) / DAY_MS);
    const eligible30 = ageDays >= 30;
    const eligible60 = ageDays >= 60;
    const eligible90 = ageDays >= 90;

    const rate30 = eligible30 && row.size > 0 ? roundRate(row.retained30, row.size) : null;
    const rate60 = eligible60 && row.size > 0 ? roundRate(row.retained60, row.size) : null;
    const rate90 = eligible90 && row.size > 0 ? roundRate(row.retained90, row.size) : null;

    if (rate30 !== null) {
      matureCohorts30 += 1;
      matureRate30Total += rate30;
    }
    if (rate60 !== null) {
      matureCohorts60 += 1;
      matureRate60Total += rate60;
    }
    if (rate90 !== null) {
      matureCohorts90 += 1;
      matureRate90Total += rate90;
    }

    rows.push({
      month,
      size: row.size,
      retained30: row.retained30,
      retained60: row.retained60,
      retained90: row.retained90,
      eligible30,
      eligible60,
      eligible90,
      rate30,
      rate60,
      rate90,
    });
  }

  return {
    cohortMonths,
    cohorts: rows,
    summary: {
      totalContacts: rows.reduce((acc, row) => acc + row.size, 0),
      matureCohorts30,
      matureCohorts60,
      matureCohorts90,
      avgRate30: matureCohorts30 ? Number((matureRate30Total / matureCohorts30).toFixed(4)) : 0,
      avgRate60: matureCohorts60 ? Number((matureRate60Total / matureCohorts60).toFixed(4)) : 0,
      avgRate90: matureCohorts90 ? Number((matureRate90Total / matureCohorts90).toFixed(4)) : 0,
    },
  };
}

export type SegmentPerformanceInputSegment = {
  id: string;
  name: string;
  sizeCache: number | null;
};

export type SegmentPerformanceInputCampaign = {
  segmentId: string | null;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  failedCount: number;
  payload: unknown;
};

export type SegmentPerformanceRow = {
  segmentId: string;
  segmentName: string;
  sizeCache: number | null;
  campaignsSent: number;
  campaignsWithAb: number;
  sent: number;
  opened: number;
  clicked: number;
  failed: number;
  openRate: number;
  ctr: number;
  failRate: number;
  performanceScore: number;
};

export function buildSegmentPerformance(params: {
  segments: SegmentPerformanceInputSegment[];
  campaigns: SegmentPerformanceInputCampaign[];
}) {
  const bySegment = new Map<
    string,
    {
      segmentName: string;
      sizeCache: number | null;
      campaignsSent: number;
      campaignsWithAb: number;
      sent: number;
      opened: number;
      clicked: number;
      failed: number;
    }
  >();

  for (const segment of params.segments) {
    bySegment.set(segment.id, {
      segmentName: segment.name,
      sizeCache: segment.sizeCache,
      campaignsSent: 0,
      campaignsWithAb: 0,
      sent: 0,
      opened: 0,
      clicked: 0,
      failed: 0,
    });
  }

  for (const campaign of params.campaigns) {
    if (!campaign.segmentId) continue;

    if (!bySegment.has(campaign.segmentId)) {
      bySegment.set(campaign.segmentId, {
        segmentName: "Segmento",
        sizeCache: null,
        campaignsSent: 0,
        campaignsWithAb: 0,
        sent: 0,
        opened: 0,
        clicked: 0,
        failed: 0,
      });
    }

    const target = bySegment.get(campaign.segmentId)!;
    target.campaignsSent += 1;
    target.sent += Math.max(0, campaign.sentCount);
    target.opened += Math.max(0, campaign.openedCount);
    target.clicked += Math.max(0, campaign.clickedCount);
    target.failed += Math.max(0, campaign.failedCount);

    const payload = asObject(campaign.payload);
    if (normalizeCrmAbTestConfig(payload.abTest).enabled) {
      target.campaignsWithAb += 1;
    }
  }

  const segments: SegmentPerformanceRow[] = Array.from(bySegment.entries())
    .map(([segmentId, stats]) => {
      const openRate = roundRate(stats.opened, Math.max(1, stats.sent));
      const ctr = roundRate(stats.clicked, Math.max(1, stats.sent));
      const failRate = roundRate(stats.failed, Math.max(1, stats.sent + stats.failed));
      const performanceScore = Math.round(
        Math.max(
          0,
          Math.min(
            100,
            openRate * 45 +
              ctr * 40 +
              (1 - failRate) * 15 +
              Math.min(1, stats.campaignsSent / 4) * 5,
          ),
        ) * 100,
      ) / 100;

      return {
        segmentId,
        segmentName: stats.segmentName,
        sizeCache: stats.sizeCache,
        campaignsSent: stats.campaignsSent,
        campaignsWithAb: stats.campaignsWithAb,
        sent: stats.sent,
        opened: stats.opened,
        clicked: stats.clicked,
        failed: stats.failed,
        openRate,
        ctr,
        failRate,
        performanceScore,
      };
    })
    .sort((a, b) => {
      if (b.sent !== a.sent) return b.sent - a.sent;
      if (b.performanceScore !== a.performanceScore) return b.performanceScore - a.performanceScore;
      return a.segmentName.localeCompare(b.segmentName, "pt");
    });

  return {
    segments,
    summary: {
      totalSegments: segments.length,
      withCampaigns: segments.filter((item) => item.campaignsSent > 0).length,
      sent: segments.reduce((acc, item) => acc + item.sent, 0),
      opened: segments.reduce((acc, item) => acc + item.opened, 0),
      clicked: segments.reduce((acc, item) => acc + item.clicked, 0),
      failed: segments.reduce((acc, item) => acc + item.failed, 0),
    },
  };
}

export type CampaignAbVariantMetrics = {
  campaignId: string;
  campaignName: string;
  variantId: string;
  sent: number;
  opened: number;
  clicked: number;
  failed: number;
  openRate: number;
  ctr: number;
};

export function buildCampaignAbWinners(variants: CampaignAbVariantMetrics[]) {
  const grouped = new Map<string, CampaignAbVariantMetrics[]>();
  for (const variant of variants) {
    if (!grouped.has(variant.campaignId)) grouped.set(variant.campaignId, []);
    grouped.get(variant.campaignId)!.push(variant);
  }

  return Array.from(grouped.entries())
    .map(([campaignId, rows]) => {
      const sorted = [...rows].sort((a, b) => {
        if (b.ctr !== a.ctr) return b.ctr - a.ctr;
        if (b.openRate !== a.openRate) return b.openRate - a.openRate;
        return b.sent - a.sent;
      });
      const winner = sorted[0] ?? null;
      const runnerUp = sorted[1] ?? null;
      if (!winner) return null;
      return {
        campaignId,
        campaignName: winner.campaignName,
        winnerVariantId: winner.variantId,
        winnerCtr: winner.ctr,
        winnerOpenRate: winner.openRate,
        winnerSent: winner.sent,
        runnerUpVariantId: runnerUp?.variantId ?? null,
        upliftCtr: runnerUp ? Number((winner.ctr - runnerUp.ctr).toFixed(4)) : null,
        upliftOpenRate: runnerUp ? Number((winner.openRate - runnerUp.openRate).toFixed(4)) : null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => {
      const bUplift = b.upliftCtr ?? -1;
      const aUplift = a.upliftCtr ?? -1;
      if (bUplift !== aUplift) return bUplift - aUplift;
      return b.winnerSent - a.winnerSent;
    });
}

export type JourneyAbVariantMetrics = {
  journeyId: string;
  journeyName: string;
  stepKey: string;
  variantId: string;
  completed: number;
  skipped: number;
  failed: number;
};

export function buildJourneyAbWinners(variants: JourneyAbVariantMetrics[]) {
  const grouped = new Map<string, JourneyAbVariantMetrics[]>();
  for (const variant of variants) {
    const key = `${variant.journeyId}:${variant.stepKey}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(variant);
  }

  return Array.from(grouped.entries())
    .map(([, rows]) => {
      const withRates = rows.map((row) => {
        const attempts = Math.max(1, row.completed + row.skipped + row.failed);
        const completionRate = roundRate(row.completed, attempts);
        const failureRate = roundRate(row.failed, attempts);
        return { ...row, completionRate, failureRate };
      });

      const sorted = [...withRates].sort((a, b) => {
        if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate;
        if (a.failureRate !== b.failureRate) return a.failureRate - b.failureRate;
        return (b.completed + b.skipped + b.failed) - (a.completed + a.skipped + a.failed);
      });

      const winner = sorted[0] ?? null;
      const runnerUp = sorted[1] ?? null;
      if (!winner) return null;

      return {
        journeyId: winner.journeyId,
        journeyName: winner.journeyName,
        stepKey: winner.stepKey,
        winnerVariantId: winner.variantId,
        completionRate: winner.completionRate,
        failureRate: winner.failureRate,
        runnerUpVariantId: runnerUp?.variantId ?? null,
        upliftCompletionRate: runnerUp
          ? Number((winner.completionRate - runnerUp.completionRate).toFixed(4))
          : null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => {
      const bUplift = b.upliftCompletionRate ?? -1;
      const aUplift = a.upliftCompletionRate ?? -1;
      if (bUplift !== aUplift) return bUplift - aUplift;
      return b.completionRate - a.completionRate;
    });
}

export type LoyaltyTypeAggregateInput = {
  entryType: string;
  points: number;
};

export function summarizeLoyaltyByType(rows: LoyaltyTypeAggregateInput[]) {
  let earnedPoints = 0;
  let spentPoints = 0;
  let expiredPoints = 0;
  let adjustedPoints = 0;
  let netPoints = 0;

  for (const row of rows) {
    const type = row.entryType.toUpperCase();
    const points = Number.isFinite(row.points) ? row.points : 0;

    if (type === "EARN") {
      earnedPoints += points;
      netPoints += points;
      continue;
    }
    if (type === "SPEND") {
      spentPoints += points;
      netPoints -= points;
      continue;
    }
    if (type === "EXPIRE") {
      expiredPoints += points;
      netPoints -= points;
      continue;
    }
    adjustedPoints += points;
    netPoints += points;
  }

  return {
    earnedPoints,
    spentPoints,
    expiredPoints,
    adjustedPoints,
    netPoints,
  };
}

export type LoyaltyUserAggregateInput = {
  userId: string;
  entryType: string;
  points: number;
};

export function buildLoyaltyUserLeaderboard(rows: LoyaltyUserAggregateInput[]) {
  const map = new Map<
    string,
    {
      userId: string;
      earnedPoints: number;
      spentPoints: number;
      expiredPoints: number;
      adjustedPoints: number;
      netPoints: number;
    }
  >();

  for (const row of rows) {
    if (!map.has(row.userId)) {
      map.set(row.userId, {
        userId: row.userId,
        earnedPoints: 0,
        spentPoints: 0,
        expiredPoints: 0,
        adjustedPoints: 0,
        netPoints: 0,
      });
    }

    const target = map.get(row.userId)!;
    const type = row.entryType.toUpperCase();
    const points = Number.isFinite(row.points) ? row.points : 0;

    if (type === "EARN") {
      target.earnedPoints += points;
      target.netPoints += points;
      continue;
    }
    if (type === "SPEND") {
      target.spentPoints += points;
      target.netPoints -= points;
      continue;
    }
    if (type === "EXPIRE") {
      target.expiredPoints += points;
      target.netPoints -= points;
      continue;
    }

    target.adjustedPoints += points;
    target.netPoints += points;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.netPoints !== a.netPoints) return b.netPoints - a.netPoints;
    if (b.earnedPoints !== a.earnedPoints) return b.earnedPoints - a.earnedPoints;
    return a.userId.localeCompare(b.userId, "pt");
  });
}
