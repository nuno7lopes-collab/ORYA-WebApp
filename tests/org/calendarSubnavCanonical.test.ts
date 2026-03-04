import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("calendar subnav canonical", () => {
  it("usa apenas agenda, disponibilidade e conflitos", () => {
    const file = readLocal("app/org/_components/subnav/CalendarSubnav.tsx");
    expect(file).toContain('id: "agenda"');
    expect(file).toContain('label: "Agenda"');
    expect(file).toContain('id: "availability"');
    expect(file).toContain('id: "conflicts"');
    expect(file).not.toContain('id: "week"');
    expect(file).not.toContain('id: "day"');
    expect(file).not.toContain('id: "month"');
  });
});

