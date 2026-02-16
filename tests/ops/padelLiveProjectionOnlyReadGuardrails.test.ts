import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel live projection-only read guardrails", () => {
  it("front público consome APIs canónicas de live (não write endpoints)", () => {
    const calendarPage = readLocal("app/eventos/[slug]/calendario/page.tsx");
    const monitorClient = readLocal("app/eventos/[slug]/monitor/MonitorClient.tsx");

    expect(calendarPage).toContain("buildPadelLiveReadModel");
    expect(monitorClient).toContain("/api/padel/public/live");
    expect(monitorClient).not.toContain("/api/padel/matches");
  });
});

