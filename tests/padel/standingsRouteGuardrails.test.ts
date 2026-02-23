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

  it("não aplica fallback silencioso no filtro categoryId", () => {
    const route = readLocal("app/api/padel/standings/route.ts");

    expect(route).toContain('const categoryIdParam = req.nextUrl.searchParams.get("categoryId")');
    expect(route).toContain("INVALID_CATEGORY");
    expect(route).not.toContain('const categoryId = Number(req.nextUrl.searchParams.get("categoryId"))');
  });

  it("usa error codes estáveis no catch", () => {
    const route = readLocal("app/api/padel/standings/route.ts");
    expect(route).toContain("UNAUTHENTICATED");
    expect(route).toContain("STANDINGS_FAILED");
    expect(route).toContain("message: \"Erro ao gerar standings.\"");
  });
});
