import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("POST /api/padel/calendar/claims/commit observabilidade de arbitragem", () => {
  it("persiste eventId e decisionLatencyMs no metadata de decisões", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/api/padel/calendar/claims/commit/route.ts"),
      "utf8",
    );

    expect(source).toContain("eventId: event.id");
    expect(source).toContain("decisionLatencyMs");
    expect(source).toContain("agenda_arbitration_decisions");
    expect(source).toContain("bundle_id");
  });
});

