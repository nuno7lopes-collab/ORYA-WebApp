import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RESULT_WRITE_FILES = [
  "app/api/padel/matches/route.ts",
  "app/api/padel/matches/[id]/walkover/route.ts",
  "app/api/padel/matches/[id]/dispute/route.ts",
];

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel rule snapshot guardrails (D18.12)", () => {
  it("writes de resultado/disputa incluem ruleSnapshot", () => {
    for (const file of RESULT_WRITE_FILES) {
      const content = readLocal(file);
      expect(content, file).toContain("ruleSnapshot");
      expect(content, file).toContain("ruleSetVersionId");
    }
  });
});
