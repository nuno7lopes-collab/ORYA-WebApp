import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel live read model category contract", () => {
  it("expõe categoryId/categoryLabel no payload público de jogos", () => {
    const source = readLocal("domain/padel/liveReadModel.ts");

    expect(source).toContain("categoryId: number | null");
    expect(source).toContain("categoryLabel: string | null");
    expect(source).toContain("match.category?.label");
  });
});
