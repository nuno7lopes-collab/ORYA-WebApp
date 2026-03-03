import { describe, expect, it } from "vitest";
import { getOrganizationRoleFlags } from "@/lib/organizationUiPermissions";

describe("organization UI permissions", () => {
  it("mantém admin com capacidades globais", () => {
    const flags = getOrganizationRoleFlags("ADMIN", null);

    expect(flags.canManageMembers).toBe(true);
    expect(flags.canViewFinance).toBe(true);
    expect(flags.canPromote).toBe(true);
    expect(flags.canEditOrg).toBe(true);
  });

  it("permite gestor de clube em marketing/financeiro, sem gestão de membros", () => {
    const flags = getOrganizationRoleFlags("STAFF", "CLUB_MANAGER");

    expect(flags.isClubManager).toBe(true);
    expect(flags.canPromote).toBe(true);
    expect(flags.canViewFinance).toBe(true);
    expect(flags.canViewOperationalSettings).toBe(true);
    expect(flags.canManageMembers).toBe(false);
  });

  it("mantém front desk sem privilégios de gestão", () => {
    const flags = getOrganizationRoleFlags("STAFF", "FRONT_DESK");

    expect(flags.isFrontDesk).toBe(true);
    expect(flags.canPromote).toBe(false);
    expect(flags.canViewFinance).toBe(false);
    expect(flags.canManageMembers).toBe(false);
  });

  it("mantém coach com acesso ao coach hub", () => {
    const flags = getOrganizationRoleFlags("STAFF", "COACH");

    expect(flags.isCoach).toBe(true);
    expect(flags.canViewCoachHub).toBe(true);
  });
});
