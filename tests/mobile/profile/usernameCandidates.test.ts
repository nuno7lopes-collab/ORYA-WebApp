import { describe, expect, it } from "vitest";
import { buildUsernameCandidates } from "@/apps/mobile/features/profile/usernameCandidates";

describe("buildUsernameCandidates", () => {
  it("normalizes @ prefix and keeps canonical underscore username", () => {
    expect(buildUsernameCandidates("@top_padel")).toEqual(["top_padel"]);
  });

  it("derives underscore/hyphen/compact variants for spaced input", () => {
    expect(buildUsernameCandidates("Top Padel Club")).toEqual([
      "toppadelclub",
      "top_padel_club",
    ]);
  });

  it("deduplicates equivalent variants", () => {
    expect(buildUsernameCandidates("top-padel")).toEqual(["top_padel"]);
    expect(buildUsernameCandidates("top_padel")).toEqual(["top_padel"]);
  });
});
