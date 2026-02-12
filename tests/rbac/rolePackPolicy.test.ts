import { describe, expect, it } from "vitest";
import { OrganizationMemberRole, OrganizationRolePack } from "@prisma/client";
import { resolveRolePackForRole } from "@/lib/organizationRolePackPolicy";

describe("organization role pack policy", () => {
  it("requires rolePack for STAFF", () => {
    const result = resolveRolePackForRole({
      role: OrganizationMemberRole.STAFF,
      rolePackRaw: null,
      rolePackProvided: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("ROLE_PACK_REQUIRED");
    }
  });

  it("rejects incompatible rolePack", () => {
    const result = resolveRolePackForRole({
      role: OrganizationMemberRole.STAFF,
      rolePackRaw: OrganizationRolePack.COACH,
      rolePackProvided: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("ROLE_PACK_INCOMPATIBLE");
    }
  });

  it("accepts TRAINER with COACH pack", () => {
    const result = resolveRolePackForRole({
      role: OrganizationMemberRole.TRAINER,
      rolePackRaw: OrganizationRolePack.COACH,
      rolePackProvided: true,
    });
    expect(result).toEqual({
      ok: true,
      rolePack: OrganizationRolePack.COACH,
      usedDefault: false,
    });
  });

  it("rejects pack for ADMIN", () => {
    const result = resolveRolePackForRole({
      role: OrganizationMemberRole.ADMIN,
      rolePackRaw: OrganizationRolePack.FRONT_DESK,
      rolePackProvided: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("ROLE_PACK_NOT_ALLOWED");
    }
  });

  it("uses default legacy pack when enabled", () => {
    const result = resolveRolePackForRole({
      role: OrganizationMemberRole.STAFF,
      rolePackRaw: null,
      rolePackProvided: false,
      allowDefaultForLegacy: true,
    });
    expect(result).toEqual({
      ok: true,
      rolePack: OrganizationRolePack.FRONT_DESK,
      usedDefault: true,
    });
  });
});
