import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createOrganizationAtomic = vi.hoisted(() => vi.fn());
const listEffectiveOrganizationMembershipsForUser = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  profile: { findUnique: vi.fn() },
  organizationModuleEntry: { findMany: vi.fn() },
}));

vi.mock("@/lib/domain/groupGovernance", () => ({ createOrganizationAtomic }));
vi.mock("@/lib/organizationMembers", () => ({ listEffectiveOrganizationMembershipsForUser }));
vi.mock("@/lib/prisma", () => ({ prisma }));

import { POST } from "@/app/api/org-hub/organizations/route";

describe("org-hub organizations create route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates existing group selection", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/org-hub/organizations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessName: "Org Nova",
          username: "orgnova",
          primaryModule: "EVENTOS",
          tools: ["EVENTOS"],
          groupMode: "EXISTING_GROUP",
        }),
      }),
    );

    expect(res.status).toBe(422);
    expect(createOrganizationAtomic).not.toHaveBeenCalled();
  });

  it("maps GROUP_ACCESS_DENIED to 403", async () => {
    createOrganizationAtomic.mockRejectedValue(new Error("GROUP_ACCESS_DENIED"));

    const res = await POST(
      new NextRequest("http://localhost/api/org-hub/organizations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessName: "Org Nova",
          username: "orgnova",
          primaryModule: "EVENTOS",
          tools: ["EVENTOS"],
          groupMode: "EXISTING_GROUP",
          existingGroupId: 44,
        }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("forwards existingGroupId to domain create", async () => {
    createOrganizationAtomic.mockResolvedValue({
      id: 321,
      publicName: "Org Nova",
      username: "orgnova",
      businessName: "Org Nova",
      entityType: null,
      addressId: null,
      primaryModule: "EVENTOS",
    });

    const res = await POST(
      new NextRequest("http://localhost/api/org-hub/organizations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessName: "Org Nova",
          username: "orgnova",
          primaryModule: "EVENTOS",
          tools: ["EVENTOS"],
          groupMode: "EXISTING_GROUP",
          existingGroupId: 44,
        }),
      }),
    );

    expect(res.status).toBe(201);
    expect(createOrganizationAtomic).toHaveBeenCalledWith(
      expect.objectContaining({
        existingGroupId: 44,
        primaryModule: "TORNEIOS",
        organizationKind: "CLUBE_PADEL",
      }),
    );
  });
});
