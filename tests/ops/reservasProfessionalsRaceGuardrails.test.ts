import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("reservas professionals race guardrails", () => {
  it("usa upsert no auto-provisionamento STAFF e trata colisão de unicidade no POST", () => {
    const route = readLocal("app/api/org/[orgId]/reservas/profissionais/route.ts");

    expect(route).toContain("reservationProfessional.upsert");
    expect(route).toContain("organizationId_userId");
    expect(route).toContain("code === \"P2002\"");
    expect(route).toContain("PROFESSIONAL_EXISTS");
  });
});
