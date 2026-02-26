import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("reservas scope consistency guardrails", () => {
  it("usa helper único para allowedProfessionalIds/allowedResourceIds nas rotas críticas", () => {
    const files = [
      "app/api/servicos/[id]/route.ts",
      "app/api/servicos/[id]/calendario/route.ts",
      "app/api/servicos/[id]/reservar/route.ts",
      "app/api/servicos/list/route.ts",
      "app/api/org/[orgId]/reservas/route.ts",
      "app/api/org/[orgId]/reservas/[id]/reschedule/route.ts",
      "app/api/me/reservas/[id]/reschedule/route.ts",
    ];

    for (const pathname of files) {
      const content = readLocal(pathname);
      expect(content).toContain("resolveAllowedServiceScopeIds");
    }
  });

  it("remove bypass legado de links de recursos em reagendamento", () => {
    const orgReschedule = readLocal("app/api/org/[orgId]/reservas/[id]/reschedule/route.ts");
    const meReschedule = readLocal("app/api/me/reservas/[id]/reschedule/route.ts");

    for (const content of [orgReschedule, meReschedule]) {
      expect(content).not.toContain("allowedCourtIdsFromService");
      expect(content).not.toContain("enforceServiceResourceLinks");
    }
  });

  it("usa helper comum de conflito de agenda nas rotas de create/reschedule", () => {
    const orgCreate = readLocal("app/api/org/[orgId]/reservas/route.ts");
    const orgReschedule = readLocal("app/api/org/[orgId]/reservas/[id]/reschedule/route.ts");
    const meReschedule = readLocal("app/api/me/reservas/[id]/reschedule/route.ts");

    for (const content of [orgCreate, orgReschedule, meReschedule]) {
      expect(content).toContain("agendaConflictHelpers");
      expect(content).toContain("buildBookingConflictBlocks");
      expect(content).toContain("buildSessionConflictBlocks");
      expect(content).toContain("agendaConflictResponse");
      expect(content).not.toContain("function buildBlocks(");
      expect(content).not.toContain("function buildSessionBlocks(");
    }
  });
});
