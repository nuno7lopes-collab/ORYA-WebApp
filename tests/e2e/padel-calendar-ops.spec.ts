import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readLocal = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("e2e guardrails - padel calendar ops", () => {
  it("mantém drag temporal com preflight explícito no calendário", () => {
    const dayGrid = readLocal("app/org/_internal/core/(dashboard)/padel/calendar-v2/DayFieldGrid.tsx");
    const hub = readLocal("app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx");

    expect(dayGrid).toContain("onQuickRescheduleMatch");
    expect(dayGrid).toContain("Largar para mudar hora");
    expect(hub).toContain("resolveCalendarPreflightConflict");
    expect(hub).toContain("Reagendamento bloqueado:");
  });

  it("aplica preflight também em bulk move e mantém paridade preview/apply", () => {
    const hub = readLocal("app/org/_internal/core/(dashboard)/padel/PadelHubClient.tsx");

    expect(hub).toContain("bulkMoveSelectedMatches");
    expect(hub).toContain("/api/padel/calendar/matches/bulk-reschedule");
    expect(hub).toContain("resolveBlockedReasonCodeFromType");
    expect(hub).toContain("resolveAutoScheduleDomainConflictMessage");
    expect(hub).toContain("resolveAutoScheduleInfeasibleMessage");
    expect(hub).toContain('mode: "APPLY"');
    expect(hub).toContain('mode: "PREVIEW"');
  });
});
