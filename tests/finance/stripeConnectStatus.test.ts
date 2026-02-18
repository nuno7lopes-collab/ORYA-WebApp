import { describe, expect, it } from "vitest";
import { isValidStripeAccountId, resolveConnectStatus } from "@/domain/finance/stripeConnectStatus";

describe("stripeConnectStatus", () => {
  it("marks malformed account ids as missing", () => {
    expect(isValidStripeAccountId("acct_platform_orya_shared")).toBe(false);
    expect(resolveConnectStatus("acct_platform_orya_shared", true, true)).toBe("MISSING");
  });

  it("returns ready only for valid account id with full capabilities", () => {
    const accountId = "acct_1AbC2DeF3GhI4J";
    expect(isValidStripeAccountId(accountId)).toBe(true);
    expect(resolveConnectStatus(accountId, true, true)).toBe("READY");
  });
});
