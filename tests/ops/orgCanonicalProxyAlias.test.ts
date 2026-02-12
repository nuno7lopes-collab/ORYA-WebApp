import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("proxy org canonical aliasing", () => {
  it("redirects legacy /organizacao/* to canonical /org/:orgId/*", async () => {
    const req = new NextRequest("http://localhost/organizacao/manage?organizationId=42");
    const res = await proxy(req);

    expect(res.status).toBe(301);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/org/42/manage");
  });

  it("rewrites canonical /org/:orgId/* to current runtime /organizacao/*", async () => {
    const req = new NextRequest("http://localhost/org/42/financas?tab=invoices");
    const res = await proxy(req);

    expect(res.status).toBe(200);
    const rewrite = res.headers.get("x-middleware-rewrite") ?? "";
    expect(rewrite).toContain("/organizacao/analyze");
    expect(rewrite).toContain("organizationId=42");
    expect(rewrite).toContain("section=invoices");
  });
});
