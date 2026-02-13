import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel live participant guardrails (D18.07, D18.13)", () => {
  it("livehub resolve participante Padel via entitlement + PadelRegistration (não via TournamentEntry)", () => {
    const content = readLocal("app/api/live/events/[slug]/route.ts");
    const match = content.match(/const hasPadelEntitlement[\s\S]*?const isParticipant\s*=/);
    expect(match).toBeTruthy();
    const block = match?.[0] ?? "";
    expect(block).toContain("ACTIVE_REGISTRATION_STATUSES");
    expect(block).toContain("prisma.padelRegistration.findFirst");
    expect(block).not.toContain("tournamentEntry.findFirst");
  });
});
