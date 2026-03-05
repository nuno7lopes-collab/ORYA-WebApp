import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("calendário operacional suporta drag temporal com preflight", () => {
  it("DayFieldGrid expõe drop temporal por slot", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "app/org/_internal/core/(dashboard)/padel/calendar/DayFieldGrid.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("onQuickRescheduleMatch");
    expect(source).toContain("Largar para mudar hora");
    expect(source).toContain("targetStartIso");
    expect(source).toContain("targetEndIso");
  });

  it("PadelHubClient aplica preflight antes do write de reagendamento", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("resolveCalendarPreflightConflict");
    expect(source).toContain("Reagendamento bloqueado:");
    expect(source).toContain("quickRescheduleCalendarMatch");
    expect(source).toContain("onQuickRescheduleMatch");
    expect(source).toContain("bulkMoveSelectedMatches");
  });
});
