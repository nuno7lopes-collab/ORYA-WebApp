import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("team role assignment ux guardrails", () => {
  it("mantém seleção única de função para membros e convites", () => {
    const staffPage = readLocal("app/org/_internal/core/(dashboard)/staff/page.tsx");

    expect(staffPage).toContain("function resolveRoleAssignmentValue");
    expect(staffPage).toContain("function parseRoleAssignmentValue");
    expect(staffPage).toContain("STAFF_ROLE_ASSIGNMENT_PLACEHOLDER");
    expect(staffPage).toContain("value={roleAssignmentValue}");
    expect(staffPage).toContain("value={resolveRoleAssignmentValue(inviteRole, inviteRolePack)}");
    expect(staffPage).toContain("Selecionar função da equipa");
    expect(staffPage).not.toContain("Selecionar pacote");
  });

  it("permite gerir comunidades com nível Ver/Editar sem hardcode em Editar", () => {
    const staffPage = readLocal("app/org/_internal/core/(dashboard)/staff/page.tsx");

    expect(staffPage).toContain("communityScopeDraftLevel");
    expect(staffPage).toContain("setCommunityScopeDraftLevel");
    expect(staffPage).toContain('onChange={(e) => setCommunityScopeDraftLevel(e.target.value as "VIEW" | "EDIT")}');
    expect(staffPage).toContain('"MENSAGENS",');
    expect(staffPage).toContain("communityScopeDraftLevel,");
  });

  it("mantém nomenclatura PT e sem fallback legacy em role packs", () => {
    const rolePackPolicy = readLocal("lib/organizationRolePackPolicy.ts");
    const sharedRoleBadge = readLocal("app/org/_shared/RoleBadge.tsx");
    const staffPage = readLocal("app/org/_internal/core/(dashboard)/staff/page.tsx");

    expect(rolePackPolicy).toContain('FRONT_DESK: "Receção"');
    expect(rolePackPolicy).toContain('COACH: "Treinador"');
    expect(rolePackPolicy).not.toContain("allowDefaultForLegacy");
    expect(sharedRoleBadge).toContain('STAFF: "Equipa"');
    expect(sharedRoleBadge).not.toContain('STAFF: "Colaborador"');
    expect(staffPage).toContain('OWNER_REMOVED: "Dono removido"');
    expect(staffPage).toContain("Âmbito: Todas as comunidades");
    expect(staffPage).toContain("Âmbito: Comunidade");
  });
});
