import { describe, expect, it } from "vitest";
import { normalizeImportLookup, parsePadelImportRows } from "@/domain/padel/imports";

describe("padel imports parser", () => {
  const categoryById = new Map([[10, { id: 10, label: "A" }]]);
  const categoryByLabel = new Map([[normalizeImportLookup("A"), 10]]);

  it("parses valid rows and applies defaults", () => {
    const rows = [
      {
        Categoria: "A",
        Jogador1: "Ana",
        Jogador2: "Bia",
        Email1: "ana@example.com",
        Email2: "bia@example.com",
      },
      {
        Jogador1: "Carla",
        Jogador2: "Diana",
      },
    ];

    const result = parsePadelImportRows(rows, {
      categoryById,
      categoryByLabel,
      defaultCategoryId: 10,
      fallbackCategoryId: null,
    });

    expect(result.errors.length).toBe(0);
    expect(result.rows.length).toBe(2);
    expect(result.rows[1].categoryId).toBe(10);
  });

  it("flags duplicate pairs and invalid categories", () => {
    const rows = [
      { Categoria: "A", Jogador1: "Eva", Jogador2: "Filipa" },
      { Categoria: "A", Jogador1: "Eva", Jogador2: "Filipa" },
      { Categoria: "B", Jogador1: "Gina", Jogador2: "Helena" },
    ];

    const result = parsePadelImportRows(rows, {
      categoryById,
      categoryByLabel,
      defaultCategoryId: null,
      fallbackCategoryId: null,
    });

    expect(result.errors.length).toBe(2);
    expect(result.invalidRows.has(3)).toBe(true);
    expect(result.invalidRows.has(4)).toBe(true);
  });

  it("returns field-level errors for invalid rows", () => {
    const rows = [
      { Categoria: "A", Jogador1: "", Jogador2: "", Email1: "invalid", Grupo: "AA" },
    ];

    const result = parsePadelImportRows(rows, {
      categoryById,
      categoryByLabel,
      defaultCategoryId: 10,
      fallbackCategoryId: null,
    });

    const fields = result.errors.map((err) => err.field).filter(Boolean);
    expect(fields).toContain("player1_name");
    expect(fields).toContain("player2_name");
    expect(fields).toContain("player1_email");
    expect(fields).toContain("group");
  });
});
