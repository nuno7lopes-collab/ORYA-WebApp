import { describe, expect, it } from "vitest";
import { buildTelemetryExportPdf } from "@/lib/telemetry/exportPdf";

describe("telemetry export pdf", () => {
  it("gera um buffer PDF válido", async () => {
    const buffer = await buildTelemetryExportPdf({
      dataset: "events",
      headers: ["occurredAt", "eventName", "severity"],
      rows: [["2026-02-27T10:00:00.000Z", "checkout.flow.started", "INFO"]],
      rowCount: 1,
      title: "ORYA Telemetria - Exportacao",
      scopeLabel: "Global",
      filters: { sourceType: "WEB" },
      generatedAt: new Date("2026-02-27T10:00:00.000Z"),
    });

    expect(buffer.length).toBeGreaterThan(32);
    expect(buffer.toString("ascii", 0, 4)).toBe("%PDF");
  });
});

