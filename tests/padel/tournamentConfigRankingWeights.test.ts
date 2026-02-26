import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const ensurePadelRuleSetVersion = vi.hoisted(() => vi.fn());
const createTournamentForEvent = vi.hoisted(() => vi.fn());
const updateTournament = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  padelCategory: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/domain/padel/ruleSetSnapshot", () => ({ ensurePadelRuleSetVersion }));
vi.mock("@/domain/tournaments/commands", () => ({ createTournamentForEvent, updateTournament }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/tournaments/config/route").POST;

const buildConfig = (
  advancedSettings: Record<string, unknown>,
  overrides?: Partial<{
    resultValidationMode: string;
    pendingConfirmationWindowMinutes: number;
    playerResultSubmissionEnabled: boolean;
  }>,
) => ({
  id: 99,
  eventId: 1001,
  organizationId: 321,
  format: "NON_STOP",
  numberOfCourts: 5,
  ruleSetId: null,
  ruleSetVersionId: null,
  defaultCategoryId: null,
  eligibilityType: "OPEN",
  resultValidationMode: overrides?.resultValidationMode ?? "IMMEDIATE_OFFICIAL",
  pendingConfirmationWindowMinutes: overrides?.pendingConfirmationWindowMinutes ?? 15,
  playerResultSubmissionEnabled: overrides?.playerResultSubmissionEnabled ?? false,
  splitDeadlineHours: null,
  enabledFormats: ["NON_STOP"],
  isInterclub: false,
  teamSize: null,
  advancedSettings,
  lifecycleStatus: "DRAFT",
  padelV2Enabled: true,
  padelClubId: null,
  partnerClubIds: [],
  createdAt: new Date("2026-02-16T10:00:00.000Z"),
  updatedAt: new Date("2026-02-16T10:00:00.000Z"),
  publishedAt: null,
  lockedAt: null,
  completedAt: null,
  cancelledAt: null,
  lifecycleUpdatedAt: new Date("2026-02-16T10:00:00.000Z"),
  ruleSet: null,
  ruleSetVersion: null,
  category: null,
});

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  ensurePadelRuleSetVersion.mockReset();
  createTournamentForEvent.mockReset();
  updateTournament.mockReset();
  prisma.event.findUnique.mockReset();
  prisma.padelCategory.findFirst.mockReset();
  prisma.$transaction.mockReset();

  createSupabaseServer.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "seed-admin" } } })) },
  });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 321 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  ensurePadelRuleSetVersion.mockResolvedValue({ id: 700 });
  createTournamentForEvent.mockResolvedValue({ ok: true });
  updateTournament.mockResolvedValue({ ok: true });
  prisma.event.findUnique.mockResolvedValue({
    id: 1001,
    organizationId: 321,
    templateType: "PADEL",
    startsAt: new Date("2026-04-01T10:00:00.000Z"),
    tournament: null,
  });
  prisma.padelCategory.findFirst.mockResolvedValue({ id: 12 });

  POST = (await import("@/app/api/padel/tournaments/config/route")).POST;
});

describe("POST /api/padel/tournaments/config ranking weights by category", () => {
  it("persists rankingWeights.byCategory and V3 format profile fields", async () => {
    const existingConfig = buildConfig({});
    const persistedAdvancedSettings = {
      rankingWeights: {
        NON_STOP: 0.7,
        AMERICANO: 0.7,
        MEXICANO: 0.7,
        byCategory: {
          "12": { NON_STOP: 0.5, AMERICANO: 0.65 },
        },
      },
      formatProfilesByCategory: {
        "12": {
          format: "NON_STOP",
          nonStopMode: "ACTIVE_QUEUE",
          nonStopRounds: 8,
          nonStopQueueRules: { fairness: "LONGEST_WAIT_FIRST", tieBreak: "QUEUE_ENTERED_AT" },
          amMxProgressionMode: "ROUND_BY_ROUND",
        },
      },
    };

    const tx = {
      padelTournamentConfig: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(existingConfig)
          .mockResolvedValueOnce(
            buildConfig(persistedAdvancedSettings, {
              resultValidationMode: "IMMEDIATE_PENDING_THEN_OFFICIAL",
              pendingConfirmationWindowMinutes: 30,
              playerResultSubmissionEnabled: true,
            }),
          ),
        upsert: vi.fn().mockResolvedValue({ id: 99, ruleSetId: null, ruleSetVersionId: null }),
        update: vi.fn(),
      },
      padelRegistration: { count: vi.fn().mockResolvedValue(0) },
    };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const req = new NextRequest("http://localhost/api/padel/tournaments/config", {
      method: "POST",
      body: JSON.stringify({
        eventId: 1001,
        organizationId: 321,
        resultValidationMode: "IMMEDIATE_PENDING_THEN_OFFICIAL",
        pendingConfirmationWindowMinutes: 30,
        playerResultSubmissionEnabled: true,
        rankingWeights: {
          NON_STOP: 0.7,
          AMERICANO: 0.7,
          MEXICANO: 0.7,
          byCategory: {
            12: { NON_STOP: 0.5, AMERICANO: 0.65 },
          },
        },
        formatProfilesByCategory: {
          12: {
            format: "NON_STOP",
            nonStopMode: "ACTIVE_QUEUE",
            nonStopRounds: 8,
            nonStopQueueRules: { fairness: "LONGEST_WAIT_FIRST", tieBreak: "QUEUE_ENTERED_AT" },
            amMxProgressionMode: "ROUND_BY_ROUND",
          },
        },
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.config.resultValidationMode).toBe("IMMEDIATE_PENDING_THEN_OFFICIAL");
    expect(body.config.pendingConfirmationWindowMinutes).toBe(30);
    expect(body.config.playerResultSubmissionEnabled).toBe(true);
    expect(body.config.advancedSettings.rankingWeights.byCategory["12"].NON_STOP).toBe(0.5);
    expect(body.config.advancedSettings.formatProfilesByCategory["12"].nonStopMode).toBe("ACTIVE_QUEUE");
    expect(body.config.advancedSettings.formatProfilesByCategory["12"].amMxProgressionMode).toBe("ROUND_BY_ROUND");
  });

  it("persiste scoreRulesByCategory e rejeita payload inválido", async () => {
    const existingConfig = buildConfig({
      scoreRules: {
        scoreMode: "SETS",
        deuceMode: "ADVANTAGE",
        setsToWin: 2,
        maxSets: 3,
        gamesToWinSet: 6,
        tieBreakAt: 6,
        tieBreakTo: 7,
        allowSuperTieBreak: true,
        superTieBreakTo: 10,
        superTieBreakWinBy: 2,
        superTieBreakOnlyDecider: true,
        allowExtendedGames: false,
        allowTimedDraw: true,
      },
    });
    const persistedAdvancedSettings = {
      scoreRules: existingConfig.advancedSettings.scoreRules,
      scoreRulesByCategory: {
        "12": {
          scoreMode: "SETS",
          deuceMode: "GOLDEN_POINT",
          setsToWin: 2,
          maxSets: 3,
          gamesToWinSet: 6,
          tieBreakAt: 6,
          tieBreakTo: 7,
          allowSuperTieBreak: true,
          superTieBreakTo: 10,
          superTieBreakWinBy: 2,
          superTieBreakOnlyDecider: true,
          allowExtendedGames: false,
          allowTimedDraw: true,
        },
      },
    };
    const tx = {
      padelTournamentConfig: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(existingConfig)
          .mockResolvedValueOnce(buildConfig(persistedAdvancedSettings)),
        upsert: vi.fn().mockResolvedValue({ id: 99, ruleSetId: null, ruleSetVersionId: null }),
        update: vi.fn(),
      },
      padelRegistration: { count: vi.fn().mockResolvedValue(0) },
    };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const req = new NextRequest("http://localhost/api/padel/tournaments/config", {
      method: "POST",
      body: JSON.stringify({
        eventId: 1001,
        organizationId: 321,
        format: "NON_STOP",
        scoreRulesByCategory: {
          12: {
            deuceMode: "GOLDEN_POINT",
            setsToWin: 2,
            maxSets: 3,
            gamesToWinSet: 6,
            tieBreakAt: 6,
            tieBreakTo: 7,
            allowSuperTieBreak: true,
            superTieBreakTo: 10,
            superTieBreakWinBy: 2,
            superTieBreakOnlyDecider: true,
            allowExtendedGames: false,
            allowTimedDraw: true,
          },
        },
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.config.advancedSettings.scoreRulesByCategory["12"].deuceMode).toBe("GOLDEN_POINT");

    const invalidReq = new NextRequest("http://localhost/api/padel/tournaments/config", {
      method: "POST",
      body: JSON.stringify({
        eventId: 1001,
        organizationId: 321,
        format: "NON_STOP",
        scoreRulesByCategory: {
          abc: { deuceMode: "GOLDEN_POINT" },
        },
      }),
    });
    const invalidRes = await POST(invalidReq);
    const invalidBody = await invalidRes.json();
    expect(invalidRes.status).toBe(400);
    expect(invalidBody.errorCode ?? invalidBody.error).toBe("INVALID_SCORE_RULES_BY_CATEGORY");
  });
});
