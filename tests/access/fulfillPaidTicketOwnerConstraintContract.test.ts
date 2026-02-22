import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const filePath = resolve(process.cwd(), "lib/operations/fulfillPaid.ts");

describe("fulfill paid ticket owner constraint contract", () => {
  it("não escreve ownerUserId e ownerIdentityId em simultâneo no Ticket create", () => {
    const file = readFileSync(filePath, "utf8");
    expect(file).toContain("tickets_owner_exclusive_chk");
    expect(file).toContain("const ticketOwnerUserId = ownerIdentityId ? null : userId;");
    expect(file).toContain("ownerUserId: ticketOwnerUserId ?? null");
    expect(file).toContain("ownerIdentityId: ownerIdentityId ?? null");
  });
});
