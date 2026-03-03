import { describe, expect, it } from "vitest";
import { isPadelContext } from "@/lib/crm/isPadelContext";

describe("isPadelContext", () => {
  it("identifica contexto padel por tipo de organização", () => {
    expect(
      isPadelContext({
        organizationKind: "CLUBE_PADEL",
      }),
    ).toBe(true);
  });

  it("identifica contexto padel por template PADEL", () => {
    expect(
      isPadelContext({
        templateType: "PADEL",
      }),
    ).toBe(true);
  });

  it("não marca contexto padel para organização não padel", () => {
    expect(
      isPadelContext({
        organizationKind: "RESTAURANTE",
        serviceKind: "GENERAL",
      }),
    ).toBe(false);
  });
});
