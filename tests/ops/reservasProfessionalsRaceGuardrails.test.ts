import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("reservas professionals race guardrails", () => {
  it("mantém lógica canónica em academy/trainers e route legacy apenas como adapter", () => {
    const academyHandlers = readLocal("lib/academy/trainersHandlers.ts");
    const legacyListRoute = readLocal("app/api/org/[orgId]/reservas/profissionais/route.ts");
    const legacyDetailRoute = readLocal("app/api/org/[orgId]/reservas/profissionais/[id]/route.ts");
    const padelCoachesRoute = readLocal("app/api/org/[orgId]/padel/coaches/route.ts");

    expect(academyHandlers).not.toContain("reservationProfessional.upsert");
    expect(academyHandlers).toContain("TRAINER_PROFILE_MANAGED_BY_TEAM");
    expect(academyHandlers).toContain("TRAINER_ROLE_NOT_ELIGIBLE");
    expect(academyHandlers).toContain("runAcademyTrainerHardCutHygiene");
    expect(academyHandlers).toContain("syncTrainerProfileLink");
    expect(academyHandlers).toContain("trainerProfile.upsert");
    expect(academyHandlers).toContain("trainerProfile.deleteMany");
    expect(academyHandlers).toContain("code === \"P2002\"");
    expect(academyHandlers).toContain("PROFESSIONAL_EXISTS");

    expect(legacyListRoute).toContain("handleAcademyTrainersGet");
    expect(legacyListRoute).toContain("handleAcademyTrainersPost");
    expect(legacyListRoute).not.toContain("prisma.");
    expect(legacyListRoute).not.toContain("runAcademyTrainerHardCutHygiene");

    expect(legacyDetailRoute).toContain("handleAcademyTrainerPatch");
    expect(legacyDetailRoute).toContain("handleAcademyTrainerDelete");
    expect(legacyDetailRoute).not.toContain("prisma.");

    expect(padelCoachesRoute).toContain("trainerProfile.delete");
    expect(padelCoachesRoute).toContain("reservationProfessional.deleteMany");
  });
});
