import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel standings route guardrails", () => {
  it("exige permissão VIEW no módulo TORNEIOS para leitura interna", () => {
    const route = readLocal("app/api/padel/standings/route.ts");

    expect(route).toContain('ensureMemberModuleAccess');
    expect(route).toContain('moduleKey: OrganizationModule.TORNEIOS');
    expect(route).toContain('required: "VIEW"');
  });
});
