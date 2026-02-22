import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("calendar class session guardrails", () => {
  it("agenda endpoint inclui CLASS_SESSION por defeito", () => {
    const route = readLocal("app/api/org/[orgId]/agenda/route.ts");
    expect(route).toContain("SourceType.CLASS_SESSION");
  });

  it("query read model mapeia CLASS_SESSION para kind CLASS", () => {
    const query = readLocal("domain/agendaReadModel/query.ts");
    expect(query).toContain("SourceType.CLASS_SESSION");
    expect(query).toContain('kind: "CLASS"');
    expect(query).toContain("classSessionId");
  });

  it("ui day/week expõe filtro por tipo com Aula", () => {
    const day = readLocal("app/org/[orgId]/calendar/_components/day/DayCalendarReadClient.tsx");
    const week = readLocal("app/org/[orgId]/calendar/_components/WeekCalendarReadClient.tsx");
    expect(day).toContain("KIND_FILTER_OPTIONS");
    expect(day).toContain('{ value: "CLASS", label: "Aula" }');
    expect(week).toContain("KIND_FILTER_OPTIONS");
    expect(week).toContain('{ value: "CLASS", label: "Aula" }');
  });
});
