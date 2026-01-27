import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/organizacao/organizations/owner/confirm/route";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  getUser: vi.fn(),
  resolveGroupMemberForOrg: vi.fn(),
  setSoleOwner: vi.fn(),
  recordOrganizationAudit: vi.fn(),
  recordOutboxEvent: vi.fn(),
  appendEventLog: vi.fn(),
  orgFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationOwnerTransfer: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
    organization: {
      findUnique: mocks.orgFindUnique,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: () => ({
    auth: { getUser: mocks.getUser },
  }),
}));

vi.mock("@/lib/platformSettings", () => ({
  getOrgTransferEnabled: () => true,
}));

vi.mock("@/lib/organizationGroupAccess", () => ({
  resolveGroupMemberForOrg: mocks.resolveGroupMemberForOrg,
}));

vi.mock("@/lib/organizationRoles", () => ({
  setSoleOwner: mocks.setSoleOwner,
}));

vi.mock("@/lib/organizationAudit", () => ({
  recordOrganizationAudit: mocks.recordOrganizationAudit,
}));

vi.mock("@/domain/outbox/producer", () => ({
  recordOutboxEvent: mocks.recordOutboxEvent,
}));

vi.mock("@/domain/eventLog/append", () => ({
  appendEventLog: mocks.appendEventLog,
}));

describe("owner transfer confirm", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  it("idempotente: se já confirmado, responde OK sem update", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mocks.findUnique.mockResolvedValue({
      id: "tr_1",
      status: "CONFIRMED",
      toUserId: "u1",
    });
    mocks.orgFindUnique.mockResolvedValue({
      officialEmail: "owner@org.pt",
      officialEmailVerifiedAt: new Date(),
    });

    const req = new Request("http://localhost/api/organizacao/organizations/owner/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "tok" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("confirma transferência e escreve outbox/eventlog", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u2" } }, error: null });
    mocks.findUnique.mockResolvedValue({
      id: "tr_2",
      status: "PENDING",
      token: "tok2",
      organizationId: 10,
      fromUserId: "u1",
      toUserId: "u2",
      expiresAt: new Date(Date.now() + 10000),
    });
    mocks.resolveGroupMemberForOrg.mockResolvedValue({ role: "OWNER", groupId: 99 });
    mocks.orgFindUnique
      .mockResolvedValueOnce({
        officialEmail: "owner@org.pt",
        officialEmailVerifiedAt: new Date(),
      })
      .mockResolvedValueOnce({ id: 10, publicName: "Org", username: "org", groupId: 99 });
    mocks.recordOutboxEvent.mockResolvedValue({ eventId: "evt-1" });
    mocks.transaction.mockImplementation(async (fn: any) =>
      fn({
        organizationOwnerTransfer: { update: mocks.update },
        organization: { findUnique: mocks.orgFindUnique },
      }),
    );

    const req = new Request("http://localhost/api/organizacao/organizations/owner/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "tok2" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.update).toHaveBeenCalled();
    expect(mocks.recordOutboxEvent).toHaveBeenCalled();
    expect(mocks.appendEventLog).toHaveBeenCalled();
  });

  it("expira transferência e escreve outbox/eventlog", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u2" } }, error: null });
    mocks.findUnique.mockResolvedValue({
      id: "tr_3",
      status: "PENDING",
      token: "tok3",
      organizationId: 10,
      fromUserId: "u1",
      toUserId: "u2",
      expiresAt: new Date(Date.now() - 1000),
    });
    mocks.orgFindUnique.mockResolvedValue({
      officialEmail: "owner@org.pt",
      officialEmailVerifiedAt: new Date(),
    });
    mocks.recordOutboxEvent.mockResolvedValue({ eventId: "evt-exp" });
    mocks.transaction.mockImplementation(async (fn: any) =>
      fn({
        organizationOwnerTransfer: { update: mocks.update },
      }),
    );

    const req = new Request("http://localhost/api/organizacao/organizations/owner/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "tok3" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mocks.recordOutboxEvent).toHaveBeenCalled();
    expect(mocks.appendEventLog).toHaveBeenCalled();
  });
});
