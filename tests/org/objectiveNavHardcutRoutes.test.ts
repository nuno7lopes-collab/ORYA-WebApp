import { describe, expect, it } from "vitest";
import { getObjectiveSections } from "@/app/org/_internal/core/objectiveNav";

describe("objective nav hard-cut routes", () => {
  it("does not generate removed /bookings/services links in reservas mode", () => {
    const sections = getObjectiveSections(
      "manage",
      {
        primaryModule: "RESERVAS",
        tools: ["RESERVAS", "STAFF", "DEFINICOES", "FINANCEIRO"],
        username: null,
      },
      { operationOverride: "RESERVAS" },
    );

    const hrefs = sections.flatMap((section) => [section.href, ...(section.items?.map((item) => item.href) ?? [])]);

    expect(hrefs.some((href) => href.includes("/bookings/services"))).toBe(false);
    expect(hrefs).toContain("/org/bookings");
  });
});
