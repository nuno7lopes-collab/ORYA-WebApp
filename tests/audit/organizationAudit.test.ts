import { describe, expect, it, vi } from "vitest";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => {
  const organizationAuditLog = {
    create: vi.fn(async ({ data }: any) => data),
  };
  const prisma = { organizationAuditLog };
  return { prisma };
});

const prismaMock = vi.mocked(prisma);

describe("organization audit", () => {
  it("grava campos de grupo/entidade/correlation", async () => {
    await recordOrganizationAudit(prismaMock as any, {
      organizationId: 10,
      groupId: 5,
      actorUserId: "user-1",
      action: "ORG_CONTEXT_SWITCH",
      entityType: "organization_context",
      entityId: "10",
      correlationId: "corr-1",
      metadata: { from: 1, to: 10 },
      ip: "127.0.0.1",
      userAgent: "test",
    });

    expect(prismaMock.organizationAuditLog["create"]).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 10,
          groupId: 5,
          action: "ORG_CONTEXT_SWITCH",
          entityType: "organization_context",
          entityId: "10",
          correlationId: "corr-1",
        }),
      }),
    );
  });
});
