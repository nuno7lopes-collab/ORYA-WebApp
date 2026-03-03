import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("academy trainer hard-cut hygiene guardrails", () => {
  it("mantém endpoint dedicado de higienização para admins", () => {
    const route = readLocal("app/api/org/[orgId]/academy/hygiene/route.ts");
    expect(route).toContain("runAcademyTrainerHardCutHygiene");
    expect(route).toContain("OrganizationMemberRole.OWNER");
    expect(route).toContain("OrganizationMemberRole.CO_OWNER");
    expect(route).toContain("OrganizationMemberRole.ADMIN");
    expect(route).toContain("resolveAcademyOrgAccess");
  });

  it("bloqueia associação de treinadores fora da equipa nas mutações Academy", () => {
    const classCreate = readLocal("app/api/org/[orgId]/academy/classes/route.ts");
    const classUpdate = readLocal("app/api/org/[orgId]/academy/classes/[classId]/route.ts");
    const seriesCreate = readLocal("app/api/org/[orgId]/academy/classes/[classId]/series/route.ts");
    const seriesUpdate = readLocal("app/api/org/[orgId]/academy/classes/[classId]/series/[seriesId]/route.ts");

    for (const content of [classCreate, classUpdate, seriesCreate, seriesUpdate]) {
      expect(content).toContain("assertTrainerIdsBelongToEligibleTeamMembers");
      expect(content).toContain("TRAINER_NOT_TEAM_MEMBER");
    }
  });
});
