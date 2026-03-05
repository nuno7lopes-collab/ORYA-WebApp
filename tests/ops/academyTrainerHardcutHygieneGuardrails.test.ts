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
    const classHandlers = readLocal("lib/academy/classesHandlers.ts");
    const classSeriesHandlers = readLocal("lib/academy/classSeriesHandlers.ts");

    for (const content of [classHandlers, classSeriesHandlers]) {
      expect(content).toContain("assertTrainerIdsBelongToEligibleTeamMembers");
      expect(content).toContain("TRAINER_NOT_TEAM_MEMBER");
    }
  });

  it("mantém rotas academy/classes, academy/students e academy/enrollments sem bridge direta para legado", () => {
    const classesRoute = readLocal("app/api/org/[orgId]/academy/classes/route.ts");
    const classRoute = readLocal("app/api/org/[orgId]/academy/classes/[classId]/route.ts");
    const classSeriesRoute = readLocal("app/api/org/[orgId]/academy/classes/[classId]/series/route.ts");
    const classSeriesItemRoute = readLocal("app/api/org/[orgId]/academy/classes/[classId]/series/[seriesId]/route.ts");
    const classSessionsRoute = readLocal("app/api/org/[orgId]/academy/classes/[classId]/sessions/route.ts");
    const studentsRoute = readLocal("app/api/org/[orgId]/academy/students/route.ts");
    const resourcesRoute = readLocal("app/api/org/[orgId]/academy/resources/route.ts");
    const sessionEnrollmentsRoute = readLocal("app/api/org/[orgId]/academy/sessions/[sessionId]/enrollments/route.ts");
    const sessionEnrollmentRoute = readLocal(
      "app/api/org/[orgId]/academy/sessions/[sessionId]/enrollments/[enrollmentId]/route.ts",
    );
    for (const content of [
      classesRoute,
      classRoute,
      classSeriesRoute,
      classSeriesItemRoute,
      classSessionsRoute,
      studentsRoute,
      resourcesRoute,
      sessionEnrollmentsRoute,
      sessionEnrollmentRoute,
    ]) {
      expect(content).not.toContain("/servicos/");
      expect(content).not.toContain("/reservas/clientes");
      expect(content).not.toContain("/api/org/[orgId]/reservas");
      expect(content).not.toContain("/api/org/${access.organization.id}/reservas");
      expect(content).not.toContain("x-orya-academy-bridge");
    }

    const classDetailPage = readLocal("app/org/[orgId]/academy/classes/[id]/AcademyClassDetailPage.tsx");
    const academyClassesPage = readLocal("app/org/[orgId]/academy/classes/page.tsx");
    const academyClassCreatePage = readLocal("app/org/[orgId]/academy/classes/new/page.tsx");
    const academyTrainersPage = readLocal("app/org/[orgId]/academy/trainers/page.tsx");
    const academyStudentsPage = readLocal("app/org/[orgId]/academy/students/page.tsx");
    expect(classDetailPage).not.toContain("/servicos/");
    expect(classDetailPage).toContain("/api/org/[orgId]/academy/resources?includeCourts=1");
    expect(classDetailPage).not.toContain("/api/org/[orgId]/reservas/recursos");
    expect(academyClassCreatePage).toContain("/api/org/[orgId]/academy/resources?includeCourts=1");
    expect(academyClassCreatePage).not.toContain("/api/org/[orgId]/reservas/recursos");

    for (const content of [academyClassesPage, academyClassCreatePage, academyTrainersPage, academyStudentsPage]) {
      expect(content).not.toContain('export { default } from "@/app/org/_internal/core/(dashboard)/reservas');
      expect(content).not.toContain("/_internal/core/(dashboard)/reservas/");
    }
  });

  it("mantém criação de aulas no Padel Hub via endpoints canónicos Academy", () => {
    const padelHubClient = readLocal("app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx");
    expect(padelHubClient).toContain('buildOrgApiPath("/academy/classes")');
    expect(padelHubClient).toContain("/academy/classes/${serviceId}/series");
    expect(padelHubClient).not.toContain('buildOrgApiPath("/servicos")');
    expect(padelHubClient).not.toContain("/servicos/${serviceId}/class-series");
  });
});
