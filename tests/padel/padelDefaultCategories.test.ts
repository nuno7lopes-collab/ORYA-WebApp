import { describe, expect, it } from "vitest";
import {
  buildPadelCategoryKey,
  buildPadelDefaultCategories,
  inferPadelMandatoryCategoryCodeFromFields,
  isReservedPadelMandatoryLabel,
  parsePadelMandatoryCategoryCode,
} from "@/domain/padelDefaultCategories";

describe("padel default categories", () => {
  it("gera as 18 categorias obrigatórias com códigos reservados", () => {
    const defaults = buildPadelDefaultCategories();
    expect(defaults).toHaveLength(18);
    expect(defaults[0]).toMatchObject({ label: "M1", genderRestriction: "MALE", minLevel: "1", maxLevel: "1" });
    expect(defaults[6]).toMatchObject({ label: "F1", genderRestriction: "FEMALE", minLevel: "1", maxLevel: "1" });
    expect(defaults[12]).toMatchObject({ label: "MX1", genderRestriction: "MIXED", minLevel: "1", maxLevel: "1" });
    expect(defaults[17]).toMatchObject({ label: "MX6", genderRestriction: "MIXED", minLevel: "6", maxLevel: "6" });
  });

  it("normaliza códigos reservados e aliases legacy", () => {
    expect(parsePadelMandatoryCategoryCode("M3")).toBe("M3");
    expect(parsePadelMandatoryCategoryCode("f-6")).toBe("F6");
    expect(parsePadelMandatoryCategoryCode("mx 2")).toBe("MX2");
    expect(parsePadelMandatoryCategoryCode("Masculino 4")).toBe("M4");
    expect(parsePadelMandatoryCategoryCode("Feminino_1")).toBe("F1");
    expect(parsePadelMandatoryCategoryCode("Misto5")).toBe("MX5");
    expect(parsePadelMandatoryCategoryCode("M7")).toBeNull();
    expect(parsePadelMandatoryCategoryCode("Open Elite")).toBeNull();
  });

  it("deteta nomes reservados", () => {
    expect(isReservedPadelMandatoryLabel("MX6")).toBe(true);
    expect(isReservedPadelMandatoryLabel("M 1")).toBe(true);
    expect(isReservedPadelMandatoryLabel("M7")).toBe(false);
    expect(isReservedPadelMandatoryLabel("Mista Open")).toBe(false);
  });

  it("infere código obrigatório a partir de género e nível", () => {
    expect(
      inferPadelMandatoryCategoryCodeFromFields({
        genderRestriction: "MALE",
        minLevel: "2",
        maxLevel: "2",
      }),
    ).toBe("M2");
    expect(
      inferPadelMandatoryCategoryCodeFromFields({
        genderRestriction: "FEMALE",
        minLevel: "6",
        maxLevel: "6",
      }),
    ).toBe("F6");
    expect(
      inferPadelMandatoryCategoryCodeFromFields({
        genderRestriction: "MIXED",
        minLevel: "1",
        maxLevel: "1",
      }),
    ).toBe("MX1");
    expect(
      inferPadelMandatoryCategoryCodeFromFields({
        genderRestriction: "MIXED",
        minLevel: "7",
        maxLevel: "7",
      }),
    ).toBeNull();
  });

  it("usa chave canónica para nomes reservados e legacy", () => {
    const keyCode = buildPadelCategoryKey({ label: "M3", genderRestriction: "MALE" });
    const keyLegacy = buildPadelCategoryKey({ label: "Masculino 3", genderRestriction: "MALE" });
    expect(keyCode).toBe("mandatory:M3");
    expect(keyLegacy).toBe("mandatory:M3");
  });
});
