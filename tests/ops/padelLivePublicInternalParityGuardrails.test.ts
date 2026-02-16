import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel live public/internal parity guardrails", () => {
  it("usa read-model único para live público e interno", () => {
    const publicLive = readLocal("app/api/padel/public/live/route.ts");
    const internalLive = readLocal("app/api/padel/live/route.ts");
    const readModel = readLocal("domain/padel/liveReadModel.ts");

    expect(publicLive).toContain("buildPadelLiveReadModel");
    expect(internalLive).toContain("buildPadelLiveReadModel");
    expect(readModel).toContain("export async function buildPadelLiveReadModel");
  });
});

