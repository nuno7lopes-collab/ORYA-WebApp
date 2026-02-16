import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  eventMatchSlot: { findMany: vi.fn() },
  padelPairing: { findMany: vi.fn() },
}));

const computePadelStandingsByGroup = vi.hoisted(() => vi.fn(() => ({})));
const normalizePadelPointsTable = vi.hoisted(() => vi.fn((value) => value));
const normalizePadelTieBreakRules = vi.hoisted(() => vi.fn((value) => value));
const resolvePadelRuleSetSnapshotForEvent = vi.hoisted(() =>
  vi.fn(async () => ({
    pointsTable: {},
    tieBreakRules: [],
  })),
);

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/domain/padel/standings", () => ({
  computePadelStandingsByGroup,
  normalizePadelPointsTable,
  normalizePadelTieBreakRules,
}));
vi.mock("@/domain/padel/ruleSetSnapshot", () => ({ resolvePadelRuleSetSnapshotForEvent }));
vi.mock("@/domain/padelCompetitionState", () => ({ resolvePadelCompetitionState: () => "PUBLIC" }));

let buildPadelLiveReadModel: typeof import("@/domain/padel/liveReadModel").buildPadelLiveReadModel;

beforeEach(async () => {
  prisma.event.findUnique.mockReset();
  prisma.eventMatchSlot.findMany.mockReset();
  prisma.padelPairing.findMany.mockReset();
  computePadelStandingsByGroup.mockReset();
  normalizePadelPointsTable.mockReset();
  normalizePadelTieBreakRules.mockReset();
  resolvePadelRuleSetSnapshotForEvent.mockReset();

  normalizePadelPointsTable.mockImplementation((value: unknown) => value);
  normalizePadelTieBreakRules.mockImplementation((value: unknown) => value);
  computePadelStandingsByGroup.mockReturnValue({});
  resolvePadelRuleSetSnapshotForEvent.mockResolvedValue({
    pointsTable: {},
    tieBreakRules: [],
  });

  prisma.event.findUnique.mockResolvedValue({
    id: 1,
    slug: "open-padel",
    title: "Open Padel",
    status: "PUBLISHED",
    timezone: "Europe/Lisbon",
    padelTournamentConfig: { advancedSettings: { competitionState: "PUBLIC" }, lifecycleStatus: "PUBLIC" },
    accessPolicies: [{ mode: "PUBLIC" }],
  });
  prisma.eventMatchSlot.findMany.mockResolvedValue([
    {
      id: 10,
      status: "IN_PROGRESS",
      groupLabel: null,
      roundLabel: "Semi",
      roundType: "KNOCKOUT",
      score: {},
      scoreSets: [],
      courtId: 4,
      courtName: "Campo Central",
      courtNumber: 1,
      plannedStartAt: new Date("2026-02-16T10:00:00.000Z"),
      plannedEndAt: new Date("2026-02-16T11:00:00.000Z"),
      plannedDurationMinutes: 60,
      startTime: new Date("2026-02-16T10:00:00.000Z"),
      actualStartAt: null,
      pairingA: {
        slots: [
          { playerProfile: { displayName: "Alice Silva", fullName: "Alice Silva", userId: "u1" } },
          { playerProfile: { displayName: "Bruna Santos", fullName: "Bruna Santos", userId: "u2" } },
        ],
      },
      pairingB: {
        slots: [
          { playerProfile: { displayName: "Carla Costa", fullName: "Carla Costa", userId: "u3" } },
          { playerProfile: { displayName: "Diana Lopes", fullName: "Diana Lopes", userId: "u4" } },
        ],
      },
      participants: [],
      court: { id: 4, name: "Campo Central" },
    },
  ]);
  prisma.padelPairing.findMany.mockResolvedValue([]);

  vi.resetModules();
  ({ buildPadelLiveReadModel } = await import("@/domain/padel/liveReadModel"));
});

describe("padel live public data masking", () => {
  it("mascara nomes pessoais na superfície pública", async () => {
    const pub = await buildPadelLiveReadModel({ eventId: 1, visibility: "public" });
    const internal = await buildPadelLiveReadModel({ eventId: 1, visibility: "internal" });

    expect(pub).not.toBeNull();
    expect(internal).not.toBeNull();

    const publicLabel = pub?.live_now_by_court[0]?.matches[0]?.pairingA ?? "";
    const internalLabel = internal?.live_now_by_court[0]?.matches[0]?.pairingA ?? "";

    expect(publicLabel).toContain("Alice S.");
    expect(publicLabel).not.toContain("Alice Silva");
    expect(internalLabel).toContain("Alice Silva");
  });
});

