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

  it("accepts COACH pack for STAFF", () => {
    const result = resolveRolePackForRole({
      role: OrganizationMemberRole.STAFF,
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

  it("rejects invalid rolePack raw value for STAFF", () => {
    const result = resolveRolePackForRole({
      role: OrganizationMemberRole.STAFF,
      rolePackRaw: "frontdesk",
      rolePackProvided: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("INVALID_ROLE_PACK");
    }
  });
});
