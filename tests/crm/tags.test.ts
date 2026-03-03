import { describe, expect, it } from "vitest";
import {
  normalizeCrmTagColor,
  normalizeCrmTagName,
  normalizeCrmTagsInput,
  slugifyCrmTagName,
} from "@/lib/crm/tags";

describe("crm tags helpers", () => {
  it("normaliza nome de tag removendo vírgulas e espaços extra", () => {
    expect(normalizeCrmTagName("  VIP,  manhã  ")).toBe("VIP manhã");
    expect(normalizeCrmTagName("")).toBeNull();
  });

  it("normaliza cor e aplica fallback quando inválida", () => {
    expect(normalizeCrmTagColor("#22d3ee")).toBe("#22D3EE");
    expect(normalizeCrmTagColor("blue")).toBe("#22D3EE");
  });

  it("gera slug estável para tags com acentos", () => {
    expect(slugifyCrmTagName("No-show Risco")).toBe("no-show-risco");
    expect(slugifyCrmTagName("Aulas Avançadas")).toBe("aulas-avancadas");
  });

  it("deduplica tags por case-fold", () => {
    expect(normalizeCrmTagsInput(["VIP", "vip", "Mensal"])).toEqual(["VIP", "Mensal"]);
  });
});
