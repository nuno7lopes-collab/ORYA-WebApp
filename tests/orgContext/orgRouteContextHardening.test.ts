import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readLocal(path: string) {
  return readFileSync(path, "utf8");
}

describe("org route context hardening", () => {
  it("forwards requestedOrgId from /org/[orgId] layout into dashboard layout", () => {
    const file = readLocal("app/org/[orgId]/layout.tsx");
    expect(file).toContain("requestedOrgId");
    expect(file).toContain("<OrganizationDashboardLayout requestedOrgId={requestedOrgId}>");
  });

  it("resolves active organization by requestedOrgId without fallback", () => {
    const file = readLocal("app/org/_internal/core/(dashboard)/layout.tsx");
    expect(file).toContain("organizationId: requestedOrgId");
    expect(file).toContain("allowFallback: false");
    expect(file).toContain("if (requestedOrgId && !activeOrganization)");
  });

  it("pins critical tools to route org context when orgId is available", () => {
    const eventsPage = readLocal("app/org/_internal/core/(dashboard)/eventos/page.tsx");
    const crmLayout = readLocal("app/org/_internal/core/(dashboard)/crm/layout.tsx");
    const chatPage = readLocal("app/org/_internal/core/(dashboard)/chat/page.tsx");

    expect(eventsPage).toContain("organizationId: requestedOrgId");
    expect(eventsPage).toContain("allowFallback: false");
    expect(crmLayout).toContain("organizationId: requestedOrgId");
    expect(crmLayout).toContain("allowFallback: false");
    expect(chatPage).toContain("organizationId: requestedOrgId");
    expect(chatPage).toContain("allowFallback: false");
  });
});
