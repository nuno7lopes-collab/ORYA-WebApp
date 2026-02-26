import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const resolveRoutePath = resolve(
  process.cwd(),
  "app/api/messages/conversations/resolve/route.ts",
);
const redeemRoutePath = resolve(
  process.cwd(),
  "app/api/messages/communities/invite-links/redeem/route.ts",
);
const inviteLinkRoutePath = resolve(
  process.cwd(),
  "app/api/messages/communities/[conversationId]/invite-link/route.ts",
);
const inviteLandingPagePath = resolve(
  process.cwd(),
  "app/messages/community-invite/[token]/page.tsx",
);
const inviteLandingClientPath = resolve(
  process.cwd(),
  "app/messages/community-invite/[token]/CommunityInviteLandingClient.tsx",
);

describe("community invite link contract", () => {
  it("mantem source table canonica de redeem em resolve e redeem", () => {
    const resolveRoute = readFileSync(resolveRoutePath, "utf8");
    const redeemRoute = readFileSync(redeemRoutePath, "utf8");

    expect(resolveRoute).toContain('sourceTable: "community_invite_link_redeem"');
    expect(redeemRoute).toContain('sourceTable: "community_invite_link_redeem"');
    expect(resolveRoute).toContain("community-invite-link:${link.id}:user:${user.id}");
    expect(redeemRoute).toContain("community-invite-link:${link.id}:user:${user.id}");
  });

  it("preserva metadata de auditoria do redeem", () => {
    const resolveRoute = readFileSync(resolveRoutePath, "utf8");
    const redeemRoute = readFileSync(redeemRoutePath, "utf8");

    expect(resolveRoute).toContain("inviteLinkId: link.id");
    expect(resolveRoute).toContain("redeemedByUserId: user.id");
    expect(redeemRoute).toContain("inviteLinkId: link.id");
    expect(redeemRoute).toContain("redeemedByUserId: user.id");
  });

  it("mantem caminho web de convite e landing page dedicada", () => {
    const inviteLinkRoute = readFileSync(inviteLinkRoutePath, "utf8");
    const inviteLandingPage = readFileSync(inviteLandingPagePath, "utf8");
    const inviteLandingClient = readFileSync(inviteLandingClientPath, "utf8");

    expect(inviteLinkRoute).toContain("invitePath: `/messages/community-invite/");
    expect(inviteLandingPage).toContain("CommunityInviteLandingClient");
    expect(inviteLandingClient).toContain("orya://messages/community-invite/");
    expect(inviteLandingClient).toContain("/login?redirectTo=");
  });
});
