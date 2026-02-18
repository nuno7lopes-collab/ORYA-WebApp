import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel public live surface guardrails", () => {
  it("keeps public calendar with quick filters and live alerts", () => {
    const calendarPage = readLocal("app/eventos/[slug]/calendario/page.tsx");

    expect(calendarPage).toContain("Filtros rápidos");
    expect(calendarPage).toContain("Alertas live");
    expect(calendarPage).toContain("statusFilter");
    expect(calendarPage).toContain("buildViewHref");
    expect(calendarPage).toContain("pending_review_expired");
  });

  it("keeps monitor with operational alert panel and enriched next matches", () => {
    const monitorClient = readLocal("app/eventos/[slug]/monitor/MonitorClient.tsx");

    expect(monitorClient).toContain("Alertas operacionais");
    expect(monitorClient).toContain("operationalAlerts");
    expect(monitorClient).toContain("formatMatchTime");
    expect(monitorClient).toContain("formatStatus");
  });
});
