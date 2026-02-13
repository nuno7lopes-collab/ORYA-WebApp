import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel live timer guardrails", () => {
  it("expõe endpoints operacionais de timer", () => {
    const start = readLocal("app/api/padel/live/timer/start/route.ts");
    const stop = readLocal("app/api/padel/live/timer/stop/route.ts");
    const next = readLocal("app/api/padel/live/timer/next-round/route.ts");
    expect(start).toContain("PADEL_LIVE_TIMER_START");
    expect(stop).toContain("PADEL_LIVE_TIMER_STOP");
    expect(next).toContain("PADEL_LIVE_TIMER_NEXT_ROUND");
    expect(start).toContain("TIMER_NOT_SUPPORTED_FOR_FORMAT");
  });

  it("live stream inclui estado de timer autoritativo", () => {
    const live = readLocal("app/api/padel/live/route.ts");
    expect(live).toContain("timerState");
    expect(live).toContain("serverNow");
    expect(live).toContain("remainingMs");
  });
});
