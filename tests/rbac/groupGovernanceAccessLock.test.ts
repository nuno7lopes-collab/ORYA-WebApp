import { beforeEach, describe, expect, it, vi } from "vitest";

const organizationFindUnique = vi.hoisted(() => vi.fn());
const organizationGroupMemberFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: { findUnique: organizationFindUnique },
    organizationGroupMember: {
      findFirst: organizationGroupMemberFindFirst,
      update: vi.fn(),
      delete: vi.fn(),
    },
    organizationGroupMemberOrganizationOverride: {
      updateMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { revokeGroupMemberForOrg } from "@/lib/organizationGroupAccess";

describe("group governance access lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    organizationFindUnique.mockResolvedValue({ groupId: 10 });
  });

  it("throws GROUP_GOVERNANCE_LOCKED when revoking governance member by org", async () => {
    organizationGroupMemberFindFirst.mockResolvedValue({
      id: "gm-1",
      scopeAllOrgs: true,
      scopeOrgIds: [],
      isGovernance: true,
    });

    await expect(
      revokeGroupMemberForOrg({ organizationId: 5, userId: "u-1" }),
    ).rejects.toThrow("GROUP_GOVERNANCE_LOCKED");
    expect(organizationFindUnique).toHaveBeenCalled();
    expect(organizationGroupMemberFindFirst).toHaveBeenCalled();
  });
});
