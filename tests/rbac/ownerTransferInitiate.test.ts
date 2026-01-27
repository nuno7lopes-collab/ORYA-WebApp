import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { POST } from "@/app/api/organizacao/organizations/owner/transfer/route";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  resolveGroupMemberForOrg: vi.fn(),
  resolveUserIdentifier: vi.fn(),
  recordOrganizationAudit: vi.fn(),
  recordOutboxEvent: vi.fn(),
  appendEventLog: vi.fn(),
  updateMany: vi.fn(),
  create: vi.fn(),
  transaction: vi.fn(),
  findOrganization: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: {
      findUnique: mocks.findOrganization,
    },
    organizationOwnerTransfer: {
      updateMany: mocks.updateMany,
      create: mocks.create,
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

vi.mock("@/lib/userResolver", () => ({
  resolveUserIdentifier: mocks.resolveUserIdentifier,
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

describe("owner transfer initiate", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((fn) => fn.mockReset());
  });

  it("só owner pode iniciar", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mocks.resolveGroupMemberForOrg.mockResolvedValue({ role: "ADMIN", groupId: 9 });

    const req = new Request("http://localhost/api/organizacao/organizations/owner/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: 10, targetUserId: "u2" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("cria transferência e escreve outbox/eventlog", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mocks.resolveGroupMemberForOrg.mockResolvedValue({ role: "OWNER", groupId: 9 });
    mocks.findOrganization.mockResolvedValue({
      officialEmail: "owner@org.pt",
      officialEmailVerifiedAt: new Date(),
    });
    mocks.resolveUserIdentifier.mockResolvedValue({ userId: "u2" });
    mocks.recordOutboxEvent.mockResolvedValue({ eventId: "evt-1" });
    mocks.transaction.mockImplementation(async (fn: any) =>
      fn({
        organizationOwnerTransfer: {
          updateMany: mocks.updateMany,
          create: mocks.create,
        },
      }),
    );
    mocks.create.mockResolvedValue({
      id: "tr-1",
      status: "PENDING",
      token: "tok",
      expiresAt: new Date(Date.now() + 1000),
    });

    const req = new Request("http://localhost/api/organizacao/organizations/owner/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: 10, targetUserId: "u2" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.recordOutboxEvent).toHaveBeenCalled();
    expect(mocks.appendEventLog).toHaveBeenCalled();
  });

  it("se já houver pending (P2002), falha 409", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    mocks.resolveGroupMemberForOrg.mockResolvedValue({ role: "OWNER", groupId: 9 });
    mocks.findOrganization.mockResolvedValue({
      officialEmail: "owner@org.pt",
      officialEmailVerifiedAt: new Date(),
    });
    mocks.resolveUserIdentifier.mockResolvedValue({ userId: "u2" });
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "7.2.0",
      }),
    );

    const req = new Request("http://localhost/api/organizacao/organizations/owner/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: 10, targetUserId: "u2" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});
