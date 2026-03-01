import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const TARGETS = [
  "app/api/padel/rankings/route.ts",
  "app/api/padel/me/summary/route.ts",
  "app/api/padel/players/route.ts",
  "app/[username]/padel/page.tsx",
  "app/padel/rankings/PadelRankingsClient.tsx",
];

describe("padel surfaces não dependem de domain/ranking genérico", () => {
  it("não importa domain/ranking/* nas superfícies canónicas de padel", () => {
    for (const relativePath of TARGETS) {
      const absolutePath = path.join(process.cwd(), relativePath);
      const source = fs.readFileSync(absolutePath, "utf8");
      expect(source).not.toMatch(/from\s+["']@\/domain\/ranking\//);
      expect(source).not.toMatch(/require\(["']@\/domain\/ranking\//);
    }
  });
});
