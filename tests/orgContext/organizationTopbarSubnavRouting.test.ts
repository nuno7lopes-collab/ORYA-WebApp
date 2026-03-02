import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("organization topbar subnav routing", () => {
  it("maps each tool to the expected subnav component", () => {
    const content = readLocal("app/org/_internal/core/OrganizationTopBar.tsx");
    expect(content).toContain('if (activeTool === "academy" || activeTool === "bookings")');
    expect(content).toContain("<AcademySubnav");
    expect(content).toContain('if (activeTool === "calendar") return <CalendarSubnav');
    expect(content).toContain('if (activeTool === "check-in") return <CheckInSubnav');
    expect(content).toContain('if (activeTool === "events") return <EventsSubnav');
    expect(content).toContain('if (activeTool === "padel-tournaments")');
    expect(content).toContain("<PadelTournamentsSubnav");
  });
});
