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
  $transaction: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/domain/padel/ruleSetSnapshot", () => ({ ensurePadelRuleSetVersion }));
vi.mock("@/domain/tournaments/commands", () => ({ createTournamentForEvent, updateTournament }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/tournaments/config/route").POST;

function buildLockedConfig(overrides?: Record<string, unknown>) {
  return {
    id: 11,
    eventId: 1,
    organizationId: 99,
    format: "TODOS_CONTRA_TODOS",
    numberOfCourts: 2,
    ruleSetId: null,
    ruleSetVersionId: null,
    defaultCategoryId: null,
    eligibilityType: "OPEN",
    splitDeadlineHours: null,
    enabledFormats: ["TODOS_CONTRA_TODOS"],
    isInterclub: false,
    teamSize: null,
    advancedSettings: {},
    lifecycleStatus: "LOCKED",
    padelV2Enabled: true,
    padelClubId: null,
    partnerClubIds: [],
    createdAt: new Date("2026-02-13T12:00:00.000Z"),
    updatedAt: new Date("2026-02-13T12:00:00.000Z"),
    publishedAt: new Date("2026-02-13T12:00:00.000Z"),
    lockedAt: new Date("2026-02-13T12:00:00.000Z"),
    liveAt: null,
    completedAt: null,
    cancelledAt: null,
    lifecycleUpdatedAt: new Date("2026-02-13T12:00:00.000Z"),
    ruleSet: null,
    ruleSetVersion: null,
    category: null,
    ...overrides,
  };
}

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  ensurePadelRuleSetVersion.mockReset();
  createTournamentForEvent.mockReset();
  updateTournament.mockReset();
  prisma.event.findUnique.mockReset();
  prisma.$transaction.mockReset();

  createSupabaseServer.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
  });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 99 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  ensurePadelRuleSetVersion.mockResolvedValue({ id: 500 });
  createTournamentForEvent.mockResolvedValue({ ok: true });
  updateTournament.mockResolvedValue({ ok: true });
  prisma.event.findUnique.mockResolvedValue(null);

  POST = (await import("@/app/api/padel/tournaments/config/route")).POST;
});

describe("POST /api/padel/tournaments/config lock contract", () => {
  it("bloqueia alterações competitivas após LOCKED com 409 TOURNAMENT_CONFIG_LOCKED", async () => {
    const tx = {
      padelTournamentConfig: {
        findUnique: vi.fn().mockResolvedValue(buildLockedConfig()),
        upsert: vi.fn(),
      },
      padelRegistration: { count: vi.fn() },
    };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const req = new NextRequest("http://localhost/api/padel/tournaments/config", {
      method: "POST",
      body: JSON.stringify({
        eventId: 1,
        organizationId: 99,
        format: "MEXICANO",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("TOURNAMENT_CONFIG_LOCKED");
    expect(tx.padelTournamentConfig.upsert).not.toHaveBeenCalled();
  });

  it("permite apenas campos live operacionais após LOCKED", async () => {
    const tx = {
      padelTournamentConfig: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(buildLockedConfig())
          .mockResolvedValueOnce(
            buildLockedConfig({
              advancedSettings: {
                featuredMatchId: 77,
                tvMonitor: { footerText: "Live", sponsors: ["Marca X"] },
                liveSponsors: { hero: { label: "Hero", logoUrl: null, url: null } },
              },
            }),
          ),
        upsert: vi.fn().mockResolvedValue({ id: 11, ruleSetId: null, ruleSetVersionId: null }),
        update: vi.fn(),
      },
      padelRegistration: { count: vi.fn().mockResolvedValue(0) },
    };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const req = new NextRequest("http://localhost/api/padel/tournaments/config", {
      method: "POST",
      body: JSON.stringify({
        eventId: 1,
        organizationId: 99,
        featuredMatchId: 77,
        tvMonitor: { footerText: "Live", sponsors: ["Marca X"] },
        liveSponsors: { hero: { label: "Hero" } },
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.config.advancedSettings.featuredMatchId).toBe(77);
    expect(body.config.advancedSettings.tvMonitor.footerText).toBe("Live");
    expect(body.config.advancedSettings.liveSponsors.hero.label).toBe("Hero");
    expect(tx.padelTournamentConfig.upsert).toHaveBeenCalledTimes(1);
  });
});
