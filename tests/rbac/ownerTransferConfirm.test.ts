import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

describe("owner transfer confirm (legacy org endpoint)", () => {
  it("foi removido fisicamente (hard-cut)", () => {
    const absPath = resolve(process.cwd(), "app/api/org-hub/organizations/owner/confirm/route.ts");
    expect(existsSync(absPath)).toBe(false);
  });
});
