import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("tool boundary navigation", () => {
  it("keeps BI links in /analytics and ops/compliance links in /finance", () => {
    const objectiveNav = readLocal("app/org/_internal/core/objectiveNav.ts");
    expect(objectiveNav).toContain('href: "/org/analytics?view=overview"');
    expect(objectiveNav).toContain('href: "/org/analytics?view=conversion"');
    expect(objectiveNav).toContain('href: "/org/finance?view=overview"');
    expect(objectiveNav).toContain('href: "/org/finance?view=invoicing"');
    expect(objectiveNav).toContain('href: "/org/finance?view=ops"');
  });
});
