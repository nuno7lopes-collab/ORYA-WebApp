import { describe, expect, it } from "vitest";
import { shouldEnforceMobileClientForResolve } from "@/lib/messages/resolvePolicy";

describe("resolve policy", () => {
  it("permite org channel em scope org sem gate mobile", () => {
    expect(
      shouldEnforceMobileClientForResolve({
        scope: "org",
        contextTypeRaw: "ORG_CHANNEL",
      }),
    ).toBe(false);
  });

  it("mantem gate mobile para org channel em scope b2c", () => {
    expect(
      shouldEnforceMobileClientForResolve({
        scope: "b2c",
        contextTypeRaw: "ORG_CHANNEL",
      }),
    ).toBe(true);
  });

  it("permite comunidades em web/mobile sem gate dedicado", () => {
    expect(
      shouldEnforceMobileClientForResolve({
        scope: "org",
        contextTypeRaw: "ORG_COMMUNITY",
      }),
    ).toBe(false);
    expect(
      shouldEnforceMobileClientForResolve({
        scope: "b2c",
        contextTypeRaw: "org_community",
      }),
    ).toBe(false);
  });

  it("exige gate mobile para contextos b2c restantes", () => {
    expect(
      shouldEnforceMobileClientForResolve({
        scope: "b2c",
        contextTypeRaw: "USER_DM",
      }),
    ).toBe(true);
    expect(
      shouldEnforceMobileClientForResolve({
        scope: "org",
        contextTypeRaw: "SERVICE",
      }),
    ).toBe(true);
  });
});
