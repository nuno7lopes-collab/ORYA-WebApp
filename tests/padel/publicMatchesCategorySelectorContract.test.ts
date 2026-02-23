import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("public matches by category selector contract", () => {
  it("expõe seletor por categoria e lista focada na categoria ativa", () => {
    const source = readLocal("app/eventos/[slug]/PadelMatchesByCategoryClient.tsx");

    expect(source).toContain("selectedCategory");
    expect(source).toContain("setSelectedCategory");
    expect(source).toContain("selectedCategoryEntry");
    expect(source).toContain("selectedCategoryMatches");
    expect(source).toContain("Próximos jogos por categoria");
    expect(source).toContain("category-${categoryId}");
    expect(source).toContain("{category.categoryLabel} ({category.matches.length})");
  });
});
