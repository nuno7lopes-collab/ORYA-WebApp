import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const ensureAuthenticated = vi.hoisted(() => vi.fn());
const isUnauthenticatedError = vi.hoisted(() => vi.fn(() => false));
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const resolveOrganizationIdFromRequest = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const ensureOrganizationEmailVerified = vi.hoisted(() => vi.fn());
const createTournamentForEventInTx = vi.hoisted(() => vi.fn());
const appendEventLog = vi.hoisted(() => vi.fn());
const recordOutboxEvent = vi.hoisted(() => vi.fn());
const recordSearchIndexOutbox = vi.hoisted(() => vi.fn());
const createEventAccessPolicyVersion = vi.hoisted(() => vi.fn());
const ensurePadelRuleSetVersion = vi.hoisted(() => vi.fn());
const syncTournamentOperationalRolesFromClubStaff = vi.hoisted(() => vi.fn());

const tx = vi.hoisted(() => ({
  event: { create: vi.fn() },
  padelTournamentConfig: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  padelEventCategoryLink: { createMany: vi.fn() },
  padelTournamentRoleAssignment: { upsert: vi.fn() },
}));

const prisma = vi.hoisted(() => ({
  profile: { findUnique: vi.fn() },
  organization: { findUnique: vi.fn() },
  address: { findUnique: vi.fn() },
  event: { findMany: vi.fn() },
  padelClub: { findFirst: vi.fn(), findMany: vi.fn() },
  padelPartnershipAgreement: { findFirst: vi.fn() },
  padelPartnershipWindow: { count: vi.fn() },
  padelClubCourt: { findMany: vi.fn() },
  padelClubStaff: { findMany: vi.fn() },
  padelCategory: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/security", () => ({ ensureAuthenticated, isUnauthenticatedError }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationWriteAccess", () => ({ ensureOrganizationEmailVerified }));
vi.mock("@/domain/tournaments/commands", () => ({ createTournamentForEventInTx }));
vi.mock("@/domain/eventLog/append", () => ({ appendEventLog }));
vi.mock("@/domain/outbox/producer", () => ({ recordOutboxEvent }));
vi.mock("@/domain/searchIndex/outbox", () => ({ recordSearchIndexOutbox }));
vi.mock("@/lib/checkin/accessPolicy", () => ({ createEventAccessPolicyVersion }));
vi.mock("@/domain/padel/ruleSetSnapshot", () => ({ ensurePadelRuleSetVersion }));
vi.mock("@/lib/padel/tournamentStaffRoleSync", () => ({ syncTournamentOperationalRolesFromClubStaff }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/org/[orgId]/tournaments/create/route").POST;

function buildBaseBody(overrides?: Record<string, unknown>) {
  return {
    title: "Torneio Primavera",
    startsAt: "2026-03-01T10:00:00.000Z",
    endsAt: "2026-03-01T12:00:00.000Z",
    addressId: "addr-1",
    padel: {
      format: "TODOS_CONTRA_TODOS",
      clubId: 7,
      courtIds: [101],
      categoryIds: [501],
      defaultCategoryId: 501,
      categoryConfigs: [{ padelCategoryId: 501, capacityTeams: 12, pricePerPlayer: 0 }],
    },
    ...overrides,
  };
}

beforeEach(async () => {
  vi.resetModules();

  createSupabaseServer.mockReset();
  ensureAuthenticated.mockReset();
  isUnauthenticatedError.mockReset();
  getActiveOrganizationForUser.mockReset();
  resolveOrganizationIdFromRequest.mockReset();
  ensureMemberModuleAccess.mockReset();
  ensureOrganizationEmailVerified.mockReset();
  createTournamentForEventInTx.mockReset();
  appendEventLog.mockReset();
  recordOutboxEvent.mockReset();
  recordSearchIndexOutbox.mockReset();
  createEventAccessPolicyVersion.mockReset();
  ensurePadelRuleSetVersion.mockReset();
  syncTournamentOperationalRolesFromClubStaff.mockReset();

  prisma.profile.findUnique.mockReset();
  prisma.organization.findUnique.mockReset();
  prisma.address.findUnique.mockReset();
  prisma.event.findMany.mockReset();
  prisma.padelClub.findFirst.mockReset();
  prisma.padelClub.findMany.mockReset();
  prisma.padelPartnershipAgreement.findFirst.mockReset();
  prisma.padelPartnershipWindow.count.mockReset();
  prisma.padelClubCourt.findMany.mockReset();
  prisma.padelClubStaff.findMany.mockReset();
  prisma.padelCategory.findMany.mockReset();
  prisma.$transaction.mockReset();

  tx.event.create.mockReset();
  tx.padelTournamentConfig.upsert.mockReset();
  tx.padelTournamentConfig.findUnique.mockReset();
  tx.padelTournamentConfig.update.mockReset();
  tx.padelEventCategoryLink.createMany.mockReset();
  tx.padelTournamentRoleAssignment.upsert.mockReset();

  createSupabaseServer.mockResolvedValue({});
  ensureAuthenticated.mockResolvedValue({ id: "user-1" });
  isUnauthenticatedError.mockReturnValue(false);
  resolveOrganizationIdFromRequest.mockReturnValue(12);
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 12 },
    membership: { role: "OWNER", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  ensureOrganizationEmailVerified.mockReturnValue({ ok: true });

  prisma.profile.findUnique.mockResolvedValue({
    id: "user-1",
    onboardingDone: true,
    fullName: "User One",
    username: "user_one",
    roles: [],
  });

  prisma.organization.findUnique.mockResolvedValue({
    id: 12,
    orgType: "EXTERNAL",
    officialEmail: "team@example.com",
    officialEmailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    stripeAccountId: "acct_123",
    stripeChargesEnabled: true,
    stripePayoutsEnabled: true,
  });

  prisma.address.findUnique.mockResolvedValue({ id: "addr-1", sourceProvider: "APPLE_MAPS" });
  prisma.event.findMany.mockResolvedValue([]);
  prisma.padelClub.findFirst.mockResolvedValue({ id: 7, kind: "OWN", sourceClubId: null });
  prisma.padelClubCourt.findMany.mockResolvedValue([{ id: 101 }, { id: 102 }]);
  prisma.padelClubStaff.findMany.mockResolvedValue([{ id: 300 }]);
  prisma.padelCategory.findMany.mockResolvedValue([{ id: 501 }]);
  prisma.padelClub.findMany.mockResolvedValue([{ id: 91 }]);

  tx.event.create.mockResolvedValue({
    id: 999,
    slug: "torneio-primavera",
    title: "Torneio Primavera",
    startsAt: new Date("2026-03-01T10:00:00.000Z"),
    endsAt: new Date("2026-03-01T12:00:00.000Z"),
    status: "DRAFT",
  });
  tx.padelTournamentConfig.upsert.mockResolvedValue({ id: 700, ruleSetId: null });
  tx.padelTournamentConfig.findUnique.mockResolvedValue({ id: 700, ruleSetId: null, ruleSetVersionId: null });
  tx.padelTournamentConfig.update.mockResolvedValue({ id: 700, ruleSetVersionId: 1 });
  tx.padelEventCategoryLink.createMany.mockResolvedValue({ count: 1 });
  tx.padelTournamentRoleAssignment.upsert.mockResolvedValue({ id: 1 });

  createEventAccessPolicyVersion.mockResolvedValue({ id: 1, policyVersion: 1 });
  createTournamentForEventInTx.mockResolvedValue({ ok: true, tournamentId: 400, created: true });
  appendEventLog.mockResolvedValue({ id: "evt-log-1" });
  recordOutboxEvent.mockResolvedValue({ id: "outbox-1" });
  recordSearchIndexOutbox.mockResolvedValue({ id: "outbox-search-1" });
  ensurePadelRuleSetVersion.mockResolvedValue({ id: 1 });
  syncTournamentOperationalRolesFromClubStaff.mockResolvedValue({ attempted: 0, created: 0, mappedUsers: 0 });

  prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

  POST = (await import("@/app/api/org/[orgId]/tournaments/create/route")).POST;
});

describe("organization tournaments create route", () => {
  it("creates draft tournament successfully", async () => {
    const req = new NextRequest("http://localhost/api/org/12/tournaments/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildBaseBody()),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.data?.event?.id).toBe(999);
    expect(body.data?.lifecycle?.status).toBe("DRAFT");
    expect(createTournamentForEventInTx).toHaveBeenCalledTimes(1);
    expect(createEventAccessPolicyVersion).toHaveBeenCalledTimes(1);
  });

  it("fails with INVALID_FORMAT when format is missing", async () => {
    const payload = buildBaseBody({
      padel: {
        clubId: 7,
      },
    });

    const req = new NextRequest("http://localhost/api/org/12/tournaments/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("INVALID_FORMAT");
  });

  it("fails with CLUB_INVALID when club is invalid", async () => {
    prisma.padelClub.findFirst.mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/org/12/tournaments/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildBaseBody()),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.errorCode).toBe("CLUB_INVALID");
  });

  it("fails with COURTS_INVALID when there are no active courts", async () => {
    prisma.padelClubCourt.findMany.mockResolvedValueOnce([]);

    const req = new NextRequest("http://localhost/api/org/12/tournaments/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildBaseBody()),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.errorCode).toBe("COURTS_INVALID");
  });

  it("fails with CATEGORIES_INVALID when categories are outside catalog", async () => {
    prisma.padelCategory.findMany.mockResolvedValueOnce([{ id: 501 }]);

    const req = new NextRequest("http://localhost/api/org/12/tournaments/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        buildBaseBody({
          padel: {
            format: "TODOS_CONTRA_TODOS",
            clubId: 7,
            categoryIds: [501, 999],
            defaultCategoryId: 501,
            categoryConfigs: [{ padelCategoryId: 501, capacityTeams: 12, pricePerPlayer: 0 }],
          },
        }),
      ),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.errorCode).toBe("CATEGORIES_INVALID");
  });

  it("fails with STAFF_REQUIRED_FOR_PARTNER_CLUBS when partner clubs are selected without staff", async () => {
    const req = new NextRequest("http://localhost/api/org/12/tournaments/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        buildBaseBody({
          padel: {
            format: "TODOS_CONTRA_TODOS",
            clubId: 7,
            courtIds: [101],
            staffIds: [],
            partnerClubIds: [91],
            categoryIds: [501],
            defaultCategoryId: 501,
            categoryConfigs: [{ padelCategoryId: 501, capacityTeams: 12, pricePerPlayer: 0 }],
          },
        }),
      ),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.errorCode).toBe("STAFF_REQUIRED_FOR_PARTNER_CLUBS");
  });

  it("syncs operational roles from selected club staff on create", async () => {
    const req = new NextRequest("http://localhost/api/org/12/tournaments/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        buildBaseBody({
          padel: {
            format: "TODOS_CONTRA_TODOS",
            clubId: 7,
            courtIds: [101],
            staffIds: [300],
            categoryIds: [501],
            defaultCategoryId: 501,
            categoryConfigs: [{ padelCategoryId: 501, capacityTeams: 12, pricePerPlayer: 0 }],
          },
        }),
      ),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(syncTournamentOperationalRolesFromClubStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        tx,
        organizationId: 12,
        eventId: 999,
        staffIds: [300],
        padelClubId: 7,
      }),
    );
  });

  it("fails with FORBIDDEN when TORNEIOS edit access is missing", async () => {
    ensureMemberModuleAccess.mockResolvedValueOnce({ ok: false });

    const req = new NextRequest("http://localhost/api/org/12/tournaments/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildBaseBody()),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.errorCode).toBe("FORBIDDEN");
  });

  it("fails with PAYMENTS_NOT_READY when paid registrations are requested", async () => {
    prisma.organization.findUnique.mockResolvedValueOnce({
      id: 12,
      orgType: "EXTERNAL",
      officialEmail: "team@example.com",
      officialEmailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
    });

    const req = new NextRequest("http://localhost/api/org/12/tournaments/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        buildBaseBody({
          padel: {
            format: "TODOS_CONTRA_TODOS",
            clubId: 7,
            courtIds: [101],
            categoryIds: [501],
            defaultCategoryId: 501,
            categoryConfigs: [{ padelCategoryId: 501, capacityTeams: 12, pricePerPlayer: 15 }],
          },
        }),
      ),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.errorCode).toBe("PAYMENTS_NOT_READY");
  });

  it("fails atomically when an internal step errors", async () => {
    createTournamentForEventInTx.mockResolvedValueOnce({ ok: false, error: "EVENT_NOT_PADEL" });

    const req = new NextRequest("http://localhost/api/org/12/tournaments/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildBaseBody()),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.errorCode).toBe("TOURNAMENT_CREATE_FAILED");
    expect(appendEventLog).not.toHaveBeenCalled();
    expect(recordOutboxEvent).not.toHaveBeenCalled();
    expect(recordSearchIndexOutbox).not.toHaveBeenCalled();
  });
});
