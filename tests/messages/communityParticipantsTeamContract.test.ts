import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const participantsRoutePath = resolve(
  process.cwd(),
  "app/api/messages/communities/[conversationId]/participants/route.ts",
);

const communitiesManagerPath = resolve(
  process.cwd(),
  "app/org/_internal/core/(dashboard)/chat/CommunitiesManagerClient.tsx",
);

describe("community participants team contract", () => {
  it("determina membro de equipa por membership efetiva da organização", () => {
    const source = readFileSync(participantsRoutePath, "utf8");

    expect(source).toContain("listEffectiveOrganizationMembers");
    expect(source).toContain("teamMemberUserIds");
    expect(source).toContain("isTeamMember: teamMemberUserIds.has(member.userId)");
    expect(source).not.toContain("member.organizationId === community.organizationId");
  });

  it("mapeia códigos de participante para copy legível na UI", () => {
    const source = readFileSync(communitiesManagerPath, "utf8");

    expect(source).toContain("PARTICIPANT_NOT_ACTIVE");
    expect(source).toContain("INVALID_MUTE_UNTIL");
    expect(source).toContain("ADMIN_MUST_BE_TEAM_MEMBER");
    expect(source).toContain("NOT_ADMIN");
    expect(source).toContain("INVALID_ACTION");
  });
});

