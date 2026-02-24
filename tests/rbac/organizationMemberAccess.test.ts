import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationModule } from "@prisma/client";

const resolveGroupMemberForOrg = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  organization: { findUnique: vi.fn() },
  organizationModuleEntry: { findMany: vi.fn(), upsert: vi.fn() },
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
    prisma.organization.findUnique.mockReset();
    prisma.organizationModuleEntry.findMany.mockReset();
    prisma.organizationModuleEntry.upsert.mockReset();
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
    prisma.organization.findUnique.mockResolvedValue(null);
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

  it("recupera baseline de módulos quando organização ficou sem modules", async () => {
    resolveGroupMemberForOrg.mockResolvedValue({
      role: "OWNER",
      rolePack: null,
    });
    prisma.organization.findUnique.mockResolvedValue({
      id: 1,
      primaryModule: "EVENTOS",
    });
    prisma.organizationModuleEntry.findMany.mockResolvedValue([]);
    prisma.organizationModuleEntry.upsert.mockResolvedValue({});
    prisma.organizationMemberPermission.findMany.mockResolvedValue([]);

    const result = await ensureMemberModuleAccess({
      organizationId: 1,
      userId: "user-1",
      role: "OWNER",
      rolePack: null,
      moduleKey: OrganizationModule.ANALYTICS,
    });

    expect(result).toEqual({ ok: true });
    expect(prisma.organizationModuleEntry.upsert).toHaveBeenCalled();
  });

  it("recupera módulos core em falta quando organização tem baseline parcial", async () => {
    resolveGroupMemberForOrg.mockResolvedValue({
      role: "OWNER",
      rolePack: null,
    });
    prisma.organization.findUnique.mockResolvedValue({
      id: 1,
      primaryModule: "EVENTOS",
    });
    prisma.organizationModuleEntry.findMany.mockResolvedValue([
      { moduleKey: OrganizationModule.EVENTOS },
    ]);
    prisma.organizationModuleEntry.upsert.mockResolvedValue({});
    prisma.organizationMemberPermission.findMany.mockResolvedValue([]);

    const result = await ensureMemberModuleAccess({
      organizationId: 1,
      userId: "user-1",
      role: "OWNER",
      rolePack: null,
      moduleKey: OrganizationModule.ANALYTICS,
    });

    expect(result).toEqual({ ok: true });
    expect(prisma.organizationModuleEntry.upsert).toHaveBeenCalled();
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
