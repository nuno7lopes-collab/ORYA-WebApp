import { describe, expect, it } from "vitest";
import {
  hasModuleAccess,
  resolveCheckinAccess,
  resolveMemberModuleAccess,
} from "@/lib/organizationRbac";
import { OrganizationMemberRole, OrganizationModule, OrganizationRolePack } from "@prisma/client";

describe("rbac access matrix v10", () => {
  it("owner/co-owner/admin can edit core modules", () => {
    const roles = [
      OrganizationMemberRole.OWNER,
      OrganizationMemberRole.CO_OWNER,
      OrganizationMemberRole.ADMIN,
    ];

    roles.forEach((role) => {
      const access = resolveMemberModuleAccess({ role, rolePack: null, overrides: [] });
      expect(hasModuleAccess(access, OrganizationModule.EVENTOS, "EDIT")).toBe(true);
      expect(hasModuleAccess(access, OrganizationModule.FINANCEIRO, "EDIT")).toBe(true);
      expect(hasModuleAccess(access, OrganizationModule.RESERVAS, "EDIT")).toBe(true);
      expect(hasModuleAccess(access, OrganizationModule.DEFINICOES, "EDIT")).toBe(true);
    });
  });

  it("staff has limited access by default", () => {
    const access = resolveMemberModuleAccess({
      role: OrganizationMemberRole.STAFF,
      rolePack: null,
      overrides: [],
    });
    expect(hasModuleAccess(access, OrganizationModule.EVENTOS, "VIEW")).toBe(true);
    expect(hasModuleAccess(access, OrganizationModule.EVENTOS, "EDIT")).toBe(false);
    expect(hasModuleAccess(access, OrganizationModule.FINANCEIRO, "VIEW")).toBe(false);
    expect(hasModuleAccess(access, OrganizationModule.DEFINICOES, "VIEW")).toBe(false);
  });

  it("front desk pack enables check-in and reservas", () => {
    const access = resolveMemberModuleAccess({
      role: OrganizationMemberRole.STAFF,
      rolePack: OrganizationRolePack.FRONT_DESK,
      overrides: [],
    });
    const checkin = resolveCheckinAccess({
      role: OrganizationMemberRole.STAFF,
      rolePack: OrganizationRolePack.FRONT_DESK,
    });
    expect(hasModuleAccess(access, OrganizationModule.RESERVAS, "EDIT")).toBe(true);
    expect(hasModuleAccess(access, OrganizationModule.EVENTOS, "VIEW")).toBe(true);
    expect(checkin).toBe("EDIT");
  });
});
