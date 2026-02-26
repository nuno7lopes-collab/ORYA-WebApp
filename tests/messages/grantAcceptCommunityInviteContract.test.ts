import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const grantAcceptRoutePath = resolve(
  process.cwd(),
  "app/api/messages/grants/[grantId]/accept/route.ts",
);

describe("grant accept community invite contract", () => {
  it("mantém reconciliação atómica no ramo já aceite", () => {
    const source = readFileSync(grantAcceptRoutePath, "utf8");

    expect(source).toContain('if (grant.status === "ACCEPTED")');
    expect(source).toContain('if (grant.kind === "COMMUNITY_INVITE")');
    expect(source).toContain("await prisma.$transaction(async (tx) => {");
    expect(source).toContain("await upsertCommunityConversationMember({");
  });
});

