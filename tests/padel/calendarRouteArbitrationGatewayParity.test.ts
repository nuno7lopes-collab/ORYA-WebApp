import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("calendar route usa gateway canónico de arbitragem", () => {
  it("usa evaluateCandidateAgainstAgenda para writes de block/match", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/api/padel/calendar/route.ts"),
      "utf8",
    );

    expect(source).toContain("evaluateCandidateAgainstAgenda");
    expect(source).toMatch(/evaluateCandidateAgainstAgenda\s*\(/);
    expect(source).not.toMatch(/\bevaluateCandidate\s*\(/);
  });
});
