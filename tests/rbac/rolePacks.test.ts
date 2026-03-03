import { describe, expect, it } from "vitest";
import {
  accessLevelSatisfies,
  hasModuleAccess,
  resolveCheckinAccess,
  resolveMemberModuleAccess,
} from "@/lib/organizationRbac";
import {
  OrganizationMemberRole,
  OrganizationModule,
  OrganizationRolePack,
} from "@prisma/client";

describe("role packs v8", () => {
  it("club manager scopes", () => {
    const access = resolveMemberModuleAccess({
      role: OrganizationMemberRole.STAFF,
      rolePack: OrganizationRolePack.CLUB_MANAGER,
      overrides: [],
    });

    expect(hasModuleAccess(access, OrganizationModule.RESERVAS, "EDIT")).toBe(true);
    expect(hasModuleAccess(access, OrganizationModule.TORNEIOS, "EDIT")).toBe(true);
    expect(hasModuleAccess(access, OrganizationModule.INSCRICOES, "EDIT")).toBe(true);
    expect(hasModuleAccess(access, OrganizationModule.CRM, "EDIT")).toBe(true);
    expect(hasModuleAccess(access, OrganizationModule.MARKETING, "EDIT")).toBe(true);
    expect(hasModuleAccess(access, OrganizationModule.MENSAGENS, "EDIT")).toBe(true);
    expect(hasModuleAccess(access, OrganizationModule.STAFF, "VIEW")).toBe(true);
    expect(hasModuleAccess(access, OrganizationModule.DEFINICOES, "VIEW")).toBe(true);
    expect(hasModuleAccess(access, OrganizationModule.FINANCEIRO, "VIEW")).toBe(true);
    expect(hasModuleAccess(access, OrganizationModule.ANALYTICS, "VIEW")).toBe(true);
    expect(hasModuleAccess(access, OrganizationModule.EVENTOS, "EDIT")).toBe(true);
  });

  it("tournament director scopes", () => {
    const access = resolveMemberModuleAccess({
      role: OrganizationMemberRole.STAFF,
      rolePack: OrganizationRolePack.TOURNAMENT_DIRECTOR,
      overrides: [],
    });

    expect(hasModuleAccess(access, OrganizationModule.TORNEIOS, "EDIT")).toBe(true);
    expect(hasModuleAccess(access, OrganizationModule.INSCRICOES, "EDIT")).toBe(true);
    expect(hasModuleAccess(access, OrganizationModule.RESERVAS, "VIEW")).toBe(true);
    expect(hasModuleAccess(access, OrganizationModule.RESERVAS, "EDIT")).toBe(false);
    expect(hasModuleAccess(access, OrganizationModule.MENSAGENS, "EDIT")).toBe(true);
    expect(hasModuleAccess(access, OrganizationModule.CRM, "VIEW")).toBe(true);
    expect(hasModuleAccess(access, OrganizationModule.EVENTOS, "EDIT")).toBe(true);
  });

  it("front desk checkin access", () => {
    const access = resolveCheckinAccess({
      role: OrganizationMemberRole.STAFF,
      rolePack: OrganizationRolePack.FRONT_DESK,
    });

    expect(accessLevelSatisfies(access, "EDIT")).toBe(true);
  });

  it("coach checkin is view-only", () => {
    const access = resolveCheckinAccess({
      role: OrganizationMemberRole.STAFF,
      rolePack: OrganizationRolePack.COACH,
    });

    expect(access).toBe("VIEW");
    expect(accessLevelSatisfies(access, "EDIT")).toBe(false);
  });

  it("referee checkin is view-only", () => {
    const access = resolveCheckinAccess({
      role: OrganizationMemberRole.STAFF,
      rolePack: OrganizationRolePack.REFEREE,
    });

    expect(access).toBe("VIEW");
    expect(accessLevelSatisfies(access, "EDIT")).toBe(false);
  });

  it("role pack overrides base role access", () => {
    const access = resolveMemberModuleAccess({
      role: OrganizationMemberRole.ADMIN,
      rolePack: OrganizationRolePack.FRONT_DESK,
      overrides: [],
    });

    expect(hasModuleAccess(access, OrganizationModule.FINANCEIRO, "VIEW")).toBe(true);
  });

  it("staff without pack cannot edit events", () => {
    const access = resolveMemberModuleAccess({
      role: OrganizationMemberRole.STAFF,
      rolePack: null,
      overrides: [],
    });
    const checkin = resolveCheckinAccess({
      role: OrganizationMemberRole.STAFF,
      rolePack: null,
    });

    expect(hasModuleAccess(access, OrganizationModule.EVENTOS, "EDIT")).toBe(false);
    expect(accessLevelSatisfies(checkin, "EDIT")).toBe(false);
  });

  it("staff with club manager pack can edit events", () => {
    const access = resolveMemberModuleAccess({
      role: OrganizationMemberRole.STAFF,
      rolePack: OrganizationRolePack.CLUB_MANAGER,
      overrides: [],
    });

    expect(hasModuleAccess(access, OrganizationModule.EVENTOS, "EDIT")).toBe(true);
  });

  it("staff with explicit event scopes can edit events", () => {
    const access = resolveMemberModuleAccess({
      role: OrganizationMemberRole.STAFF,
      rolePack: null,
      overrides: [{ moduleKey: OrganizationModule.EVENTOS, accessLevel: "EDIT" }],
    });

    expect(hasModuleAccess(access, OrganizationModule.EVENTOS, "EDIT")).toBe(true);
  });

  it("staff with club manager pack can edit torneios and reservas", () => {
    const access = resolveMemberModuleAccess({
      role: OrganizationMemberRole.STAFF,
      rolePack: OrganizationRolePack.CLUB_MANAGER,
      overrides: [],
    });

    expect(hasModuleAccess(access, OrganizationModule.TORNEIOS, "EDIT")).toBe(true);
    expect(hasModuleAccess(access, OrganizationModule.RESERVAS, "EDIT")).toBe(true);
  });

  it("admin and owner can edit events without pack", () => {
    const adminAccess = resolveMemberModuleAccess({
      role: OrganizationMemberRole.ADMIN,
      rolePack: null,
      overrides: [],
    });
    const ownerAccess = resolveMemberModuleAccess({
      role: OrganizationMemberRole.OWNER,
      rolePack: null,
      overrides: [],
    });

    expect(hasModuleAccess(adminAccess, OrganizationModule.EVENTOS, "EDIT")).toBe(true);
    expect(hasModuleAccess(ownerAccess, OrganizationModule.EVENTOS, "EDIT")).toBe(true);
  });
});
