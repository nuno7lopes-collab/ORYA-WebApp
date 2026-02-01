import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => {
  const organization = { findUnique: vi.fn() };
  const organizationGroupMember = { findUnique: vi.fn() };
  const organizationGroupMemberOrganizationOverride = { findFirst: vi.fn() };
  return { prisma: { organization, organizationGroupMember, organizationGroupMemberOrganizationOverride } };
});

const prismaMock = vi.mocked(prisma);

describe("organization group access", () => {
  beforeEach(() => {
    prismaMock.organization.findUnique.mockReset();
    prismaMock.organizationGroupMember.findUnique.mockReset();
    prismaMock.organizationGroupMemberOrganizationOverride.findFirst.mockReset();
  });

  it("membro de filial não acede a outra filial", async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ groupId: 10 } as any);
    prismaMock.organizationGroupMember.findUnique.mockResolvedValue({
      id: "gm_1",
      role: "STAFF",
      rolePack: null,
      scopeAllOrgs: false,
      scopeOrgIds: [1],
    } as any);
    prismaMock.organizationGroupMemberOrganizationOverride.findFirst.mockResolvedValue(null as any);

    const access = await resolveGroupMemberForOrg({ organizationId: 2, userId: "u1" });
    expect(access).toBeNull();
  });

  it("role mãe com scope ALL_ORGS acede a todas as filiais", async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ groupId: 10 } as any);
    prismaMock.organizationGroupMember.findUnique.mockResolvedValue({
      id: "gm_2",
      role: "ADMIN",
      rolePack: null,
      scopeAllOrgs: true,
      scopeOrgIds: [],
    } as any);
    prismaMock.organizationGroupMemberOrganizationOverride.findFirst.mockResolvedValue(null as any);

    const access = await resolveGroupMemberForOrg({ organizationId: 99, userId: "u2" });
    expect(access?.role).toBe("ADMIN");
  });

  it("sem membership -> 403 (null)", async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ groupId: 10 } as any);
    prismaMock.organizationGroupMember.findUnique.mockResolvedValue(null as any);

    const access = await resolveGroupMemberForOrg({ organizationId: 1, userId: "u3" });
    expect(access).toBeNull();
  });

  it("override revokedAt bloqueia acesso", async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ groupId: 10 } as any);
    prismaMock.organizationGroupMember.findUnique.mockResolvedValue({
      id: "gm_3",
      role: "STAFF",
      rolePack: null,
      scopeAllOrgs: false,
      scopeOrgIds: [1],
    } as any);
    prismaMock.organizationGroupMemberOrganizationOverride.findFirst.mockResolvedValue({
      roleOverride: null,
      revokedAt: new Date(),
    } as any);

    const access = await resolveGroupMemberForOrg({ organizationId: 1, userId: "u4" });
    expect(access).toBeNull();
  });

  it("override por filial altera role efetivo", async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ groupId: 10 } as any);
    prismaMock.organizationGroupMember.findUnique.mockResolvedValue({
      id: "gm_4",
      role: "STAFF",
      rolePack: null,
      scopeAllOrgs: false,
      scopeOrgIds: [1],
    } as any);
    prismaMock.organizationGroupMemberOrganizationOverride.findFirst.mockResolvedValue({
      roleOverride: "ADMIN",
      revokedAt: null,
    } as any);

    const access = await resolveGroupMemberForOrg({ organizationId: 1, userId: "u5" });
    expect(access?.role).toBe("ADMIN");
  });
});
