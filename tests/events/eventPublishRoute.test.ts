import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const ensureAuthenticated = vi.hoisted(() => vi.fn());
const isUnauthenticatedError = vi.hoisted(() => vi.fn(() => false));
const resolveGroupMemberForOrg = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const appendEventLog = vi.hoisted(() => vi.fn());
const recordOutboxEvent = vi.hoisted(() => vi.fn());
const recordSearchIndexOutbox = vi.hoisted(() => vi.fn());
const syncEventResourceClaims = vi.hoisted(() => vi.fn());

class EventResourceClaimsError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const prisma = vi.hoisted(() => ({
  profile: { findUnique: vi.fn() },
  event: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/security", () => ({ ensureAuthenticated, isUnauthenticatedError }));
vi.mock("@/lib/organizationGroupAccess", () => ({ resolveGroupMemberForOrg }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/domain/eventLog/append", () => ({ appendEventLog }));
vi.mock("@/domain/outbox/producer", () => ({ recordOutboxEvent }));
vi.mock("@/domain/searchIndex/outbox", () => ({ recordSearchIndexOutbox }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/events/resourceClaims", () => ({
  syncEventResourceClaims,
  EventResourceClaimsError,
}));

let POST: typeof import("@/app/api/org/[orgId]/events/publish/route").POST;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  ensureAuthenticated.mockReset();
  isUnauthenticatedError.mockReset();
  resolveGroupMemberForOrg.mockReset();
  ensureMemberModuleAccess.mockReset();
  appendEventLog.mockReset();
  recordOutboxEvent.mockReset();
  recordSearchIndexOutbox.mockReset();
  syncEventResourceClaims.mockReset();
  prisma.profile.findUnique.mockReset();
  prisma.event.findUnique.mockReset();
  prisma.event.update.mockReset();
  prisma.$transaction.mockReset();

  createSupabaseServer.mockResolvedValue({});
  ensureAuthenticated.mockResolvedValue({ id: "user-1" });
  isUnauthenticatedError.mockReturnValue(false);
  prisma.profile.findUnique.mockResolvedValue({ id: "user-1" });
  resolveGroupMemberForOrg.mockResolvedValue({ role: "OWNER", rolePack: null });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  prisma.event.findUnique.mockResolvedValue({
    id: 77,
    title: "Evento 77",
    organizationId: 12,
    startsAt: new Date("2026-03-01T10:00:00.000Z"),
    endsAt: new Date("2026-03-01T11:00:00.000Z"),
    status: "DRAFT",
    consumesResources: true,
  });
  prisma.$transaction.mockImplementation(async (fn: any) =>
    fn({
      event: { update: prisma.event.update },
    }),
  );
  syncEventResourceClaims.mockResolvedValue({ ok: true, applied: true, claimsCreated: 1, bundleId: "b1" });

  POST = (await import("@/app/api/org/[orgId]/events/publish/route")).POST;
});

describe("events publish route", () => {
  it("publica evento e sincroniza claims", async () => {
    const req = new NextRequest("http://localhost/api/org/12/events/publish", {
      method: "POST",
      headers: { "content-type": "application/json", "x-org-id": "12" },
      body: JSON.stringify({ eventId: 77 }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(syncEventResourceClaims).toHaveBeenCalledTimes(1);
  });

  it("devolve 409 quando há conflito de recursos", async () => {
    syncEventResourceClaims.mockRejectedValueOnce(
      new EventResourceClaimsError(409, "EVENT_RESOURCES_CONFLICT", "Conflito", {
        conflicts: [{ scopeType: "RESOURCE", scopeId: 10 }],
      }),
    );

    const req = new NextRequest("http://localhost/api/org/12/events/publish", {
      method: "POST",
      headers: { "content-type": "application/json", "x-org-id": "12" },
      body: JSON.stringify({ eventId: 77 }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("EVENT_RESOURCES_CONFLICT");
  });
});
