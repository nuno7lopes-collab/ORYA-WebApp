import { describe, expect, it } from "vitest";
import { DEFAULT_PRIMARY_MODULE, getDefaultOrganizationModules } from "@/lib/organizationCategories";

describe("organizationCategories defaults", () => {
  it("inclui CRM e ANALYTICS no baseline", () => {
    const modules = getDefaultOrganizationModules(DEFAULT_PRIMARY_MODULE);

    expect(modules).toContain("CRM");
    expect(modules).toContain("ANALYTICS");
    expect(modules).toContain(DEFAULT_PRIMARY_MODULE);
  });
});
