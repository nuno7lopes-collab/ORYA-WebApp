import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationStatus } from "@prisma/client";
import { getActiveOrganizationForUser, setActiveOrganizationForUser } from "@/lib/organizationContext";
import { prisma } from "@/lib/prisma";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { recordOrganizationAudit } from "@/lib/organizationAudit";

vi.mock("@/domain/outbox/producer", () => ({
  recordOutboxEvent: vi.fn(async () => ({ eventId: "evt-1" })),
}));
vi.mock("@/domain/eventLog/append", () => ({
  appendEventLog: vi.fn(async () => null),
}));

vi.mock("@/lib/organizationAudit", () => ({
  recordOrganizationAudit: vi.fn(async () => ({ id: "audit-1" })),
}));

vi.mock("@/lib/organizationGroupAccess", () => ({
  resolveGroupMemberForOrg: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const profile = {
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const organization = {
    findUnique: vi.fn(),
  };
  const organizationGroupMember = {
    findMany: vi.fn(),
  };
  const organizationGroupMemberOrganizationOverride = {
    findFirst: vi.fn(),
  };
  const prisma = {
    profile,
    organization,
    organizationGroupMember,
    organizationGroupMemberOrganizationOverride,
    $transaction: async (fn: any) => fn(prisma),
  };
  return { prisma };
});

const prismaMock = vi.mocked(prisma);
const resolveMemberMock = vi.mocked(resolveGroupMemberForOrg);
const recordOutboxMock = vi.mocked(recordOutboxEvent);
const recordAuditMock = vi.mocked(recordOrganizationAudit);

describe("organization context", () => {
  beforeEach(() => {
    resolveMemberMock.mockReset();
    recordOutboxMock.mockReset();
    recordAuditMock.mockReset();
    prismaMock.profile.findUnique.mockReset();
    prismaMock.profile.update.mockReset();
    prismaMock.organization.findUnique.mockReset();
    prismaMock.organizationGroupMember.findMany.mockReset();
    prismaMock.organizationGroupMemberOrganizationOverride.findFirst.mockReset();
    recordOutboxMock.mockResolvedValue({ eventId: "evt-1" } as any);
  });

  it("setActiveOrganizationForUser falha sem membership", async () => {
    resolveMemberMock.mockResolvedValueOnce(null);

    const result = await setActiveOrganizationForUser({ userId: "user-1", organizationId: 10 });
    expect(result.ok).toBe(false);
    expect(recordOutboxMock).not.toHaveBeenCalled();
    expect(recordAuditMock).not.toHaveBeenCalled();
  });

  it("setActiveOrganizationForUser grava outbox + audit", async () => {
    resolveMemberMock.mockResolvedValueOnce({
      memberId: "gm-1",
      groupId: 5,
      role: "ADMIN",
      rolePack: null,
    } as any);
    prismaMock.profile.findUnique.mockResolvedValueOnce({ activeOrganizationId: null } as any);

    const result = await setActiveOrganizationForUser({ userId: "user-2", organizationId: 12 });
    expect(result.ok).toBe(true);
    expect(prismaMock.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { activeOrganizationId: 12 } }),
    );
    expect(recordOutboxMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "org.context.changed" }),
      expect.anything(),
    );
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "ORG_CONTEXT_SWITCH" }),
    );
  });

  it("getActiveOrganizationForUser usa activeOrganizationId", async () => {
    prismaMock.profile.findUnique.mockResolvedValueOnce({ activeOrganizationId: 10 } as any);
    prismaMock.organization.findUnique.mockResolvedValueOnce({
      id: 10,
      status: OrganizationStatus.ACTIVE,
      groupId: 1,
    } as any);
    resolveMemberMock.mockResolvedValueOnce({
      memberId: "gm-2",
      groupId: 1,
      role: "ADMIN",
      rolePack: null,
    } as any);

    const result = await getActiveOrganizationForUser("user-3", { allowFallback: true });
    expect(result.organization?.id).toBe(10);
    expect(result.membership?.groupId).toBe(1);
  });

  it("fallback nunca devolve org fora do scope", async () => {
    prismaMock.profile.findUnique.mockResolvedValueOnce({ activeOrganizationId: null } as any);
    prismaMock.organizationGroupMember.findMany.mockResolvedValueOnce([
      {
        id: "gm-3",
        role: "ADMIN",
        rolePack: null,
        scopeAllOrgs: false,
        scopeOrgIds: [22],
        groupId: 99,
        group: {
          organizations: [
            { id: 21, status: OrganizationStatus.ACTIVE, groupId: 99 },
            { id: 22, status: OrganizationStatus.ACTIVE, groupId: 99 },
          ],
        },
      } as any,
    ]);
    prismaMock.organizationGroupMemberOrganizationOverride.findFirst.mockResolvedValue(null);

    const result = await getActiveOrganizationForUser("user-4", { allowFallback: true });
    expect(result.organization?.id).toBe(22);
  });
});
