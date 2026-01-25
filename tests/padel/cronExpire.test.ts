import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("cron padel expire (D12.2)", () => {
  it("não executa side-effects directos (stripe/pairing updates)", () => {
    const filePath = path.join(process.cwd(), "app/api/cron/padel/expire/route.ts");
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).not.toMatch(/stripe\\.paymentIntents\\.create/);
    expect(content).not.toMatch(/padelPairingSlot\\.updateMany/);
    expect(content).not.toMatch(/padelPairing\\.update/);
  });
});
