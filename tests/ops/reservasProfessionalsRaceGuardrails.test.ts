import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("reservas professionals race guardrails", () => {
  it("não auto-provisiona staff via GET e mantém hard-cut de equipa no POST", () => {
    const route = readLocal("app/api/org/[orgId]/reservas/profissionais/route.ts");

    expect(route).not.toContain("reservationProfessional.upsert");
    expect(route).toContain("TRAINER_PROFILE_MANAGED_BY_TEAM");
    expect(route).toContain("TRAINER_ROLE_NOT_ELIGIBLE");
    expect(route).toContain("runAcademyTrainerHardCutHygiene");
    expect(route).toContain("code === \"P2002\"");
    expect(route).toContain("PROFESSIONAL_EXISTS");
  });
});
