import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/cron/analytics/rollup/route";
import { runAnalyticsRollupJob } from "@/domain/analytics/rollup";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";

vi.mock("@/domain/analytics/rollup", () => ({
  runAnalyticsRollupJob: vi.fn(async () => ({ ok: true, scannedDays: 0, rows: 0, rollups: 0 })),
}));
vi.mock("@/lib/cron/heartbeat", () => ({
  recordCronHeartbeat: vi.fn(async () => undefined),
}));

const runMock = vi.mocked(runAnalyticsRollupJob);
const heartbeatMock = vi.mocked(recordCronHeartbeat);

describe("analytics rollup cron route", () => {
  it("bloqueia sem secret", async () => {
    process.env.ORYA_CRON_SECRET = "secret";
    const req = new NextRequest("http://localhost/api/cron/analytics/rollup", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("executa com secret", async () => {
    process.env.ORYA_CRON_SECRET = "secret";
    const req = new NextRequest("http://localhost/api/cron/analytics/rollup", {
      method: "POST",
      headers: { "X-ORYA-CRON-SECRET": "secret" },
      body: JSON.stringify({ maxDays: 1 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(runMock).toHaveBeenCalled();
    expect(heartbeatMock).toHaveBeenCalled();
  });
});
