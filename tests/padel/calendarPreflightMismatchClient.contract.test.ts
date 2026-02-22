import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("PadelHubClient preflight mismatch telemetry", () => {
  it("reporta mismatch preview/apply para endpoint canónico", () => {
    const source = readFileSync(
      resolve(process.cwd(), "app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx"),
      "utf8",
    );

    expect(source).toContain("/api/padel/calendar/preflight-mismatch");
    expect(source).toContain("calendarConflictPreflightMismatchCount");
    expect(source).toContain("requestFingerprint");
  });
});

