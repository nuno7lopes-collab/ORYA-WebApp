import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("event detail hero state contract", () => {
  it("usa chip principal unico no hero", () => {
    const source = readLocal("app/eventos/[slug]/page.tsx");

    expect(source).toContain("const heroPrimaryChip = (() => {");
    expect(source).toContain("heroPrimaryChip.label");
    expect(source).not.toContain("showPriceFrom ? (");
  });
});
