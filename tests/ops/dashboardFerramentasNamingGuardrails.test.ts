import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("dashboard naming guardrails", () => {
  it("keeps canonical Ferramentas naming on primary organization surfaces", () => {
    const files = [
      "app/org/_internal/core/DashboardClient.tsx",
      "app/org/_internal/core/OrganizationBreadcrumb.tsx",
    ];

    for (const file of files) {
      const content = readLocal(file);
      expect(content).toContain("Ferramentas");
      expect(content).not.toContain("Módulos");
      expect(content).not.toContain("modulos");
    }
  });
});
