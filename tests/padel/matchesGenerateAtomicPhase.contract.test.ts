import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("auto-generate matches atomic phase", () => {
  it("aplica lock lógico e fase atómica para replace/create", () => {
    const source = readFileSync(resolve(process.cwd(), "domain/padel/autoGenerateMatches.ts"), "utf8");

    expect(source).toContain("applyMatchGenerationPlan");
    expect(source).toContain("pg_advisory_xact_lock");
    expect(source).toContain("existingErrorCode: \"GROUPS_ALREADY_GENERATED\"");
    expect(source).toContain("existingErrorCode: \"KNOCKOUT_ALREADY_GENERATED\"");
    expect(source).toContain("existingErrorCode: \"MATCHES_ALREADY_EXIST\"");
  });
});

