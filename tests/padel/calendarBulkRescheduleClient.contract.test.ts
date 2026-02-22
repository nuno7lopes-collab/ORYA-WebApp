import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("PadelHubClient bulk reschedule contract", () => {
  it("usa endpoint único com PREVIEW/APPLY para o lote de jogos", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx"),
      "utf8",
    );

    expect(source).toContain("/api/padel/calendar/matches/bulk-reschedule");
    expect(source).toContain('mode: "PREVIEW"');
    expect(source).toContain('mode: "APPLY"');
    expect(source).toContain("BULK_MATCH_RESCHEDULE");
  });
});
