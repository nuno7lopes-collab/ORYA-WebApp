import { describe, expect, it } from "vitest";
import { releaseDuePayouts, releaseSinglePayout } from "@/lib/payments/releaseWorker";

describe("payout control disabled", () => {
  it("releaseSinglePayout returns SKIPPED with reason", async () => {
    const result = await releaseSinglePayout(1);

    expect(result.status).toBe("SKIPPED");
    expect(result.error).toBe("PAYOUT_CONTROL_DISABLED");
  });

  it("releaseDuePayouts returns empty list", async () => {
    const result = await releaseDuePayouts();

    expect(result).toEqual([]);
  });
});
