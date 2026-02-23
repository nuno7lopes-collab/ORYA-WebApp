import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("reservas route access guardrails", () => {
  it("mantém gate de módulo em rotas org sensíveis de reservas", () => {
    const invites = readLocal("app/api/org/[orgId]/reservas/[id]/invites/route.ts");
    const participants = readLocal("app/api/org/[orgId]/reservas/[id]/participants/route.ts");
    const split = readLocal("app/api/org/[orgId]/reservas/[id]/split/route.ts");
    const charges = readLocal("app/api/org/[orgId]/reservas/[id]/charges/route.ts");

    for (const content of [invites, participants, split, charges]) {
      expect(content).toContain("ensureReservasModuleAccess");
      expect(content).toContain("RESERVAS_UNAVAILABLE");
    }
  });

  it("mantém validação de escopo STAFF para operações de booking org", () => {
    const invites = readLocal("app/api/org/[orgId]/reservas/[id]/invites/route.ts");
    const participants = readLocal("app/api/org/[orgId]/reservas/[id]/participants/route.ts");
    const split = readLocal("app/api/org/[orgId]/reservas/[id]/split/route.ts");
    const charges = readLocal("app/api/org/[orgId]/reservas/[id]/charges/route.ts");

    for (const content of [invites, participants, split, charges]) {
      expect(content).toContain("ensureStaffCanAccessBooking");
      expect(content).toContain("OrganizationRolePack.COACH");
    }
  });

  it("mantém controlo de escopo STAFF nas operações de changesets", () => {
    const details = readLocal("app/api/org/[orgId]/reservas/disponibilidade/changesets/[changeSetId]/route.ts");
    const apply = readLocal("app/api/org/[orgId]/reservas/disponibilidade/changesets/[changeSetId]/apply/route.ts");
    const cancel = readLocal("app/api/org/[orgId]/reservas/disponibilidade/changesets/[changeSetId]/cancel/route.ts");
    const resolveConflict = readLocal(
      "app/api/org/[orgId]/reservas/disponibilidade/changesets/[changeSetId]/conflicts/[conflictId]/resolve/route.ts",
    );

    for (const content of [details, apply, cancel, resolveConflict]) {
      expect(content).toContain("ensureChangesetScopeAccess");
      expect(content).toContain("FORBIDDEN");
    }
  });
});
