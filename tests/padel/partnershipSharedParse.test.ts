import { describe, expect, it } from "vitest";
import { parsePositiveInt } from "@/app/api/padel/partnerships/_shared";

describe("partnerships parsePositiveInt", () => {
  it("aceita inteiros positivos", () => {
    expect(parsePositiveInt(7)).toBe(7);
    expect(parsePositiveInt("8")).toBe(8);
    expect(parsePositiveInt(" 9 ")).toBe(9);
  });

  it("rejeita decimais e inválidos", () => {
    expect(parsePositiveInt(7.2)).toBeNull();
    expect(parsePositiveInt("8.1")).toBeNull();
    expect(parsePositiveInt("")).toBeNull();
    expect(parsePositiveInt("abc")).toBeNull();
    expect(parsePositiveInt(0)).toBeNull();
    expect(parsePositiveInt(-1)).toBeNull();
  });
});
