import { describe, expect, it } from "vitest";
import { resolveOrgHubNavKey } from "@/app/org/_internal/core/organizations/orgHubNav";

describe("org hub top nav resolver", () => {
  it("resolve create quando path é create", () => {
    expect(resolveOrgHubNavKey("/org-hub/create")).toBe("create");
    expect(resolveOrgHubNavKey("/org-hub/create?groupMode=EXISTING_GROUP")).toBe("create");
  });

  it("resolve groups para grupos e subrotas", () => {
    expect(resolveOrgHubNavKey("/org-hub/groups")).toBe("groups");
    expect(resolveOrgHubNavKey("/org-hub/groups/9")).toBe("groups");
    expect(resolveOrgHubNavKey("/org-hub/groups/9/governance")).toBe("groups");
  });

  it("faz fallback para organizações", () => {
    expect(resolveOrgHubNavKey("/org-hub/organizations")).toBe("organizations");
    expect(resolveOrgHubNavKey("/org-hub")).toBe("organizations");
    expect(resolveOrgHubNavKey(null)).toBe("organizations");
  });
});
