import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireUser = vi.hoisted(() => vi.fn());
const buildAgendaOverlapFilter = vi.hoisted(() => vi.fn());

const organizationGroupFindUnique = vi.hoisted(() => vi.fn());
const organizationGroupMemberFindFirst = vi.hoisted(() => vi.fn());
const organizationFindMany = vi.hoisted(() => vi.fn());
const agendaItemFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/requireUser", () => ({ requireUser }));
vi.mock("@/domain/agendaReadModel/overlap", () => ({ buildAgendaOverlapFilter }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    organizationGroup: { findUnique: organizationGroupFindUnique },
    organizationGroupMember: { findFirst: organizationGroupMemberFindFirst },
    organization: { findMany: organizationFindMany },
    agendaItem: { findMany: agendaItemFindMany },
  },
}));

import { GET } from "@/app/api/org-hub/groups/[groupId]/dashboard/agenda/route";

describe("group dashboard agenda RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireUser.mockResolvedValue({ id: "viewer-1" });
    buildAgendaOverlapFilter.mockReturnValue({});
    organizationGroupFindUnique.mockResolvedValue({ id: 7, ownerUserId: "owner-1" });
    organizationFindMany.mockResolvedValue([{ id: 1, publicName: "Top Padel", businessName: null }]);
    agendaItemFindMany.mockResolvedValue([]);
  });

  it("denies staff/non-governance users", async () => {
    organizationGroupMemberFindFirst.mockResolvedValue(null);

    const res = await GET(
      new NextRequest(
        "http://localhost/api/org-hub/groups/7/dashboard/agenda?from=2026-02-01T00:00:00.000Z&to=2026-02-07T23:59:59.000Z",
      ),
      { params: Promise.resolve({ groupId: "7" }) },
    );

    expect(res.status).toBe(403);
    expect(organizationGroupMemberFindFirst).toHaveBeenCalled();
    expect(requireUser).toHaveBeenCalled();
  });

  it("allows governance member read-only access", async () => {
    organizationGroupMemberFindFirst.mockResolvedValue({ id: "gov-1" });

    const res = await GET(
      new NextRequest(
        "http://localhost/api/org-hub/groups/7/dashboard/agenda?from=2026-02-01T00:00:00.000Z&to=2026-02-07T23:59:59.000Z",
      ),
      { params: Promise.resolve({ groupId: "7" }) },
    );

    expect(res.status).toBe(200);
    expect(organizationGroupMemberFindFirst).toHaveBeenCalled();
    expect(requireUser).toHaveBeenCalled();
  });
});
