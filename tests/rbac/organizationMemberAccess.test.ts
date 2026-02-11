import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationModule } from "@prisma/client";

const resolveGroupMemberForOrg = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  organizationModuleEntry: { findMany: vi.fn() },
  organizationMemberPermission: { findMany: vi.fn() },
}));

vi.mock("@/lib/organizationGroupAccess", () => ({ resolveGroupMemberForOrg }));
vi.mock("@/lib/prisma", () => ({ prisma }));

import {
  ensureGroupMemberModuleAccess,
  ensureMemberModuleAccess,
} from "@/lib/organizationMemberAccess";

describe("organizationMemberAccess", () => {
  beforeEach(() => {
    resolveGroupMemberForOrg.mockReset();
    prisma.organizationModuleEntry.findMany.mockReset();
    prisma.organizationMemberPermission.findMany.mockReset();
  });

  it("nega acesso quando não há membership", async () => {
    resolveGroupMemberForOrg.mockResolvedValue(null);

    const result = await ensureMemberModuleAccess({
      organizationId: 1,
      userId: "user-1",
      role: "OWNER",
      rolePack: null,
      moduleKey: OrganizationModule.EVENTOS,
    });

    expect(result).toEqual({ ok: false, error: "Sem permissoes." });
    expect(prisma.organizationModuleEntry.findMany).not.toHaveBeenCalled();
  });

  it("nega acesso quando módulo está desativado mesmo com role OWNER", async () => {
    resolveGroupMemberForOrg.mockResolvedValue({
      role: "OWNER",
      rolePack: null,
    });
    prisma.organizationModuleEntry.findMany.mockResolvedValue([]);

    const result = await ensureMemberModuleAccess({
      organizationId: 1,
      userId: "user-1",
      role: "OWNER",
      rolePack: null,
      moduleKey: OrganizationModule.EVENTOS,
    });

    expect(result).toEqual({ ok: false, error: "Sem permissoes." });
    expect(prisma.organizationMemberPermission.findMany).not.toHaveBeenCalled();
  });

  it("permite acesso quando membership existe e módulo está ativo", async () => {
    resolveGroupMemberForOrg.mockResolvedValue({
      role: "OWNER",
      rolePack: null,
    });
    prisma.organizationModuleEntry.findMany.mockResolvedValue([
      { moduleKey: OrganizationModule.EVENTOS },
    ]);
    prisma.organizationMemberPermission.findMany.mockResolvedValue([]);

    const result = await ensureMemberModuleAccess({
      organizationId: 1,
      userId: "user-1",
      role: "OWNER",
      rolePack: null,
      moduleKey: OrganizationModule.EVENTOS,
    });

    expect(result).toEqual({ ok: true });
  });

  it("ensureGroupMemberModuleAccess devolve membership quando permitido", async () => {
    const membership = { role: "ADMIN", rolePack: null };
    prisma.organizationModuleEntry.findMany.mockResolvedValue([
      { moduleKey: OrganizationModule.EVENTOS },
    ]);
    prisma.organizationMemberPermission.findMany.mockResolvedValue([]);

    const result = await ensureGroupMemberModuleAccess({
      organizationId: 1,
      userId: "user-1",
      membership,
      moduleKey: OrganizationModule.EVENTOS,
    });

    expect(result).toEqual({ ok: true, membership });
    expect(resolveGroupMemberForOrg).not.toHaveBeenCalled();
  });
});
