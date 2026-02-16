import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("padel live tv mode contract", () => {
  it("expõe rota pública dedicada e consumo do endpoint live canónico", () => {
    const monitorPage = readLocal("app/eventos/[slug]/monitor/page.tsx");
    const monitorClient = readLocal("app/eventos/[slug]/monitor/MonitorClient.tsx");
    const publicCalendarPage = readLocal("app/eventos/[slug]/calendario/page.tsx");

    expect(monitorPage).toContain("MonitorClient");
    expect(monitorClient).toContain("/api/padel/public/live");
    expect(monitorClient).toContain("TV MODE");
    expect(publicCalendarPage).toContain(`/eventos/${"${event.slug}"}/monitor`);
  });
});

