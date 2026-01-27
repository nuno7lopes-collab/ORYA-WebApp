import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const resolveGroupMemberForOrg = vi.hoisted(() => vi.fn());
const recordOrganizationAudit = vi.hoisted(() => vi.fn());
const sendOfficialEmailVerificationEmail = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  organization: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  organizationOfficialEmailRequest: {
    updateMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(async (fn: any) => fn(prisma)),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/organizationGroupAccess", () => ({ resolveGroupMemberForOrg }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAudit }));
vi.mock("@/lib/emailSender", () => ({ sendOfficialEmailVerificationEmail }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
  })),
}));

let requestPost: typeof import("@/app/api/organizacao/organizations/settings/official-email/route").POST;
let confirmPost: typeof import("@/app/api/organizacao/organizations/settings/official-email/confirm/route").POST;

beforeEach(async () => {
  vi.resetModules();
  resolveGroupMemberForOrg.mockReset();
  recordOrganizationAudit.mockReset();
  sendOfficialEmailVerificationEmail.mockReset();
  prisma.organization.findUnique.mockReset();
  prisma.organization.update.mockReset();
  prisma.organizationOfficialEmailRequest.updateMany.mockReset();
  prisma.organizationOfficialEmailRequest.create.mockReset();
  prisma.organizationOfficialEmailRequest.findUnique.mockReset();
  prisma.organizationOfficialEmailRequest.update.mockReset();
  prisma.$transaction.mockClear();
  requestPost = (await import("@/app/api/organizacao/organizations/settings/official-email/route")).POST;
  confirmPost = (await import("@/app/api/organizacao/organizations/settings/official-email/confirm/route")).POST;
});

describe("official email flow", () => {
  it("owner can request official email", async () => {
    resolveGroupMemberForOrg.mockResolvedValue({ role: "OWNER", groupId: 1, memberId: 1, userId: "u1" });
    prisma.organization.findUnique.mockResolvedValue({
      id: 1,
      officialEmail: null,
      officialEmailVerifiedAt: null,
      publicName: "Org",
      username: "org",
    });
    prisma.organizationOfficialEmailRequest.create.mockResolvedValue({
      id: 10,
      status: "PENDING",
      token: "t1",
      expiresAt: new Date("2026-01-01T00:00:00Z"),
    });

    const req = new NextRequest("http://localhost/api/organizacao/organizations/settings/official-email", {
      method: "POST",
      body: JSON.stringify({ organizationId: 1, email: "team@org.pt" }),
    });

    const res = await requestPost(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe("PENDING");
    expect(body.requestId).toBeTruthy();
    expect(body.correlationId).toBeTruthy();
  });

  it("blocks non-owner on request", async () => {
    resolveGroupMemberForOrg.mockResolvedValue({ role: "ADMIN" });
    prisma.organization.findUnique.mockResolvedValue({
      id: 1,
      officialEmail: null,
      officialEmailVerifiedAt: null,
      publicName: "Org",
      username: "org",
    });

    const req = new NextRequest("http://localhost/api/organizacao/organizations/settings/official-email", {
      method: "POST",
      body: JSON.stringify({ organizationId: 1, email: "team@org.pt" }),
    });

    const res = await requestPost(req);
    expect(res.status).toBe(403);
  });

  it("owner can confirm official email", async () => {
    resolveGroupMemberForOrg.mockResolvedValue({ role: "OWNER" });
    prisma.organizationOfficialEmailRequest.findUnique.mockResolvedValue({
      id: 11,
      organizationId: 1,
      newEmail: "team@org.pt",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 10000),
    });

    const req = new NextRequest("http://localhost/api/organizacao/organizations/settings/official-email/confirm", {
      method: "POST",
      body: JSON.stringify({ token: "token-1" }),
    });

    const res = await confirmPost(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe("VERIFIED");
    expect(body.requestId).toBeTruthy();
    expect(body.correlationId).toBeTruthy();
  });
});
