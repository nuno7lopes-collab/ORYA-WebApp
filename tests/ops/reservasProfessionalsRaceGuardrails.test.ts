import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("reservas professionals race guardrails", () => {
  it("mantém lógica canónica em academy/trainers e hard-cut 410 nas rotas legacy", () => {
    const academyHandlers = readLocal("lib/academy/trainersHandlers.ts");
    const legacyListRoute = readLocal("app/api/org/[orgId]/reservas/profissionais/route.ts");
    const legacyDetailRoute = readLocal("app/api/org/[orgId]/reservas/profissionais/[id]/route.ts");
    const padelCoachesRoute = readLocal("app/api/org/[orgId]/padel/coaches/route.ts");
    const padelCoachesProfileRoute = readLocal("app/api/org/[orgId]/padel/coaches/profile/route.ts");

    expect(academyHandlers).not.toContain("reservationProfessional.upsert");
    expect(academyHandlers).toContain("TRAINER_PROFILE_MANAGED_BY_TEAM");
    expect(academyHandlers).toContain("TRAINER_ROLE_NOT_ELIGIBLE");
    expect(academyHandlers).toContain("runAcademyTrainerHardCutHygiene");
    expect(academyHandlers).toContain("syncTrainerProfileLink");
    expect(academyHandlers).toContain("trainerProfile.upsert");
    expect(academyHandlers).toContain("trainerProfile.deleteMany");
    expect(academyHandlers).toContain("code === \"P2002\"");
    expect(academyHandlers).toContain("PROFESSIONAL_EXISTS");

    for (const legacyRoute of [
      legacyListRoute,
      legacyDetailRoute,
      padelCoachesRoute,
      padelCoachesProfileRoute,
    ]) {
      expect(legacyRoute).toContain("ACADEMY_LEGACY_GONE");
      expect(legacyRoute).toContain("status: 410");
      expect(legacyRoute).not.toContain("prisma.");
    }

    expect(legacyListRoute).not.toContain("handleAcademyTrainersGet");
    expect(legacyListRoute).not.toContain("handleAcademyTrainersPost");
    expect(legacyDetailRoute).not.toContain("handleAcademyTrainerPatch");
    expect(legacyDetailRoute).not.toContain("handleAcademyTrainerDelete");
    expect(padelCoachesRoute).not.toContain("trainerProfile.delete");
    expect(padelCoachesRoute).not.toContain("reservationProfessional.deleteMany");
  });
});
