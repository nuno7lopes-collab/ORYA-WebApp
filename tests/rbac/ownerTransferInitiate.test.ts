import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/org-hub/organizations/owner/transfer/route";

describe("owner transfer initiate (legacy org endpoint)", () => {
  it("devolve 410 com endpoint canónico de group", async () => {
    const req = new Request("http://localhost/api/org-hub/organizations/owner/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId: 10, targetUserId: "u2" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.errorCode).toBe("GONE");
    expect(json.details?.endpoint).toBe("/api/org-hub/groups/:groupId/owner/transfer/start");
  });
});
