import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("auto-schedule preview/apply parity", () => {
  it("reutiliza helpers comuns de conflito/inviabilidade em simular e aplicar", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx"),
      "utf8",
    );

    expect(source).toContain("resolveAutoScheduleDomainConflictMessage");
    expect(source).toContain("resolveAutoScheduleInfeasibleMessage");
    expect(source).toContain('mode: "APPLY"');
    expect(source).toContain('mode: "PREVIEW"');
    expect(source).toContain("normalizeUnscheduledByReason");
  });
});
