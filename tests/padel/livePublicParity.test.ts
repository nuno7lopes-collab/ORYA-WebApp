import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel live public/internal parity", () => {
  it("usa o mesmo read-model canónico nas superfícies live", () => {
    const publicLive = readLocal("app/api/padel/public/live/route.ts");
    const internalLive = readLocal("app/api/padel/live/route.ts");
    const publicCalendar = readLocal("app/api/padel/public/calendar/route.ts");

    expect(publicLive).toContain('from "@/domain/padel/liveReadModel"');
    expect(internalLive).toContain('from "@/domain/padel/liveReadModel"');
    expect(publicCalendar).toContain('from "@/domain/padel/liveReadModel"');
  });
});

