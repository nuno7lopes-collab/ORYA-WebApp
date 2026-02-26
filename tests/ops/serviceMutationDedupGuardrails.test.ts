import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("service mutation dedup guardrails", () => {
  it("usa helper partilhado nas rotas create/update de serviços", () => {
    const createRoute = readLocal("app/api/org/[orgId]/servicos/route.ts");
    const updateRoute = readLocal("app/api/org/[orgId]/servicos/[id]/route.ts");

    for (const content of [createRoute, updateRoute]) {
      expect(content).toContain("serviceMutationHelpers");
      expect(content).toContain("ALLOWED_SERVICE_DURATIONS");
      expect(content).not.toContain("function normalizeIdList(");
      expect(content).not.toContain("function slugifyCategory(");
      expect(content).not.toContain("function getDefaultCategoryByDomain(");
      expect(content).not.toContain("function errorCodeForStatus(");
    }
  });
});
