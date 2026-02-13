import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel mobile upgrade gate guardrails", () => {
  it("mantém helper canónico de version gate", () => {
    const helper = readLocal("lib/http/mobileVersionGate.ts");
    expect(helper).toContain("UPGRADE_REQUIRED");
    expect(helper).toContain("MIN_SUPPORTED_MOBILE_VERSION");
  });

  it("aplica gate nos endpoints breaking", () => {
    const endpoints = [
      "app/api/padel/standings/route.ts",
      "app/api/padel/matches/route.ts",
      "app/api/padel/matches/generate/route.ts",
      "app/api/padel/calendar/route.ts",
      "app/api/padel/calendar/claims/commit/route.ts",
      "app/api/padel/rankings/route.ts",
    ];
    for (const file of endpoints) {
      const content = readLocal(file);
      expect(content, file).toContain("enforceMobileVersionGate");
    }
  });

  it("mantém hard-cut explícito no endpoint legado de live", () => {
    const liveLegacy = readLocal("app/api/padel/live/route.ts");
    expect(liveLegacy).toContain("LIVE_ENDPOINT_MOVED");
    expect(liveLegacy).toContain("/api/live/events/:slug/stream");
    expect(liveLegacy).not.toContain("enforceMobileVersionGate");
  });
});
