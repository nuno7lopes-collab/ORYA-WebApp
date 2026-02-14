import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/org-hub/organizations/owner/confirm/route";

describe("owner transfer confirm (legacy org endpoint)", () => {
  it("POST devolve 410 com endpoint canónico de group", async () => {
    const req = new Request("http://localhost/api/org-hub/organizations/owner/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "tok" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.errorCode).toBe("GONE");
    expect(json.details?.endpoint).toBe("/api/org-hub/groups/:groupId/owner/transfer/confirm");
  });

  it("GET devolve 410 com endpoint canónico de group", async () => {
    const req = new Request("http://localhost/api/org-hub/organizations/owner/confirm?token=tok", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(410);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.errorCode).toBe("GONE");
  });
});
